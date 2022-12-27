import { APIGatewayEvent } from 'aws-lambda';
import { nanoid } from 'nanoid'
import { dbClient } from '../../class-helpers/dbClient';
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";

const apiGatewayClient = new ApiGatewayManagementApiClient({
  region: process.env.AWS_REGION,
  endpoint: process.env.CONNECTION_URL,
});

interface PWFCreateJoinData {
  data: {
    name: string,
    roomId: string,
    type: "Create" | "Join"
  }
}

interface RecordActiveUsers {
  Connections: ConnectionData[]
}

interface ConnectionData {
  name: string,
  connectionId: string
}

export const handler = async (event: APIGatewayEvent) => {
  try {
    const { data } = JSON.parse(event.body || '') as PWFCreateJoinData

    // create playerID/ConnectionID (ConnectionId to send back data)
    const connectionId = event.requestContext.connectionId as string

    const connectionData: ConnectionData = {
      name: data.name,
      connectionId: connectionId
    }

    let roomId = data.roomId
    if (data.type === 'Create') {
      // create room & create new entry in DB 
      roomId = nanoid(10)

      //TODO: See if you can pass in a TTL with refresh per entry
      await dbClient.send(
        new PutCommand({
          TableName: process.env.PWF_TABLE_NAME,
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
          TableName: process.env.PWF_TABLE_NAME,
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
      const connections = (Attributes as RecordActiveUsers).Connections
      for (const connection of connections) {
        const command = new PostToConnectionCommand({
          ConnectionId: connection.connectionId,
          Data: Buffer.from(JSON.stringify({
            newPlayer: data.name
          }))
        })
        await apiGatewayClient.send(command)
      }
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

    // return success, connectionId and roomId
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'created Room',
        data: {
          connectionId,
          roomId
        }
      }),
    };
  } catch (e) {
    console.log(e)

    // invalid room code error
    if (e instanceof ConditionalCheckFailedException) {
      console.log('this is a test')
      return {
        statusCode: 400,
        body: JSON.stringify({
          code: 'invalidRoom',
          message: 'Invalid room code provided',
        }),
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