import { AutoloadPluginOptions } from '@fastify/autoload'
import { FastifyPluginAsync } from 'fastify'
import sensible from './plugins/sensible'
import root from './routes/root'
import slavcon from './routes/slavcon'

export type AppOptions = {
  // Place your custom options for app below here.
} & Partial<AutoloadPluginOptions>

// Pass --options via CLI arguments in command to enable these options.
const options: AppOptions = {}

const app: FastifyPluginAsync<AppOptions> = async (fastify, opts): Promise<void> => {
  sensible(fastify, opts)
  root(fastify, opts)
  slavcon(fastify, opts)
}

export default app
export { app, options }
