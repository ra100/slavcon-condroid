import path = require('node:path')

import { LambdaIntegration, Period, RestApi } from 'aws-cdk-lib/aws-apigateway'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { Runtime } from 'aws-cdk-lib/aws-lambda'
import { RetentionDays } from 'aws-cdk-lib/aws-logs'
import { Duration } from 'aws-cdk-lib'
import { Construct } from 'constructs'

export const getStatusLambda = (scope: Construct): NodejsFunction =>
  new NodejsFunction(scope, 'CreditsStatusHandler', {
    entry: path.resolve(__dirname, '../..', 'src/lambda.ts'),
    handler: 'handler',
    runtime: Runtime.NODEJS_18_X,
    logRetention: RetentionDays.TWO_WEEKS,
    timeout: Duration.minutes(1),
    memorySize: 128
  })

export const getApiGateway = (scope: Construct, lambda: NodejsFunction): RestApi => {
  const api = new RestApi(scope, 'slavcon-condroid-api', {
    restApiName: 'Slavcon Condroid Service',
    description: 'This service converts SlavCon JSON to Condroid XML.'
  })

  const scheduleLambda = new LambdaIntegration(lambda, {
    requestTemplates: { 'application/xml': '{ "statusCode": "200" }' }
  })

  api.root.addProxy({ defaultIntegration: scheduleLambda })

  api.addUsagePlan('slavcon-condroid-usage-plan', {
    quota: { limit: 240, period: Period.DAY },
    throttle: { rateLimit: 1, burstLimit: 5 }
  })

  return api
}

export class CondroidService extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id)

    const slavconCondroidLambda = getStatusLambda(this)

    getApiGateway(this, slavconCondroidLambda)
  }
}
