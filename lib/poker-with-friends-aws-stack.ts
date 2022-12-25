import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct, Node } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Table, AttributeType } from 'aws-cdk-lib/aws-dynamodb';
import * as path from 'path';

import { PWFApi } from './websocket-helpers/api-gateway/PWFApi';

export class PokerWithFriendsAwsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // create PWF Game database
    const table = new Table(this, 'PWFGameRooms', {
      partitionKey: { name: 'RoomId', type: AttributeType.STRING }
    });

    //TODO: Update connect & disconnect functions
    // create lambda functions
    const connectFn = new NodejsFunction(this, 'connectFn', {
      entry: path.resolve(__dirname, "websocket-helpers", "lambda", 'connect.ts')
    })

    const disconnectFn = new NodejsFunction(this, 'disconnectFn', {
      entry: path.resolve(__dirname, "websocket-helpers", "lambda", 'disconnect.ts')
    })

    const defaultFn = new NodejsFunction(this, 'defaultFn', {
      entry: path.resolve(__dirname, "websocket-helpers", "lambda", 'default.ts')
    })

    const handlePWFRoom = new NodejsFunction(this, "handlePWFRoom", {
      entry: path.resolve(__dirname, "websocket-helpers", "lambda", 'handlePWFRoom.ts'),
      environment: {
        PWF_TABLE_NAME: table.tableName,
      }
    })

    // create API Gateway
    new PWFApi(this, 'PWFApi', {
      table,
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
        {
          func: handlePWFRoom,
          operationName: 'handlePWFRoom',
          routeKey: 'CreateJoinRoom'
        },
      ],
      dbAccessLambdaFns:[handlePWFRoom]
    })
  }
}