import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";
import { ConnectionData } from "../../types";

// export const apiGatewayClient = new ApiGatewayManagementApiClient({
//   region: process.env.AWS_REGION,
//   endpoint: process.env.CONNECTION_URL,
// });

export class ApiGatewayClient {
  readonly client: ApiGatewayManagementApiClient

  constructor(region: string, endpoint: string) {
    this.client = new ApiGatewayManagementApiClient({
      region,
      endpoint,
    });
  }

  async postToConnections(connections: ConnectionData[], data: any) {
    const allRequests = connections.map(connection => {
      const command = new PostToConnectionCommand({
        ConnectionId: connection.connectionId,
        Data: Buffer.from(JSON.stringify(data))
      })
      return this.client.send(command)
    })
    await Promise.all(allRequests)
  }
}