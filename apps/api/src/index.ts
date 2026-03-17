import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { env } from './lib/env.js'
import { logger } from './lib/logger.js'
import { connectDB, setupGracefulShutdown } from './lib/db.js'
import { connectRedis } from './lib/redis.js'
import { requestLogger } from './middlewares/logger.js'
import { health } from './routes/health.js'
import { authRoutes } from './routes/auth.routes.js'
import { rolesRoutes } from './routes/roles.routes.js'
import { eventsRoutes } from './routes/events.routes.js'
import { guestsRoutes } from './routes/guests.routes.js'
import { meRoutes } from './routes/me.routes.js'
import { createAccountWorker } from './workers/account.worker.js'
import { createNotificationWorker } from './workers/notification.worker.js'
import { createNotificationCron } from './workers/notification-cron.js'

const app = new Hono()

app.use('*', requestLogger)
app.route('/', health)
app.route('/auth', authRoutes)
app.route('/roles', rolesRoutes)
app.route('/events', eventsRoutes)
app.route('/events', guestsRoutes)
app.route('/me', meRoutes)

async function bootstrap(): Promise<void> {
  try {
    await connectDB(env.MONGODB_URI)
    const redis = connectRedis(env.REDIS_URL)
    setupGracefulShutdown()

    // Wait for Redis to be ready before starting the worker
    await new Promise<void>((resolve, reject) => {
      if (redis.status === 'ready') {
        resolve()
        return
      }
      redis.once('ready', resolve)
      redis.once('error', reject)
    })
    logger.info('Redis ready')

    try {
      createAccountWorker()
      logger.info('Account worker started')
    } catch (workerError: unknown) {
      logger.warn({ workerError }, 'Account worker failed to start — running without background jobs')
    }

    try {
      createNotificationWorker()
      logger.info('Notification worker started')
      createNotificationCron()
      logger.info('Notification cron started')
    } catch (workerError: unknown) {
      logger.warn({ workerError }, 'Notification workers failed to start — running without push notifications')
    }

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
