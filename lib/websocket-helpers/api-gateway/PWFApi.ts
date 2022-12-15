import { Construct } from 'constructs';
import { aws_apigatewayv2 as apigateway, Aws } from 'aws-cdk-lib';
import { ServicePrincipal } from "aws-cdk-lib/aws-iam";

import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';

export class PWFApi extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id)

    // create websocket API
    const websocketApi = new apigateway.CfnApi(this, 'PWFWebsocketApi', {
      name: 'PWF Websocket API',
      description: `API for PWF websocket`,
      protocolType: 'WEBSOCKET',
      routeSelectionExpression: '$request.body.action',
      tags: { app: 'PWF' },
    })

    //TODO: for staging and deployment API, want to dynamically change stageName for CI/CD
    // create deployment for API
    const websocketDeployment = new apigateway.CfnDeployment(this, 'PWFWebsocketDeployment', {
      apiId: websocketApi.ref,
    })

    // create staging for API
    new apigateway.CfnStage(this, 'PWFWebSocketStage', {
      apiId: websocketApi.ref,
      stageName: 'prod',
      deploymentId: websocketDeployment.ref
    })

    //TODO: isolate Node functions
    // connect function
    const connectFn = new NodejsFunction(this, 'connectFn', {
      entry: path.resolve(__dirname, "..", "lambda", 'hello.function.ts')
    })

    // disconnect function
    const disconnectFn = new NodejsFunction(this, 'disconnectFn', {
      entry: path.resolve(__dirname, "..", "lambda", 'hello.function.ts')
    })

    // grant invoke permissions on functions
    connectFn.grantInvoke(new ServicePrincipal('apigateway.amazonaws.com'));
    disconnectFn.grantInvoke(new ServicePrincipal('apigateway.amazonaws.com'));

    
    // integrate routes to endpoints
    const connectIntegration = new apigateway.CfnIntegration(this, 'PWFConnectIntegration', {
      apiId: websocketApi.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: `arn:aws:apigateway:${Aws.REGION}:lambda:path/2015-03-31/functions/${connectFn.functionArn}/invocations`
    })

    const disconnectIntegration = new apigateway.CfnIntegration(this, 'PWFDisconnectIntegration', {
      apiId: websocketApi.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: `arn:aws:apigateway:${Aws.REGION}:lambda:path/2015-03-31/functions/${disconnectFn.functionArn}/invocations`
    })


    //TODO: routes need validation for authorization type
    // define connect route
    const connectRoute = new apigateway.CfnRoute(this, 'PWFconnect', {
      apiId: websocketApi.ref,
      routeKey: '$connect',
      authorizationType: 'NONE',
      operationName: 'Connect',
      target: `integrations/${connectIntegration.ref}`
    })

    // define disconnect route
    const disconnectRoute = new apigateway.CfnRoute(this, 'PWFdisconnect', {
      apiId: websocketApi.ref,
      routeKey: '$disconnect',
      authorizationType: 'NONE',
      operationName: 'Disconnect',
      target: `integrations/${disconnectIntegration.ref}`
    })

    // ensure lambda functions are created before integration & deployment
    websocketDeployment.addDependsOn(connectRoute)
    websocketDeployment.addDependsOn(disconnectRoute)
  }
}