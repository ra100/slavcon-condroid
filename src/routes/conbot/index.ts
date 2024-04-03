import { FastifyPluginAsync } from 'fastify'
import { getConbotFormat } from './conbot'

const conbot: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get<{ Params: { year: string } }>('/conbot/:year', async function (request, reply) {
    const program = await getConbotFormat(parseInt(request.params.year, 10))

    reply.header('Content-Type', 'application/xml')
    reply.type('application/xml; charset=utf-8')
    return program
  })
}

export default conbot
