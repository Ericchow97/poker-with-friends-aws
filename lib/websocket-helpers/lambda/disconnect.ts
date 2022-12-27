import { APIGatewayEvent } from 'aws-lambda';
import { dbClient } from '../../class-helpers/dbClient';
import { GetCommand, DeleteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { RecordConnections } from '../../../types';

import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";

const apiGatewayClient = new ApiGatewayManagementApiClient({
  region: process.env.AWS_REGION,
  endpoint: process.env.CONNECTION_URL,
});


export const handler = async (event: APIGatewayEvent) => {
  try {
    console.log(`Event: ${JSON.stringify(event, null, 2)}`);

    const connectionId = event.requestContext.connectionId

    // find RoomId from Connections Table
    const { Item: userInfo } = await dbClient.send(
      new GetCommand({
        TableName: process.env.CONNECTIONS_TABLE,
        Key: {
          ConnectionId: connectionId
        },
        ProjectionExpression: "RoomId"
      })
    )

    if (!userInfo) return
    const roomId = userInfo.RoomId

    // find players list from GameRooms Table
    const { Item } = await dbClient.send(
      new GetCommand({
        TableName: process.env.PWF_GAME_TABLE_NAME,
        Key: {
          RoomId: roomId
        },
        ProjectionExpression: "Connections"
      })
    )

    console.log(Item)
    if (!Item) return
    const activeConnections = (Item as RecordConnections).Connections

    // delete from db if only user left in room
    if (activeConnections.length === 1) {
      await dbClient.send(
        new DeleteCommand({
          TableName: process.env.PWF_GAME_TABLE_NAME,
          Key: {
            RoomId: roomId
          },
        })
      )

      console.log('deleted Room')

    } else {
      // more than one user, keep room open
      const connectionIndex = activeConnections.findIndex(elem => elem.connectionId === connectionId)
      console.log(connectionIndex)

      // remove connection from DB
      const { Attributes } = await dbClient.send(
        new UpdateCommand({
          TableName: process.env.PWF_GAME_TABLE_NAME,
          Key: {
            RoomId: roomId
          },
          UpdateExpression: `REMOVE Connections[${connectionIndex}]`,
          ConditionExpression: "RoomId = :roomId",
          ExpressionAttributeValues: {
            ":roomId": roomId
          },
          ReturnValues: "UPDATED_NEW"
        })
      )

      console.log(Attributes)

      if (!Attributes) return

      // pass back information to existing users about who left
      const connections = (Attributes as RecordConnections).Connections
      for (const connection of connections) {
        const command = new PostToConnectionCommand({
          ConnectionId: connection.connectionId,
          Data: Buffer.from(JSON.stringify({
            removedPlayer: activeConnections[connectionIndex].name
          }))
        })
        await apiGatewayClient.send(command)
      }
    }

    // delete user from connections table
    await dbClient.send(
      new DeleteCommand({
        TableName: process.env.CONNECTIONS_TABLE,
        Key: {
          ConnectionId: connectionId
        },
      })
    )

    return {
      statusCode: 200,
      body: JSON.stringify({
        connectionStatus: "DISCONNECTED",
      }),
    };

  } catch (e) {
    console.log(e)

    // general error
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: 'Error in creating connection',
      }),
    };
  }
};