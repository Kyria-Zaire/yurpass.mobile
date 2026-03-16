import bcrypt from 'bcryptjs'
import { nanoid } from 'nanoid'
import { Queue } from 'bullmq'
import { User } from '../models/user.model.js'
import { AuditLog } from '../models/audit-log.model.js'
import { sendEmail } from '../lib/email.js'
import { getRedis } from '../lib/redis.js'
import { env } from '../lib/env.js'
import { logger } from '../lib/logger.js'
import { verificationEmailTemplate } from '../emails/verification-email.js'
import { resetPasswordEmailTemplate } from '../emails/reset-password.js'
import { welcomeEmailTemplate } from '../emails/welcome.js'
import { AuditAction, AuditResult, UserRole, SubscriptionPlan } from '@yurpass/types'
import type { SessionUser } from '@yurpass/types'

const BCRYPT_ROUNDS = 12
const MAX_LOGIN_ATTEMPTS = 5
const LOCK_DURATION_MS = 30 * 60 * 1000
const VERIFICATION_TOKEN_TTL = 86400
const RESET_TOKEN_TTL = 3600

function getAccountQueue(): Queue {
  // BullMQ manages its own Redis connections — pass URL config
  return new Queue('account', { connection: { url: env.REDIS_URL } as never })
}

export class AuthService {
  static async register(data: {
    email: string
    password: string
    displayName: string
    city: string
  }): Promise<{ publicId: string }> {
    const existing = await User.findOne({ email: data.email, deletedAt: null })
    if (existing) {
      throw new ConflictError('Un compte avec cet email existe déjà')
    }

    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS)
    const publicId = nanoid(10)

    const user = await User.create({
      publicId,
      email: data.email,
      passwordHash,
      roles: [UserRole.GUEST],
      profile: {
        displayName: data.displayName,
        city: data.city,
      },
      reputation: { score: 0, totalRatings: 0, avgRating: 0 },
      security: {
        twoFactorEnabled: false,
        loginAttempts: 0,
      },
      subscription: { plan: SubscriptionPlan.FREE },
    })

    const token = nanoid(32)
    const redis = getRedis()
    await redis.set(`verify:${token}`, user.publicId, 'EX', VERIFICATION_TOKEN_TTL)

    const verificationUrl = `${env.BETTER_AUTH_URL}/auth/verify-email?token=${token}`
    await sendEmail({
      to: data.email,
      subject: 'Vérifiez votre email — Yurpass',
      html: verificationEmailTemplate({
        displayName: data.displayName,
        verificationUrl,
      }),
    })

    await AuditLog.create({
      action: AuditAction.USER_REGISTERED,
      userId: publicId,
      metadata: { city: data.city },
      result: AuditResult.SUCCESS,
    })

