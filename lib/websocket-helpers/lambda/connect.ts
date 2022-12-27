import { APIGatewayEvent } from 'aws-lambda';
import { dbClient } from '../../class-helpers/dbClient';
import { PutCommand } from "@aws-sdk/lib-dynamodb";

export const handler = async (event: APIGatewayEvent) => {
  // write to connections table the new connection
  const data = await dbClient.send(
    new PutCommand({
      TableName: process.env.CONNECTIONS_TABLE,
      Item: {
        ConnectionId: event.requestContext.connectionId,
        RoomId: ''
      }
    })
  )

  console.log(data)

  return {
    statusCode: 200,
    body: JSON.stringify({
      connectionStatus: "CONNECTED",
    }),
  };
};