import { APIGatewayEvent } from 'aws-lambda';
import { nanoid } from 'nanoid'
import { dbClient } from '../../class-helpers/dbClient';
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { PutCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { ApiGatewayClient } from '../../class-helpers/ApiGatewayClient';
import { RecordConnections, ConnectionData } from '../../../types';

interface PWFCreateJoinData {
  data: {
    name: string,
    roomId: string,
    type: "Create" | "Join"
  }
}

const apiGatewayClient = new ApiGatewayClient(
  process.env.AWS_REGION!,
  process.env.CONNECTION_URL!
)

export const handler = async (event: APIGatewayEvent) => {
  const { data } = JSON.parse(event.body || '') as PWFCreateJoinData

  // create playerID/ConnectionID (ConnectionId to send back data)
  const connectionId = event.requestContext.connectionId as string

  const connectionData: ConnectionData = {
    name: data.name,
    connectionId: connectionId
  }

  let roomId = data.roomId
  try {
    if (data.type === 'Create') {
      // create room & create new entry in DB 
      roomId = nanoid(10)

      //TODO: See if you can pass in a TTL with refresh per entry
      await dbClient.send(
        new PutCommand({
          TableName: process.env.PWF_GAME_TABLE_NAME,
          Item: {
            RoomId: roomId,
            Connections: [connectionData]
          }
        })
      )
    } else if (data.type === 'Join') {
      // update room Connections with new player iff table exists
      const { Attributes } = await dbClient.send(
        new UpdateCommand({
          TableName: process.env.PWF_GAME_TABLE_NAME,
          Key: {
            RoomId: roomId
          },
          UpdateExpression: "SET Connections = list_append(Connections, :p)",
          ConditionExpression: "RoomId = :roomId",
          ExpressionAttributeValues: {
            ":p": [connectionData],
            ":roomId": roomId
          },
          ReturnValues: "UPDATED_OLD"
        })
      )
      if (!Attributes) return

      // pass back information to existing users about who joined
      const connections = (Attributes as RecordConnections).Connections
      await apiGatewayClient.postToConnections(connections, {
        newPlayer: data.name
      })

    } else {
      //TODO: error handling
      //throw an error since invalid query type
    }

    // update connections table with roomId
    await dbClient.send(
      new UpdateCommand({
        TableName: process.env.CONNECTIONS_TABLE,
        Key: {
          ConnectionId: connectionId
        },
        UpdateExpression: "SET RoomId = :roomId",
        ExpressionAttributeValues: {
          ":roomId": roomId
        }
      })
    )

    // pass back information to sender about roomId and playerId
    await apiGatewayClient.postToConnections([connectionData], {
      status: 200,
      code: `${data.type}Room`,
      data: {
        connectionId,
        roomId
      }
    })

    return {
      statusCode: 200
    }

  } catch (e) {
    console.log(e)

    // invalid room code error
    if (e instanceof ConditionalCheckFailedException) {
      // send error message back to client
      await apiGatewayClient.postToConnections([connectionData], {
        status: 400,
        code: 'invalidRoom',
        data: {
          message: 'Invalid room code provided'
        },
      })

      // remove connection from DB
      await dbClient.send(
        new DeleteCommand({
          TableName: process.env.CONNECTIONS_TABLE,
          Key: {
            ConnectionId: connectionId
          },
        })
      )
      
      return {
        statusCode: 400,
      };
    }

    // general error
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: 'Error in creating room',
      }),
    };
  }
};