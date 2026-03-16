import { describe, it, expect, vi, beforeEach } from 'vitest'
import bcrypt from 'bcryptjs'
import { UserRole, SubscriptionPlan, AuditAction, AuditResult } from '@yurpass/types'

// ─── Mocks ──────────────────────────────────────────────

const mockRedis = {
  set: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
  keys: vi.fn().mockResolvedValue([]),
  incr: vi.fn(),
  expire: vi.fn(),
  ttl: vi.fn(),
}

const mockUserDoc = {
  _id: 'mongo-id-123',
  publicId: 'abc123',
  email: 'test@yurpass.com',
  passwordHash: '',
  roles: [UserRole.GUEST],
  profile: {
    displayName: 'Test User',
    city: 'Paris',
    verifiedAt: new Date(),
  },
  reputation: { score: 0, totalRatings: 0, avgRating: 0 },
  security: {
    twoFactorEnabled: false,
    loginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    lastLoginIp: null,
  },
  subscription: { plan: SubscriptionPlan.FREE },
  createdAt: new Date(),
}

const mockUser = {
  findOne: vi.fn(),
  create: vi.fn(),
  updateOne: vi.fn(),
}

const mockAuditLog = {
  create: vi.fn(),
}

vi.mock('../../lib/redis.js', () => ({
  getRedis: () => mockRedis,
}))

vi.mock('../../lib/email.js', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../lib/env.js', () => ({
  env: {
    BETTER_AUTH_URL: 'http://localhost:3000',
  },
}))

vi.mock('../../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('../../models/user.model.js', () => ({
  User: {
    findOne: (...args: unknown[]) => mockUser.findOne(...args),
    create: (...args: unknown[]) => mockUser.create(...args),
    updateOne: (...args: unknown[]) => mockUser.updateOne(...args),
  },
}))

vi.mock('../../models/audit-log.model.js', () => ({
  AuditLog: {
    create: (...args: unknown[]) => mockAuditLog.create(...args),
  },
}))

vi.mock('bullmq', () => {
  const MockQueue = class {
    add = vi.fn()
  }
  return { Queue: MockQueue }
})

vi.mock('nanoid', () => ({
  nanoid: (n?: number) => 'x'.repeat(n ?? 21),
}))

// ─── Import after mocks ─────────────────────────────────

const { AuthService } = await import('../auth.service.js')

