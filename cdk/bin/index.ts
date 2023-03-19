import { App } from 'aws-cdk-lib'

import { SlavconCondroidStack } from '../lib/stack'

const app = new App()
new SlavconCondroidStack(app, 'SlavconCondroidStack')
