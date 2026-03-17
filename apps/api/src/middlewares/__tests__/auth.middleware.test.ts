import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { UserRole, SubscriptionPlan } from '@yurpass/types'
import type { SessionUser } from '@yurpass/types'
import { AppError } from '../error-handler.js'

// ─── Mocks ──────────────────────────────────────────────

const mockRedis = {
  get: vi.fn(),
}

const mockUser = {
  findOne: vi.fn(),
}

vi.mock('../../lib/redis.js', () => ({
  getRedis: () => mockRedis,
}))

vi.mock('../../models/user.model.js', () => ({
  User: {
    findOne: (...args: unknown[]) => mockUser.findOne(...args),
  },
}))

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

// ─── Import after mocks ─────────────────────────────────

const { authMiddleware, requireRole, require2FA } = await import('../auth.middleware.js')

// ─── Helpers ────────────────────────────────────────────

function makeTestUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    publicId: 'user-001',
    email: 'test@yurpass.com',
    roles: [UserRole.GUEST],
    profile: {
      displayName: 'Test User',
      city: 'Paris',
      verifiedAt: new Date(),
    },
    reputation: { score: 0, totalRatings: 0, avgRating: 0 },
    security: { twoFactorEnabled: false },
    subscription: { plan: SubscriptionPlan.FREE },
    createdAt: new Date(),
    ...overrides,
  }
}

function withErrorHandler(app: Hono): Hono {
  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ message: err.message, code: err.code }, err.statusCode as 400)
    }
    return c.json({ message: 'Internal error' }, 500)
  })
  return app
}

function createTestApp(roles: UserRole[], user: SessionUser) {
  const app = new Hono()

  // Skip authMiddleware and inject user directly for middleware unit tests
  app.use('*', async (c, next) => {
    c.set('user', user)
    await next()
  })

  app.get(
    '/protected',
    requireRole(roles),
    require2FA,
    (c) => c.json({ ok: true }),
  )

  return withErrorHandler(app)
}

// ─── Tests ──────────────────────────────────────────────

describe('Auth Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('requireRole', () => {
    it('should allow access with matching role and 2FA', async () => {
      const user = makeTestUser({
        roles: [UserRole.HOST],
        security: { twoFactorEnabled: true },
      })
      const app = createTestApp([UserRole.HOST, UserRole.ADMIN], user)

      const res = await app.request('/protected')

      expect(res.status).toBe(200)
    })

    it('should return 403 for guest accessing host-only route', async () => {
      const user = makeTestUser({ roles: [UserRole.GUEST] })
      const app = createTestApp([UserRole.HOST, UserRole.ADMIN], user)

      const res = await app.request('/protected')

      expect(res.status).toBe(403)
      const body = await res.json() as Record<string, unknown>
      expect(body).toEqual(
        expect.objectContaining({ message: expect.stringContaining('rôle insuffisant') }),
      )
    })
  })

  describe('require2FA', () => {
    it('RB-007: should return 403 for host without 2FA enabled', async () => {
      const user = makeTestUser({
        roles: [UserRole.HOST],
        security: { twoFactorEnabled: false },
      })
      const app = createTestApp([UserRole.HOST], user)

      const res = await app.request('/protected')

      expect(res.status).toBe(403)
      const body = await res.json() as Record<string, unknown>
      expect(body).toEqual(
        expect.objectContaining({ message: expect.stringContaining('2FA requis') }),
      )
    })

    it('should allow host with 2FA enabled', async () => {
      const user = makeTestUser({
        roles: [UserRole.HOST],
        security: { twoFactorEnabled: true },
      })
      const app = createTestApp([UserRole.HOST], user)

      const res = await app.request('/protected')

      expect(res.status).toBe(200)
    })

    it('should allow guest (non-sensitive role) without 2FA', async () => {
      const guestUser = makeTestUser({ roles: [UserRole.GUEST] })
      const app = createTestApp([UserRole.GUEST], guestUser)

      const res = await app.request('/protected')

      expect(res.status).toBe(200)
    })
  })

  describe('authMiddleware', () => {
    it('should return 401 without Authorization header', async () => {
      const app = new Hono()
      app.use('*', authMiddleware)
      app.get('/test', (c) => c.json({ ok: true }))
      withErrorHandler(app)

      const res = await app.request('/test')

      expect(res.status).toBe(401)
    })
  })
})
