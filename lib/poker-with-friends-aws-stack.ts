import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
// import { HelloWorld } from './websocket-helpers/lambda/hello';
import { PWFApi } from './websocket-helpers/api-gateway/PWFApi';

export class PokerWithFriendsAwsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    // new HelloWorld(this, 'hello-world');
    new PWFApi(this, 'PWFApi')
  }
}