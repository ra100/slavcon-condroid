import awsLambdaFastify from '@fastify/aws-lambda'
import { app } from './app'
import fastify from 'fastify'

const server = fastify({
  logger: true
})
server.register(app)

export const handler = awsLambdaFastify(server)
