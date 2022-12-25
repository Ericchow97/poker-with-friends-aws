import { APIGatewayEvent } from 'aws-lambda';

export const handler = async () => {
  return {
    statusCode: 200,
    body: JSON.stringify({
      connectionStatus: "CONNECTED",
    }),
  };
};