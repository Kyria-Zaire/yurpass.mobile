import { createHmac, randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { nanoid } from 'nanoid'
import { User } from '../models/user.model.js'
import { AuditLog } from '../models/audit-log.model.js'
import { getRedis } from '../lib/redis.js'
import { logger } from '../lib/logger.js'
import { AppError } from '../middlewares/error-handler.js'
import { AuditAction, AuditResult } from '@yurpass/types'
import type { TwoFactorSetupResponse } from '@yurpass/types'

const TOTP_PERIOD = 30
const TOTP_DIGITS = 6
const BCRYPT_ROUNDS = 12

export class TwoFactorService {
  static async setup(publicId: string): Promise<TwoFactorSetupResponse> {
    const user = await User.findOne({ publicId, deletedAt: null })
    if (!user) {
      throw new AppError('Utilisateur introuvable', 404, 'NOT_FOUND')
    }

    if (user.security.twoFactorEnabled) {
      throw new AppError('2FA déjà activé', 400, '2FA_ALREADY_ENABLED')
    }

    const secret = generateBase32Secret()
    const totpURI = buildTotpURI(secret, user.email)

    // Store secret temporarily in Redis until verification
    const redis = getRedis()
    await redis.set(`2fa-setup:${publicId}`, secret, 'EX', 600)

    const backupCodes = Array.from({ length: 8 }, () => nanoid(10))

    // Store hashed backup codes temporarily
    const hashedCodes = await Promise.all(
      backupCodes.map((code) => bcrypt.hash(code, BCRYPT_ROUNDS)),
    )
    await redis.set(`2fa-backup:${publicId}`, JSON.stringify(hashedCodes), 'EX', 600)

    return { totpURI, secret, backupCodes }
  }

  static async verify(publicId: string, code: string): Promise<void> {
    const redis = getRedis()
    const secret = await redis.get(`2fa-setup:${publicId}`)
    if (!secret) {
      throw new AppError('Aucune configuration 2FA en cours. Recommencez le setup.', 400, '2FA_SETUP_EXPIRED')
    }

    const isValid = verifyTOTP(secret, code)
    if (!isValid) {
      throw new AppError('Code TOTP invalide', 401, 'INVALID_2FA_CODE')
    }

    const hashedCodesStr = await redis.get(`2fa-backup:${publicId}`)
    const hashedCodes: string[] = hashedCodesStr ? JSON.parse(hashedCodesStr) as string[] : []

    await User.updateOne(
      { publicId },
      {
        $set: {
          'security.twoFactorEnabled': true,
          'security.twoFactorSecret': secret,
          'security.backupCodes': hashedCodes,
        },
      },
    )

    await redis.del(`2fa-setup:${publicId}`)
    await redis.del(`2fa-backup:${publicId}`)

    await AuditLog.create({
      action: AuditAction.USER_2FA_ENABLED,
      userId: publicId,
      metadata: {},
      result: AuditResult.SUCCESS,
    })

    logger.info({ publicId }, '2FA enabled')
  }

  static async loginWith2FA(
    tempToken: string,
    code: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const redis = getRedis()
    const publicId = await redis.get(`2fa:${tempToken}`)
    if (!publicId) {
      throw new AppError('Token temporaire invalide ou expiré', 401, 'INVALID_TEMP_TOKEN')
    }

    const user = await User.findOne({ publicId, deletedAt: null })
    if (!user) {
      throw new AppError('Utilisateur introuvable', 404, 'NOT_FOUND')
    }

    const secret = user.security.twoFactorSecret
    if (!secret) {
      throw new AppError('2FA non configuré', 400, '2FA_NOT_CONFIGURED')
    }

    const isValid = verifyTOTP(secret, code)
    if (!isValid) {
      await AuditLog.create({
        action: AuditAction.USER_LOGIN_FAILED,
        userId: publicId,
        metadata: { reason: '2fa_invalid_code' },
        ipAddress,
        userAgent,
        result: AuditResult.FAILURE,
      })
      throw new AppError('Code 2FA invalide', 401, 'INVALID_2FA_CODE')
    }

    await redis.del(`2fa:${tempToken}`)

    const accessToken = nanoid(32)
    const refreshToken = nanoid(32)

    await redis.set(`session:${accessToken}`, publicId, 'EX', 900)
    await redis.set(`refresh:${refreshToken}`, publicId, 'EX', 2592000)

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          'security.loginAttempts': 0,
          'security.lockedUntil': null,
          'security.lastLoginAt': new Date(),
          'security.lastLoginIp': ipAddress,
        },
      },
    )

    await AuditLog.create({
      action: AuditAction.USER_LOGIN,
      userId: publicId,
      metadata: { with2FA: true },
      ipAddress,
      userAgent,
      result: AuditResult.SUCCESS,
    })

    return { accessToken, refreshToken, expiresIn: 900 }
  }
}

// ─── TOTP Implementation ─────────────────────────────────

function generateBase32Secret(): string {
  const buffer = randomBytes(20)
  return base32Encode(buffer)
}

function base32Encode(buffer: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = 0
  let value = 0
  let result = ''

  for (const byte of buffer) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      bits -= 5
      result += alphabet[(value >>> bits) & 0x1f]
    }
  }

  if (bits > 0) {
    result += alphabet[(value << (5 - bits)) & 0x1f]
  }

  return result
}

function base32Decode(encoded: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = 0
  let value = 0
  const output: number[] = []

  for (const char of encoded.toUpperCase()) {
    const idx = alphabet.indexOf(char)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      bits -= 8
      output.push((value >>> bits) & 0xff)
    }
  }

  return Buffer.from(output)
}

function buildTotpURI(secret: string, email: string): string {
  return `otpauth://totp/Yurpass:${encodeURIComponent(email)}?secret=${secret}&issuer=Yurpass&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD}`
}

function generateHOTP(secret: string, counter: number): string {
  const key = base32Decode(secret)
  const buffer = Buffer.alloc(8)
  let tmp = counter
  for (let i = 7; i >= 0; i--) {
    buffer[i] = tmp & 0xff
    tmp = tmp >>> 8
  }

  const hmac = createHmac('sha1', key).update(buffer).digest()
  const offset = hmac[hmac.length - 1]! & 0x0f
  const code =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff)

  return String(code % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0')
}

function verifyTOTP(secret: string, code: string): boolean {
  const counter = Math.floor(Date.now() / 1000 / TOTP_PERIOD)

  // Allow 1 step drift in either direction
  for (let i = -1; i <= 1; i++) {
    if (generateHOTP(secret, counter + i) === code) {
      return true
    }
  }

  return false
}
