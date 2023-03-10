import { Stack, StackProps, Aws } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Table, AttributeType } from 'aws-cdk-lib/aws-dynamodb';
import { PolicyStatement, Effect } from "aws-cdk-lib/aws-iam";
import * as path from 'path';

import { PWFApi } from './websocket-helpers/api-gateway/PWFApi';

export class PokerWithFriendsAwsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    
    // create connections table
    // Connections table allows sending messages back to the connected users
    const connectionsTable = new Table(this, 'ConnectionsTable', {
      partitionKey: { name: 'ConnectionId', type: AttributeType.STRING }
    })

    // create PWF Game Room Table
    // PWF Game Room Table stores all active game rooms 
    const gameRoomTable = new Table(this, 'PWFGameRooms', {
      partitionKey: { name: 'RoomId', type: AttributeType.STRING }
    });

    // create API Gateway
    const websocketApiGateway = new PWFApi(this, 'PWFApi')
    const connectionUrl = `https://${websocketApiGateway.websocketApi.ref}.execute-api.${Aws.REGION}.amazonaws.com/prod`

    // create lambda functions
    const connectFn = new NodejsFunction(this, 'connectFn', {
      entry: path.resolve(__dirname, "websocket-helpers", "lambda", 'connect.ts'),
      environment: {
        CONNECTIONS_TABLE: connectionsTable.tableName
      }
    })

    const disconnectFn = new NodejsFunction(this, 'disconnectFn', {
      entry: path.resolve(__dirname, "websocket-helpers", "lambda", 'disconnect.ts'),
      environment: {
        CONNECTIONS_TABLE: connectionsTable.tableName,
        PWF_GAME_TABLE_NAME: gameRoomTable.tableName,
        CONNECTION_URL: connectionUrl
      }
    })

    const defaultFn = new NodejsFunction(this, 'defaultFn', {
      entry: path.resolve(__dirname, "websocket-helpers", "lambda", 'default.ts')
    })

    const handlePWFRoom = new NodejsFunction(this, "handlePWFRoom", {
      entry: path.resolve(__dirname, "websocket-helpers", "lambda", 'handlePWFRoom.ts'),
      environment: {
        CONNECTIONS_TABLE: connectionsTable.tableName,
        PWF_GAME_TABLE_NAME: gameRoomTable.tableName,
        CONNECTION_URL: connectionUrl
      }
    })

    // allow API Gateway to call lambda functions
    websocketApiGateway.addLambdaIntegration(connectFn, 'Connect', '$connect')
    websocketApiGateway.addLambdaIntegration(disconnectFn, 'Disconnect', '$disconnect')
    websocketApiGateway.addLambdaIntegration(defaultFn, 'Default', '$default')

    websocketApiGateway.addLambdaIntegration(handlePWFRoom, 'handlePWFRoom', 'CreateJoinRoom')

    // set permission to send data back to connections 
    handlePWFRoom.addToRolePolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["execute-api:ManageConnections"],
      resources: [`arn:aws:execute-api:${Aws.REGION}:${Aws.ACCOUNT_ID}:${websocketApiGateway.websocketApi.ref}/*`]
    }));

    disconnectFn.addToRolePolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["execute-api:ManageConnections"],
      resources: [`arn:aws:execute-api:${Aws.REGION}:${Aws.ACCOUNT_ID}:${websocketApiGateway.websocketApi.ref}/*`]
    }));


    // grant DB Access
    connectionsTable.grantWriteData(connectFn)
    connectionsTable.grantReadWriteData(disconnectFn)

    connectionsTable.grantWriteData(handlePWFRoom)
    gameRoomTable.grantWriteData(handlePWFRoom)
    gameRoomTable.grantReadWriteData(disconnectFn)

    //TODO: set up reconnect endpoint if someone were to refresh their browser
  }
}