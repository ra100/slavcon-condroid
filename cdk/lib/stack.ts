import { Stack, StackProps } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { CondroidService } from './condroidService'

export class SlavconCondroidStack extends Stack {
  constructor(scope: Construct, id: string, properties?: StackProps) {
    super(scope, id, properties)

    new CondroidService(this, 'Condroid')
  }
}
