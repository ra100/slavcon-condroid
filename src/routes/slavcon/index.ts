import { FastifyPluginAsync } from 'fastify'
import { getCondroidFormat } from './loadProgram'

const slavcon: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get<{ Params: { year: string } }>('/:year', async function (request, reply) {
    const program = await getCondroidFormat(parseInt(request.params.year, 10))

    reply.header('Content-Type', 'application/xml')
    reply.type('application/xml; charset=utf-8')
    return program
  })
}

export default slavcon
