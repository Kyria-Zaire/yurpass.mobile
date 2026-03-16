import type { MiddlewareHandler } from 'hono'
import { getRedis } from '../lib/redis.js'
import { User } from '../models/user.model.js'
import { logger } from '../lib/logger.js'
import { AppError } from './error-handler.js'
import { UserRole } from '@yurpass/types'
import type { SessionUser } from '@yurpass/types'

declare module 'hono' {
  interface ContextVariableMap {
    user: SessionUser
    accessToken: string
  }
}

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError('Token d\'authentification requis', 401, 'UNAUTHORIZED')
  }

  const token = authHeader.slice(7)
  const redis = getRedis()
  const publicId = await redis.get(`session:${token}`)

  if (!publicId) {
    throw new AppError('Session invalide ou expirée', 401, 'SESSION_EXPIRED')
  }

  const user = await User.findOne(
    { publicId, deletedAt: null },
    { passwordHash: 0, 'security.twoFactorSecret': 0 },
  )

  if (!user) {
    throw new AppError('Utilisateur introuvable', 401, 'UNAUTHORIZED')
  }

  const sessionUser: SessionUser = {
    publicId: user.publicId,
    email: user.email,
    roles: user.roles as UserRole[],
    profile: {
      displayName: user.profile.displayName,
      avatarUrl: user.profile.avatarUrl,
      bio: user.profile.bio,
      city: user.profile.city,
      verifiedAt: user.profile.verifiedAt,
    },
    reputation: {
      score: user.reputation.score,
      totalRatings: user.reputation.totalRatings,
      avgRating: user.reputation.avgRating,
    },
    security: {
      twoFactorEnabled: user.security.twoFactorEnabled,
    },
    subscription: {
      plan: user.subscription.plan,
      expiresAt: user.subscription.expiresAt,
    },
    createdAt: user.createdAt,
  }

  c.set('user', sessionUser)
  c.set('accessToken', token)

  logger.debug({ publicId }, 'Authenticated request')
  await next()
}

export function requireRole(roles: UserRole[]): MiddlewareHandler {
  return async (c, next) => {
    const user = c.get('user')
    const hasRole = user.roles.some((r: UserRole) => roles.includes(r))

    if (!hasRole) {
      throw new AppError('Accès refusé — rôle insuffisant', 403, 'FORBIDDEN')
    }

    await next()
  }
}

export const require2FA: MiddlewareHandler = async (c, next) => {
  const user = c.get('user')
  const sensitiveRoles: UserRole[] = [UserRole.HOST, UserRole.SAM, UserRole.ADMIN]
  const hasSensitiveRole = user.roles.some((r: UserRole) => sensitiveRoles.includes(r))

  if (hasSensitiveRole && !user.security.twoFactorEnabled) {
    throw new AppError(
      '2FA requis pour ce rôle. Activez la double authentification.',
      403,
      '2FA_REQUIRED',
    )
  }

  await next()
}
