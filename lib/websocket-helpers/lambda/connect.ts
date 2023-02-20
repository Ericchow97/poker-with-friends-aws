import { APIGatewayEvent } from 'aws-lambda';
import { dbClient } from '../../class-helpers/dbClient';
import { PutCommand } from "@aws-sdk/lib-dynamodb";

export const handler = async (event: APIGatewayEvent) => {
  try {
    // write new connection to connections table
    await dbClient.send(
      new PutCommand({
        TableName: process.env.CONNECTIONS_TABLE,
        Item: {
          ConnectionId: event.requestContext.connectionId,
          RoomId: ''
        }
      })
    )

    return {
      statusCode: 200,
      body: JSON.stringify({
        connectionStatus: "CONNECTED",
      }),
    }
  } catch (e) {
    // general error
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: 'Error in creating connection',
      }),
    };
  }
};