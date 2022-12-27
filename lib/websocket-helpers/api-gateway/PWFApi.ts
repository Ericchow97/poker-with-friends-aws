import { Construct } from 'constructs';
import { IFunction } from "aws-cdk-lib/aws-lambda";
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { aws_apigatewayv2 as apigateway, Aws } from 'aws-cdk-lib';
import { ServicePrincipal } from "aws-cdk-lib/aws-iam";

export class PWFApi extends Construct {
  readonly websocketApi: apigateway.CfnApi;
  readonly websocketDeployment: apigateway.CfnDeployment;
  readonly table: Table

  constructor(scope: Construct, id: string) {
    super(scope, id)

    // create websocket API
    this.websocketApi = new apigateway.CfnApi(this, 'PWFWebsocketApi', {
      name: 'PWF Websocket API',
      description: `API for PWF websocket`,
      protocolType: 'WEBSOCKET',
      routeSelectionExpression: '$request.body.action',
      tags: { app: 'PWF' },
    })

    //TODO: for staging and deployment API, want to dynamically change stageName for CI/CD
    // create deployment for API
    this.websocketDeployment = new apigateway.CfnDeployment(this, 'PWFWebsocketDeployment', {
      apiId: this.websocketApi.ref,
    })

    // create staging for API
    new apigateway.CfnStage(this, 'PWFWebSocketStage', {
      apiId: this.websocketApi.ref,
      stageName: 'prod',
      deploymentId: this.websocketDeployment.ref
    })
  }

  // Create endpoint and allows lambda functions to be called by websocket
  addLambdaIntegration(fn: IFunction, operationName: string, routeKey: string) {
    // integrate routes to endpoints
    const integration = new apigateway.CfnIntegration(this, `PWF${operationName}Integration`, {
      apiId: this.websocketApi.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: `arn:aws:apigateway:${Aws.REGION}:lambda:path/2015-03-31/functions/${fn.functionArn}/invocations`
    })

    // grant invoke permissions on functions
    fn.grantInvoke(new ServicePrincipal('apigateway.amazonaws.com', {
      conditions: {
        "ArnLike": {
          "aws:SourceArn": `arn:aws:execute-api:${Aws.REGION}:${Aws.ACCOUNT_ID}:${this.websocketApi.ref}/*/*`
        }
      }
    }));

    // define connection route
    const route = new apigateway.CfnRoute(this, `PWF${operationName}`, {
      apiId: this.websocketApi.ref,
      routeKey: routeKey,
      authorizationType: 'NONE',
      operationName: operationName,
      target: `integrations/${integration.ref}`
    })

    // ensure lambda functions are created before integration & deployment
    this.websocketDeployment.addDependsOn(route)
  }
}