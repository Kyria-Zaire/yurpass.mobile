import { Hono } from 'hono'
import mongoose from 'mongoose'
import { getRedis } from '../lib/redis.js'
import { logger } from '../lib/logger.js'

const health = new Hono()

interface HealthResponse {
  status: 'ok' | 'degraded'
  db: 'connected' | 'disconnected'
  redis: 'connected' | 'disconnected'
  uptime: number
}

health.get('/health', async (c) => {
  const dbState = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'

  let redisState: 'connected' | 'disconnected' = 'disconnected'
  try {
    const redis = getRedis()
    const pong = await redis.ping()
    redisState = pong === 'PONG' ? 'connected' : 'disconnected'
  } catch (error: unknown) {
    logger.warn({ error }, 'Redis health check failed')
    redisState = 'disconnected'
  }

  const isHealthy = dbState === 'connected' && redisState === 'connected'

  const response: HealthResponse = {
    status: isHealthy ? 'ok' : 'degraded',
    db: dbState,
    redis: redisState,
    uptime: process.uptime(),
  }

  return c.json(response, isHealthy ? 200 : 503)
})

export { health }
