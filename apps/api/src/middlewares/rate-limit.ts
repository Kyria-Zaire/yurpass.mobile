import type { MiddlewareHandler } from 'hono'
import { getRedis } from '../lib/redis.js'
import { AppError } from './error-handler.js'

interface RateLimitOptions {
  windowMs: number
  max: number
  keyPrefix?: string
}

export function rateLimit(options: RateLimitOptions): MiddlewareHandler {
  const { windowMs, max, keyPrefix = 'rl' } = options
  const windowSec = Math.ceil(windowMs / 1000)

  return async (c, next) => {
    const ip = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown'
    const key = `${keyPrefix}:${ip}:${c.req.path}`

    const redis = getRedis()
    const current = await redis.incr(key)

    if (current === 1) {
      await redis.expire(key, windowSec)
    }

    c.header('X-RateLimit-Limit', String(max))
    c.header('X-RateLimit-Remaining', String(Math.max(0, max - current)))

    if (current > max) {
      const ttl = await redis.ttl(key)
      c.header('Retry-After', String(ttl))
      throw new AppError(
        `Trop de requêtes. Réessayez dans ${ttl} secondes.`,
        429,
        'RATE_LIMIT_EXCEEDED',
      )
    }

    await next()
  }
}

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyPrefix: 'rl:auth',
})

export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyPrefix: 'rl:api',
})
