import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

// dbClient
const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
export const dbClient = DynamoDBDocumentClient.from(ddbClient);