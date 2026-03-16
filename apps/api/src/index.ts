import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { env } from './lib/env.js'
import { logger } from './lib/logger.js'
import { connectDB, setupGracefulShutdown } from './lib/db.js'
import { connectRedis } from './lib/redis.js'
import { requestLogger } from './middlewares/logger.js'
import { health } from './routes/health.js'

const app = new Hono()

app.use('*', requestLogger)
app.route('/', health)

async function bootstrap(): Promise<void> {
  try {
    await connectDB(env.MONGODB_URI)
    connectRedis(env.REDIS_URL)
    setupGracefulShutdown()

    serve({ fetch: app.fetch, port: env.PORT }, (info) => {
      logger.info({ port: info.port }, `Yurpass API running on port ${info.port}`)
    })
  } catch (error: unknown) {
    logger.fatal({ error }, 'Failed to start Yurpass API')
    process.exit(1)
  }
}

void bootstrap()

export default app