    logger.info({ publicId }, 'User registered')
    return { publicId }
  }

  static async login(data: {
    email: string
    password: string
    ipAddress?: string
    userAgent?: string
  }): Promise<{
    success: true
    tokens?: { accessToken: string; refreshToken: string; expiresIn: number }
    requires2FA?: boolean
    tempToken?: string
    user: SessionUser
  }> {
    const user = await User.findOne({ email: data.email, deletedAt: null })
    if (!user) {
      await AuditLog.create({
        action: AuditAction.USER_LOGIN_FAILED,
        metadata: { reason: 'user_not_found' },
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        result: AuditResult.FAILURE,
      })
      throw new UnauthorizedError('Email ou mot de passe incorrect')
    }

    if (user.security.lockedUntil && user.security.lockedUntil > new Date()) {
      const remainingMs = user.security.lockedUntil.getTime() - Date.now()
      const remainingMin = Math.ceil(remainingMs / 60000)
      throw new LockedError(
        `Compte temporairement bloqué. Réessayez dans ${remainingMin} minute${remainingMin > 1 ? 's' : ''}.`,
      )
    }

    const passwordValid = await bcrypt.compare(data.password, user.passwordHash)
    if (!passwordValid) {
      const attempts = user.security.loginAttempts + 1
      const updateData: Record<string, unknown> = {
        'security.loginAttempts': attempts,
      }

      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        updateData['security.lockedUntil'] = new Date(Date.now() + LOCK_DURATION_MS)
        logger.warn({ publicId: user.publicId, attempts }, 'Account locked after max login attempts')
      }

      await User.updateOne({ _id: user._id }, { $set: updateData })

      await AuditLog.create({
        action: AuditAction.USER_LOGIN_FAILED,
        userId: user.publicId,
        metadata: { attempts, locked: attempts >= MAX_LOGIN_ATTEMPTS },
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        result: AuditResult.FAILURE,
      })

      throw new UnauthorizedError('Email ou mot de passe incorrect')
    }

    if (!user.profile.verifiedAt) {
      throw new ForbiddenError('Veuillez vérifier votre adresse email avant de vous connecter')
    }

    const sensitiveRoles: UserRole[] = [UserRole.HOST, UserRole.SAM, UserRole.ADMIN]
    const hasSensitiveRole = user.roles.some((r: string) => sensitiveRoles.includes(r as UserRole))

    if (hasSensitiveRole && user.security.twoFactorEnabled) {
      const tempToken = nanoid(32)
      const redis = getRedis()
      await redis.set(`2fa:${tempToken}`, user.publicId, 'EX', 300)

      return {
        success: true,
        requires2FA: true,
        tempToken,
        user: toSessionUser(user),
      }
    }

    const tokens = await generateTokens(user.publicId)

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          'security.loginAttempts': 0,
          'security.lockedUntil': null,
          'security.lastLoginAt': new Date(),
          'security.lastLoginIp': data.ipAddress,
        },
      },
    )

    await AuditLog.create({
      action: AuditAction.USER_LOGIN,
      userId: user.publicId,
      metadata: {},
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      result: AuditResult.SUCCESS,
    })

    return { success: true, tokens, user: toSessionUser(user) }
  }

  static async verifyEmail(token: string): Promise<void> {
    const redis = getRedis()
    const publicId = await redis.get(`verify:${token}`)
    if (!publicId) {
      throw new UnauthorizedError('Token de vérification invalide ou expiré')
    }

    const user = await User.findOne({ publicId, deletedAt: null })
    if (!user) {
      throw new NotFoundError('Utilisateur introuvable')
    }

    await User.updateOne(
      { _id: user._id },
      { $set: { 'profile.verifiedAt': new Date() } },
    )

    await redis.del(`verify:${token}`)

    await sendEmail({
      to: user.email,
      subject: 'Bienvenue sur Yurpass',
      html: welcomeEmailTemplate({
        displayName: user.profile.displayName,
        loginUrl: `${env.BETTER_AUTH_URL}/login`,
      }),
    })

    await AuditLog.create({
      action: AuditAction.EMAIL_VERIFIED,
      userId: publicId,
      metadata: {},
      result: AuditResult.SUCCESS,
    })
  }

  static async refreshToken(refreshToken: string): Promise<{
    accessToken: string
    refreshToken: string
    expiresIn: number
  }> {
    const redis = getRedis()
    const publicId = await redis.get(`refresh:${refreshToken}`)
    if (!publicId) {
      throw new UnauthorizedError('Refresh token invalide ou expiré')
    }

    await redis.del(`refresh:${refreshToken}`)

    const user = await User.findOne({ publicId, deletedAt: null })
    if (!user) {
      throw new UnauthorizedError('Utilisateur introuvable')
    }

    const tokens = await generateTokens(publicId)

    await AuditLog.create({
      action: AuditAction.TOKEN_REFRESHED,
      userId: publicId,
      metadata: {},
      result: AuditResult.SUCCESS,
    })

    return tokens
  }

  static async logout(publicId: string, accessToken: string): Promise<void> {
    const redis = getRedis()
    await redis.del(`session:${accessToken}`)

    await AuditLog.create({
      action: AuditAction.USER_LOGOUT,
      userId: publicId,
      metadata: {},
      result: AuditResult.SUCCESS,
    })
  }

  static async forgotPassword(email: string): Promise<void> {
    const user = await User.findOne({ email, deletedAt: null })

    if (user) {
      const token = nanoid(32)
      const redis = getRedis()
      await redis.set(`reset:${token}`, user.publicId, 'EX', RESET_TOKEN_TTL)

      await sendEmail({
        to: email,
        subject: 'Réinitialisation mot de passe — Yurpass',
        html: resetPasswordEmailTemplate({
          displayName: user.profile.displayName,
          resetUrl: `${env.BETTER_AUTH_URL}/auth/reset-password?token=${token}`,
        }),
      })

      await AuditLog.create({
        action: AuditAction.PASSWORD_RESET_REQUESTED,
        userId: user.publicId,
        metadata: {},
        result: AuditResult.SUCCESS,
      })
    }

    // Same response whether user exists or not (prevent enumeration)
  }

  static async resetPassword(token: string, newPassword: string): Promise<void> {
    const redis = getRedis()
    const publicId = await redis.get(`reset:${token}`)
    if (!publicId) {
      throw new UnauthorizedError('Token de réinitialisation invalide ou expiré')
    }

    const user = await User.findOne({ publicId, deletedAt: null })
    if (!user) {
      throw new NotFoundError('Utilisateur introuvable')
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordHash,
          'security.loginAttempts': 0,
          'security.lockedUntil': null,
        },
      },
    )

    await redis.del(`reset:${token}`)

    await AuthService.revokeAllSessions(publicId, 'password_reset')

    await AuditLog.create({
      action: AuditAction.PASSWORD_RESET,
      userId: publicId,
      metadata: {},
      result: AuditResult.SUCCESS,
    })
  }

  static async deleteAccount(publicId: string): Promise<void> {
    await User.updateOne(
      { publicId },
      { $set: { deletedAt: new Date() } },
    )

    await AuthService.revokeAllSessions(publicId, 'account_deleted')

    const queue = getAccountQueue()
    await queue.add(
      'anonymize-account',
      { publicId },
      { delay: 30 * 24 * 60 * 60 * 1000 },
    )

    await AuditLog.create({
      action: AuditAction.ACCOUNT_DELETED,
      userId: publicId,
      metadata: {},
      result: AuditResult.SUCCESS,
    })

    logger.info({ publicId }, 'Account soft-deleted, anonymization scheduled in 30 days')
  }

  static async getMe(publicId: string): Promise<SessionUser> {
    const user = await User.findOne({ publicId, deletedAt: null })
    if (!user) {
      throw new NotFoundError('Utilisateur introuvable')
    }
    return toSessionUser(user)
  }

  static async revokeAllSessions(publicId: string, reason: string): Promise<void> {
    const redis = getRedis()
    const keys = await redis.keys(`session:*`)

    for (const key of keys) {
      const value = await redis.get(key)
      if (value === publicId) {
        await redis.del(key)
      }
    }

    logger.info({ publicId, reason }, 'All sessions revoked')
  }
}

