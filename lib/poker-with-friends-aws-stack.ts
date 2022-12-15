import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';

import { PWFApi } from './websocket-helpers/api-gateway/PWFApi';

export class PokerWithFriendsAwsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);


    //TODO: Update connect & disconnect functions
    // create lambda functions
    // connect function
    const connectFn = new NodejsFunction(this, 'connectFn', {
      entry: path.resolve(__dirname, "websocket-helpers", "lambda", 'hello.function.ts')
    })

    // disconnect function
    const disconnectFn = new NodejsFunction(this, 'disconnectFn', {
      entry: path.resolve(__dirname, "websocket-helpers", "lambda", 'hello.function.ts')
    })

    // create API Gateway
    new PWFApi(this, 'PWFApi', {
      connectFn,
      disconnectFn
    })
  }
}