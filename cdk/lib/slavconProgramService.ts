import path = require('node:path')

import { LambdaIntegration, Period, RestApi } from 'aws-cdk-lib/aws-apigateway'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { Runtime } from 'aws-cdk-lib/aws-lambda'
import { RetentionDays } from 'aws-cdk-lib/aws-logs'
import { Duration } from 'aws-cdk-lib'
import { Construct } from 'constructs'

export const getStatusLambda = (scope: Construct): NodejsFunction =>
  new NodejsFunction(scope, 'SlavconProgramHandler', {
    entry: path.resolve(__dirname, '../..', 'src/lambda.ts'),
    handler: 'handler',
    runtime: Runtime.NODEJS_22_X,
    logRetention: RetentionDays.TWO_WEEKS,
    timeout: Duration.minutes(1),
    memorySize: 128
  })

export const getApiGateway = (scope: Construct, lambda: NodejsFunction): RestApi => {
  const api = new RestApi(scope, 'slavcon-prorgam-api', {
    restApiName: 'Slavcon Program Service',
    description: 'This service converts SlavCon JSON to Condroid XML or other formats.'
  })

  const scheduleLambda = new LambdaIntegration(lambda, {
    requestTemplates: { 'application/xml': '{ "statusCode": "200" }' }
  })

  api.root.addProxy({ defaultIntegration: scheduleLambda })

  api.addUsagePlan('slavcon-program-usage-plan', {
    quota: { limit: 24 * 60 * 60, period: Period.DAY },
    throttle: { rateLimit: 1, burstLimit: 5 }
  })

  return api
}

export class SlavconProgramService extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id)

    const slavconCondroidLambda = getStatusLambda(this)

    getApiGateway(this, slavconCondroidLambda)
  }
}