// ─── Helpers ─────────────────────────────────────────────

async function generateTokens(publicId: string): Promise<{
  accessToken: string
  refreshToken: string
  expiresIn: number
}> {
  const accessToken = nanoid(32)
  const refreshToken = nanoid(32)
  const redis = getRedis()

  await redis.set(`session:${accessToken}`, publicId, 'EX', 900)
  await redis.set(`refresh:${refreshToken}`, publicId, 'EX', 2592000)

  return { accessToken, refreshToken, expiresIn: 900 }
}

interface UserDocument {
  publicId: string
  email: string
  roles: string[]
  profile: {
    displayName: string
    avatarUrl?: string
    bio?: string
    city: string
    verifiedAt?: Date
  }
  reputation: {
    score: number
    totalRatings: number
    avgRating: number
  }
  security: {
    twoFactorEnabled: boolean
  }
  subscription: {
    plan: string
    expiresAt?: Date
  }
  createdAt: Date
}

function toSessionUser(user: UserDocument): SessionUser {
  return {
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
}

// ─── Error classes ───────────────────────────────────────

import { AppError } from '../middlewares/error-handler.js'

class ConflictError extends AppError {
  constructor(message = 'Conflit') {
    super(message, 409, 'CONFLICT')
  }
}

class LockedError extends AppError {
  constructor(message = 'Compte temporairement bloqué') {
    super(message, 423, 'ACCOUNT_LOCKED')
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Accès refusé') {
    super(message, 403, 'FORBIDDEN')
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Non autorisé') {
    super(message, 401, 'UNAUTHORIZED')
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Introuvable') {
    super(message, 404, 'NOT_FOUND')
  }
}
