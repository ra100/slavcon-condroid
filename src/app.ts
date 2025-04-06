import { AutoloadPluginOptions } from '@fastify/autoload'
import { FastifyPluginAsync } from 'fastify'
import sensible from './plugins/sensible'
import root from './routes/root'
import condroid from './routes/condroid'
import conbot from './routes/conbot'

export type AppOptions = {
  // Place your custom options for app below here.
} & Partial<AutoloadPluginOptions>

// Pass --options via CLI arguments in command to enable these options.
const options: AppOptions = {}

const app: FastifyPluginAsync<AppOptions> = async (fastify, opts): Promise<void> => {
  sensible(fastify)
  root(fastify, opts)
  condroid(fastify, opts)
  conbot(fastify, opts)
}

export default app
export { app, options }
