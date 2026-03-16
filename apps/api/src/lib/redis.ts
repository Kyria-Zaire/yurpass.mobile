import Redis from 'ioredis'
import { logger } from './logger.js'

let redisClient: Redis | null = null

export function connectRedis(url: string): Redis {
  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    retryStrategy(times: number): number | null {
      if (times > 5) {
        logger.fatal({ times }, 'Redis max retries reached')
        return null
      }
      return Math.min(times * 200, 2000)
    },
  })

  client.on('connect', () => {
    logger.info('Redis connected')
  })

  client.on('error', (error: unknown) => {
    logger.error({ error }, 'Redis connection error')
  })

  redisClient = client
  return client
}

export function getRedis(): Redis {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call connectRedis() first.')
  }
  return redisClient
}
