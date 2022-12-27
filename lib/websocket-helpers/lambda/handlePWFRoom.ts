import { APIGatewayEvent } from 'aws-lambda';
import { nanoid } from 'nanoid'
import { DynamoDBClient, ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";

// dbClient
const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const dbClient = DynamoDBDocumentClient.from(ddbClient);

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

    // create playerID/ConnectiondID (ConnectionId to send back data)
    const connectionId = event.requestContext.connectionId as string

    const connectionData: ConnectionData = {
      name: data.name,
      connectionId: connectionId
    }

    if (data.type === 'Create') {
      // create room & create new entry in DB 
      const roomId = nanoid(10)

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
      // update room ActiveUsers with new player iff table exists
      const { Attributes } = await dbClient.send(
        new UpdateCommand({
          TableName: process.env.PWF_TABLE_NAME,
          Key: {
            RoomId: data.roomId
          },
          UpdateExpression: "SET Connections = list_append(Connections, :p)",
          ConditionExpression: "RoomId = :roomId",
          ExpressionAttributeValues: {
            ":p": [connectionData],
            ":roomId": data.roomId
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
      //throw an error since invalid query type
    }

    // return success, player ID and roomID
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'created Room',
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
          message: 'Invalid Room Code Provided',
        }),
      };
    }

    // general error
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: 'error Room',
      }),
    };
  }


};