import awsLambdaFastify, { PromiseHandler } from '@fastify/aws-lambda'
import { app } from './app'
import fastify from 'fastify'

export const handler: PromiseHandler<any, any> = async (event, context) => {
  const fastifyInstance = fastify()
  await app(fastifyInstance, {})

  return awsLambdaFastify(fastifyInstance)(event, context)
}
