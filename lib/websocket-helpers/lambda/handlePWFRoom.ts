import { APIGatewayEvent } from 'aws-lambda';
import { nanoid } from 'nanoid'
import { DynamoDBClient, ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const client = DynamoDBDocumentClient.from(ddbClient);

interface PWFCreateJoinData {
  data: {
    name: string,
    roomId: string,
    type: "Create" | "Join"
  }
}

export const handler = async (event: APIGatewayEvent) => {
  try {
    const { data } = JSON.parse(event.body || '') as PWFCreateJoinData

    // create player ID (ConnectionId to send back data)
    const playerId = event.requestContext.connectionId

    if (data.type === 'Create') {
      // create room & create new entry in DB 
      const roomId = nanoid(10)

      //TODO: See if you can pass in a TTL with refresh per entry
      await client.send(
        new PutCommand({
          TableName: process.env.PWF_TABLE_NAME,
          Item: {
            RoomId: roomId,
            ActiveUsers: new Set([playerId])
          }
        })
      )
    } else if (data.type === 'Join') {
      // update room ActiveUsers with new player iff table exists
      await client.send(
        new UpdateCommand({
          TableName: process.env.PWF_TABLE_NAME,
          Key: {
            RoomId: data.roomId
          },
          UpdateExpression: "ADD ActiveUsers :p",
          ConditionExpression: "RoomID = :roomId",
          ExpressionAttributeValues: {
            ":p": new Set([playerId]),
            ":roomId": data.roomId
          }
        })
      )
      // pass back information to users about who joined

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