// ─── Tests ──────────────────────────────────────────────

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('register', () => {
    it('should register a new user', async () => {
      mockUser.findOne.mockResolvedValue(null)
      mockUser.create.mockResolvedValue({ publicId: 'xxxxxxxxxx' })
      mockRedis.set.mockResolvedValue('OK')

      const result = await AuthService.register({
        email: 'new@yurpass.com',
        password: 'SecurePass123!',
        displayName: 'New User',
        city: 'Paris',
      })

      expect(result.publicId).toBeDefined()
      expect(mockUser.create).toHaveBeenCalledOnce()
      expect(mockRedis.set).toHaveBeenCalled()
      expect(mockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.USER_REGISTERED,
          result: AuditResult.SUCCESS,
        }),
      )
    })

    it('should throw ConflictError if email already exists', async () => {
      mockUser.findOne.mockResolvedValue(mockUserDoc)

      await expect(
        AuthService.register({
          email: 'test@yurpass.com',
          password: 'SecurePass123!',
          displayName: 'Test',
          city: 'Paris',
        }),
      ).rejects.toThrow('Un compte avec cet email existe déjà')
    })
  })

  describe('login', () => {
    it('should throw UnauthorizedError for unknown email', async () => {
      mockUser.findOne.mockResolvedValue(null)

      await expect(
        AuthService.login({ email: 'nope@yurpass.com', password: 'pass' }),
      ).rejects.toThrow('Email ou mot de passe incorrect')

      expect(mockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.USER_LOGIN_FAILED,
          result: AuditResult.FAILURE,
        }),
      )
    })

    it('should throw LockedError if account is locked', async () => {
      mockUser.findOne.mockResolvedValue({
        ...mockUserDoc,
        security: {
          ...mockUserDoc.security,
          lockedUntil: new Date(Date.now() + 1800000),
        },
      })

      await expect(
        AuthService.login({ email: 'test@yurpass.com', password: 'pass' }),
      ).rejects.toThrow(/Compte temporairement bloqué/)
    })

    it('should throw UnauthorizedError for wrong password and increment attempts', async () => {
      mockUser.findOne.mockResolvedValue({
        ...mockUserDoc,
        passwordHash: await bcrypt.hash('CorrectPassword', 4),
      })
      mockUser.updateOne.mockResolvedValue({})

      await expect(
        AuthService.login({ email: 'test@yurpass.com', password: 'WrongPassword' }),
      ).rejects.toThrow('Email ou mot de passe incorrect')

      expect(mockUser.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({ _id: mockUserDoc._id }),
        expect.objectContaining({
          $set: expect.objectContaining({
            'security.loginAttempts': 1,
          }),
        }),
      )
    })

    it('should lock account after 5 failed attempts', async () => {
      mockUser.findOne.mockResolvedValue({
        ...mockUserDoc,
        passwordHash: await bcrypt.hash('CorrectPassword', 4),
        security: { ...mockUserDoc.security, loginAttempts: 4 },
      })
      mockUser.updateOne.mockResolvedValue({})

      await expect(
        AuthService.login({ email: 'test@yurpass.com', password: 'WrongPassword' }),
      ).rejects.toThrow('Email ou mot de passe incorrect')

      expect(mockUser.updateOne).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          $set: expect.objectContaining({
            'security.loginAttempts': 5,
            'security.lockedUntil': expect.any(Date),
          }),
        }),
      )
    })

    it('should throw ForbiddenError if email not verified', async () => {
      const hash = await bcrypt.hash('MyPassword', 4)
      mockUser.findOne.mockResolvedValue({
        ...mockUserDoc,
        passwordHash: hash,
        profile: { ...mockUserDoc.profile, verifiedAt: undefined },
      })

      await expect(
        AuthService.login({ email: 'test@yurpass.com', password: 'MyPassword' }),
      ).rejects.toThrow('Veuillez vérifier votre adresse email')
    })

    it('should return tokens for valid login without 2FA', async () => {
      const hash = await bcrypt.hash('MyPassword', 4)
      mockUser.findOne.mockResolvedValue({
        ...mockUserDoc,
        passwordHash: hash,
      })
      mockUser.updateOne.mockResolvedValue({})
      mockRedis.set.mockResolvedValue('OK')

      const result = await AuthService.login({
        email: 'test@yurpass.com',
        password: 'MyPassword',
      })

      expect(result.success).toBe(true)
      expect(result.tokens).toBeDefined()
      expect(result.requires2FA).toBeUndefined()
    })

    it('should require 2FA for host with 2FA enabled', async () => {
      const hash = await bcrypt.hash('MyPassword', 4)
      mockUser.findOne.mockResolvedValue({
        ...mockUserDoc,
        passwordHash: hash,
        roles: [UserRole.GUEST, UserRole.HOST],
        security: { ...mockUserDoc.security, twoFactorEnabled: true },
      })
      mockRedis.set.mockResolvedValue('OK')

      const result = await AuthService.login({
        email: 'test@yurpass.com',
        password: 'MyPassword',
      })

      expect(result.success).toBe(true)
      expect(result.requires2FA).toBe(true)
      expect(result.tempToken).toBeDefined()
      expect(result.tokens).toBeUndefined()
    })
  })

  describe('verifyEmail', () => {
    it('should verify email with valid token', async () => {
      mockRedis.get.mockResolvedValue('abc123')
      mockUser.findOne.mockResolvedValue(mockUserDoc)
      mockUser.updateOne.mockResolvedValue({})
      mockRedis.del.mockResolvedValue(1)

      await AuthService.verifyEmail('valid-token')

      expect(mockUser.updateOne).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          $set: expect.objectContaining({
            'profile.verifiedAt': expect.any(Date),
          }),
        }),
      )
      expect(mockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.EMAIL_VERIFIED,
        }),
      )
    })

    it('should throw for invalid verification token', async () => {
      mockRedis.get.mockResolvedValue(null)

      await expect(AuthService.verifyEmail('bad-token')).rejects.toThrow(
        'Token de vérification invalide ou expiré',
      )
    })
  })

  describe('forgotPassword', () => {
    it('should not throw when user does not exist (anti-enumeration)', async () => {
      mockUser.findOne.mockResolvedValue(null)

      await expect(
        AuthService.forgotPassword('nobody@yurpass.com'),
      ).resolves.toBeUndefined()
    })

    it('should send reset email when user exists', async () => {
      mockUser.findOne.mockResolvedValue(mockUserDoc)
      mockRedis.set.mockResolvedValue('OK')

      await AuthService.forgotPassword('test@yurpass.com')

      expect(mockRedis.set).toHaveBeenCalled()
      expect(mockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.PASSWORD_RESET_REQUESTED,
        }),
      )
    })
  })

  describe('deleteAccount', () => {
    it('should soft-delete and schedule anonymization', async () => {
      mockUser.updateOne.mockResolvedValue({})
      mockRedis.keys.mockResolvedValue([])

      await AuthService.deleteAccount('abc123')

      expect(mockUser.updateOne).toHaveBeenCalledWith(
        { publicId: 'abc123' },
        { $set: { deletedAt: expect.any(Date) } },
      )
      expect(mockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.ACCOUNT_DELETED,
        }),
      )
    })
  })

  describe('refreshToken', () => {
    it('should throw for invalid refresh token', async () => {
      mockRedis.get.mockResolvedValue(null)

      await expect(AuthService.refreshToken('bad-token')).rejects.toThrow(
        'Refresh token invalide ou expiré',
      )
    })

    it('should rotate tokens on valid refresh', async () => {
      mockRedis.get.mockResolvedValue('abc123')
      mockRedis.del.mockResolvedValue(1)
      mockRedis.set.mockResolvedValue('OK')
      mockUser.findOne.mockResolvedValue(mockUserDoc)

      const result = await AuthService.refreshToken('valid-refresh')

      expect(result.accessToken).toBeDefined()
      expect(result.refreshToken).toBeDefined()
      expect(result.expiresIn).toBe(900)
      expect(mockRedis.del).toHaveBeenCalledWith('refresh:valid-refresh')
    })
  })
})
