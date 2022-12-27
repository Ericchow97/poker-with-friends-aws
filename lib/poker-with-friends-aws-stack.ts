import { Stack, StackProps, Aws } from 'aws-cdk-lib';
import { Construct, Node } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Table, AttributeType } from 'aws-cdk-lib/aws-dynamodb';
import { PolicyStatement, Effect } from "aws-cdk-lib/aws-iam";
import * as path from 'path';

import { PWFApi } from './websocket-helpers/api-gateway/PWFApi';

export class PokerWithFriendsAwsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // create connections table
    const connectionsTable = new Table(this, 'ConnectionsTable', {
      partitionKey: { name: 'ConnectionId', type: AttributeType.STRING }
    })

    // create PWF Game database
    const gameRoomTable = new Table(this, 'PWFGameRooms', {
      partitionKey: { name: 'RoomId', type: AttributeType.STRING }
    });

    //TODO: Update connect & disconnect functions
    // create base lambda functions
    const connectFn = new NodejsFunction(this, 'connectFn', {
      entry: path.resolve(__dirname, "websocket-helpers", "lambda", 'connect.ts'),
      environment: {
        CONNECTIONS_TABLE: connectionsTable.tableName
      }
    })

    const disconnectFn = new NodejsFunction(this, 'disconnectFn', {
      entry: path.resolve(__dirname, "websocket-helpers", "lambda", 'disconnect.ts')
    })

    const defaultFn = new NodejsFunction(this, 'defaultFn', {
      entry: path.resolve(__dirname, "websocket-helpers", "lambda", 'default.ts')
    })

    // create API Gateway
    const websocketApiGateway = new PWFApi(this, 'PWFApi', {
      table: gameRoomTable,
      lambdaFns: [
        {
          func: connectFn,
          operationName: 'Connect',
          routeKey: '$connect'
        },
        {
          func: disconnectFn,
          operationName: 'Disconnect',
          routeKey: '$disconnect'
        },
        {
          func: defaultFn,
          operationName: 'Default',
          routeKey: '$default'
        },

      ],
      dbAccessLambdaFns: []
    })

    // Create custom lambda functions
    const handlePWFRoom = new NodejsFunction(this, "handlePWFRoom", {
      entry: path.resolve(__dirname, "websocket-helpers", "lambda", 'handlePWFRoom.ts'),
      environment: {
        PWF_TABLE_NAME: gameRoomTable.tableName,
        CONNECTION_URL: `https://${websocketApiGateway.websocketApi.ref}.execute-api.${Aws.REGION}.amazonaws.com/prod`
      }
    })

    // allow lambda access and db write access
    websocketApiGateway.addLambdaIntegration(handlePWFRoom, 'handlePWFRoom', 'CreateJoinRoom')

    // set permission to send data back to connections 
    handlePWFRoom.addToRolePolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["execute-api:ManageConnections"],
      resources: [`arn:aws:execute-api:${Aws.REGION}:${Aws.ACCOUNT_ID}:${websocketApiGateway.websocketApi.ref}/*`]
    }));




    // grant DB Access
    connectionsTable.grantWriteData(connectFn)
    connectionsTable.grantReadData(disconnectFn)

    connectionsTable.grantReadData(handlePWFRoom)
    gameRoomTable.grantWriteData(handlePWFRoom)

  }
}