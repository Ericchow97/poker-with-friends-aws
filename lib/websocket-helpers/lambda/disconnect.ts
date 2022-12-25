import { APIGatewayEvent } from 'aws-lambda';

export const handler = async (event: APIGatewayEvent) => {
  console.log(`Event: ${JSON.stringify(event, null, 2)}`);
  // On connect pass back connectionID (this will act as the player ID)
  return {
    statusCode: 200,
    body: JSON.stringify({
      connectionStatus: "DISCONNECTED",
    }),
  };
};