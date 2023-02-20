import * as cdk from 'aws-cdk-lib';
import { APIGatewayEvent } from 'aws-lambda';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { PokerWithFriendsAwsStack } from '../lib/poker-with-friends-aws-stack';
import { dbClient } from '../lib/class-helpers/dbClient';
import { ApiGatewayClient } from '../lib/class-helpers/ApiGatewayClient';
import { handler as connectFn } from '../lib/websocket-helpers/lambda/connect';
import { handler as disconnectFn } from '../lib/websocket-helpers/lambda/disconnect';

describe("PokerWithFriendsAwsStack", () => {
  test("test AWS stack creation", () => {
    const app = new cdk.App();
    const stack = new PokerWithFriendsAwsStack(app, 'PokerWithFriendsAwsStack');

    // Prepare the stack for assertions.
    const template = Template.fromStack(stack);

    template.resourceCountIs('AWS::ApiGatewayV2::Api', 1)
    template.resourceCountIs('AWS::DynamoDB::Table', 2)

    // Each Lambda Function must have an API Integration & route 
    template.resourceCountIs('AWS::Lambda::Function', 4)
    template.resourceCountIs('AWS::ApiGatewayV2::Integration', 4)
    template.resourceCountIs('AWS::ApiGatewayV2::Route', 4)

    // APIGateway must be dependent on Lambda function 
    template.hasResource("AWS::ApiGatewayV2::Deployment", {
      DependsOn: Match.arrayWith([
        "PWFApiPWFConnectB2B522C2",
        "PWFApiPWFDefault21122B6E",
        "PWFApiPWFDisconnectA7BA05FC",
        "PWFApiPWFhandlePWFRoomBAB50D36"
      ])
    })

    // Create Connections Table
    template.hasResourceProperties("AWS::DynamoDB::Table", {
      KeySchema: [{
        AttributeName: "ConnectionId",
        KeyType: "HASH"
      }]
    })

    // Create Active Game Rooms Table
    template.hasResourceProperties("AWS::DynamoDB::Table", {
      KeySchema: [{
        AttributeName: "RoomId",
        KeyType: "HASH"
      }]
    })

    // Create AWS ApiGateway
    template.hasResourceProperties("AWS::DynamoDB::Table", {
      KeySchema: [{
        AttributeName: "ConnectionId",
        KeyType: "HASH"
      }]
    })

  })
})

describe("PokerWithFriendsConnect", () => {
  beforeEach(() => { jest.restoreAllMocks() })

  test("Successful connect", async () => {
    // override db call implementation
    jest.spyOn(dbClient, 'send').mockImplementation(() => Promise.resolve({}));

    const event: APIGatewayEvent = {
      requestContext: {
        connectionId: '1'
      }
    } as any
    const actualValue = await connectFn(event);
    expect(actualValue).toEqual(
      {
        statusCode: 200,
        body: JSON.stringify({
          connectionStatus: "CONNECTED",
        })
      }
    );
  })

  test("Unsuccessful connect", async () => {
    jest.spyOn(dbClient, 'send').mockImplementation(() => Promise.reject({}));

    const event: APIGatewayEvent = {} as any
    const actualValue = await connectFn(event);
    expect(actualValue).toEqual(
      {
        statusCode: 400,
        body: JSON.stringify({
          message: "Error in creating connection",
        })
      }
    );
  })

})

describe("PokerWithFriendsDisconnect", () => {
  beforeEach(() => { jest.restoreAllMocks() })

  test("Successful disconnect w/ more than one player left", async () => {
    const apiGatewayClient = new ApiGatewayClient(
      process.env.AWS_REGION!,
      process.env.CONNECTION_URL!
    )
    // override db call implementation
    jest.spyOn(dbClient, 'send')
      .mockImplementationOnce(() => Promise.resolve({ Item: { userInfo: { RoomId: 1 } } }))
      .mockImplementationOnce(() => Promise.resolve({
        Item: {
          Connections: [
            { connectionId: 1 }, { connectionId: 2 }, { connectionId: 3 }
          ]
        }
      }))
      .mockImplementationOnce(() => Promise.resolve({
        Attributes: {
          Connections: [
            { connectionId: 1 }, { connectionId: 2 }, { connectionId: 3 }
          ]
        }
      }))
      .mockImplementationOnce(() => Promise.resolve({}));

    jest.spyOn(apiGatewayClient, 'postToConnections').mockImplementation(() => Promise.resolve())

    const event: APIGatewayEvent = {
      requestContext: {
        connectionId: '1'
      }
    } as any
    const actualValue = await disconnectFn(event);
    expect(actualValue).toEqual(
      {
        statusCode: 200,
        body: JSON.stringify({
          connectionStatus: "DISCONNECTED",
        })
      }
    );
  })

  test("Successful disconnect as last player", async () => {
    // override db call implementation
    jest.spyOn(dbClient, 'send')
      .mockImplementationOnce(() => Promise.resolve({ Item: { userInfo: { RoomId: 1 } } }))
      .mockImplementationOnce(() => Promise.resolve({ Item: { Connections: [{ connectionId: 1 }] } }))
      .mockImplementationOnce(() => Promise.resolve({}))
      .mockImplementationOnce(() => Promise.resolve({}));

    const event: APIGatewayEvent = {
      requestContext: {
        connectionId: '1'
      }
    } as any
    const actualValue = await disconnectFn(event);
    expect(actualValue).toEqual(
      {
        statusCode: 200,
        body: JSON.stringify({
          connectionStatus: "DISCONNECTED",
        })
      }
    );
  })

  test("Unsuccessful connect", async () => {
    jest.spyOn(dbClient, 'send').mockImplementation(() => Promise.reject({}));

    const event: APIGatewayEvent = {} as any
    const actualValue = await connectFn(event);
    expect(actualValue).toEqual(
      {
        statusCode: 400,
        body: JSON.stringify({
          message: "Error in creating connection",
        })
      }
    );
  })

})