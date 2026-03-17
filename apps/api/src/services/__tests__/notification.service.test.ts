import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotificationType } from '@yurpass/types'

// ─── Mocks ──────────────────────────────────────────────

const mockQueueAdd = vi.fn()
const mockQueueAddBulk = vi.fn()

const mockUser = {
  findOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
  updateOne: vi.fn(),
  updateMany: vi.fn(),
}

const mockAuditLog = {
  create: vi.fn(),
}

const mockEvent = {
  find: vi.fn(),
}

const mockParticipation = {
  find: vi.fn(),
}

vi.mock('../../models/user.model.js', () => ({
  User: {
    findOne: (...args: unknown[]) => mockUser.findOne(...args),
    findOneAndUpdate: (...args: unknown[]) => mockUser.findOneAndUpdate(...args),
    updateOne: (...args: unknown[]) => mockUser.updateOne(...args),
    updateMany: (...args: unknown[]) => mockUser.updateMany(...args),
  },
}))

vi.mock('../../models/audit-log.model.js', () => ({
  AuditLog: {
    create: (...args: unknown[]) => mockAuditLog.create(...args),
  },
}))

vi.mock('../../models/event.model.js', () => ({
  Event: {
    find: (...args: unknown[]) => mockEvent.find(...args),
  },
}))

vi.mock('../../models/participation.model.js', () => ({
  Participation: {
    find: (...args: unknown[]) => mockParticipation.find(...args),
  },
}))

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('../../lib/env.js', () => ({
  env: { REDIS_URL: 'redis://localhost:6379' },
}))

vi.mock('bullmq', () => {
  const MockQueue = class {
    add = (...args: unknown[]) => mockQueueAdd(...args)
    addBulk = (...args: unknown[]) => mockQueueAddBulk(...args)
  }
  return { Queue: MockQueue, Worker: class {} }
})

// ─── Import after mocks ─────────────────────────────────

const { NotificationService } = await import('../notification.service.js')

// ─── Tests ──────────────────────────────────────────────

describe('NotificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── Security: no accessCode in payloads ──────────────

  describe('payload security', () => {
    it('should NEVER include accessCode in GUEST_APPROVED payload', async () => {
      mockQueueAdd.mockResolvedValue({})

      NotificationService.notifyGuestApproved('guest-001', 'Soirée VIP', 'part-001')

      // Wait for the void promise to settle
      await new Promise((r) => setTimeout(r, 10))

      expect(mockQueueAdd).toHaveBeenCalledOnce()
      const [, jobData] = mockQueueAdd.mock.calls[0] as [string, { payload: Record<string, unknown> }]
      const payload = jobData.payload

      // Verify no accessCode anywhere in the payload
      expect(payload.type).toBe(NotificationType.GUEST_APPROVED)
      expect(JSON.stringify(payload)).not.toContain('accessCode')
      expect(JSON.stringify(payload)).not.toContain('codeHash')
      expect(JSON.stringify(payload)).not.toContain('plainEncrypted')
    })

    it('should NEVER include address in EVENT_REMINDER payload', async () => {
      mockQueueAddBulk.mockResolvedValue([])

      NotificationService.notifyEventCancelled(['guest-001', 'guest-002'], 'Soirée VIP')

      await new Promise((r) => setTimeout(r, 10))

      expect(mockQueueAddBulk).toHaveBeenCalledOnce()
      const [jobs] = mockQueueAddBulk.mock.calls[0] as [Array<{ data: { payload: Record<string, unknown> } }>]

      for (const job of jobs) {
        expect(JSON.stringify(job.data.payload)).not.toContain('address')
        expect(JSON.stringify(job.data.payload)).not.toContain('coordinates')
      }
    })

    it('rejection notification should have neutral message (no reason)', async () => {
      mockQueueAdd.mockResolvedValue({})

      NotificationService.notifyGuestRejected('guest-001', 'Soirée VIP')

      await new Promise((r) => setTimeout(r, 10))

      expect(mockQueueAdd).toHaveBeenCalledOnce()
      const [, jobData] = mockQueueAdd.mock.calls[0] as [string, { payload: { body: string; title: string } }]

      // Must NOT contain "rejeté", "refusé", "rejected" etc.
      expect(jobData.payload.body).not.toMatch(/rejet|refus|denied|rejected/i)
      expect(jobData.payload.title).not.toMatch(/rejet|refus|denied|rejected/i)
      // Should contain neutral wording
      expect(jobData.payload.body).toContain('Mise à jour')
    })
  })

  // ─── Token management ────────────────────────────────

  describe('registerPushToken', () => {
    it('should store valid Expo push token', async () => {
      mockUser.updateOne.mockResolvedValue({})
      mockUser.findOneAndUpdate.mockResolvedValue({ publicId: 'user-001', pushTokens: [] })

      await NotificationService.registerPushToken(
        'user-001',
        'ExponentPushToken[abc123]',
        'ios',
      )

      expect(mockUser.findOneAndUpdate).toHaveBeenCalledWith(
        { publicId: 'user-001' },
        expect.objectContaining({
          $push: expect.objectContaining({
            pushTokens: expect.objectContaining({
              $each: expect.arrayContaining([
                expect.objectContaining({
                  token: 'ExponentPushToken[abc123]',
                  platform: 'ios',
                }),
              ]),
              $slice: -5, // max 5 tokens
            }),
          }),
        }),
        { new: true },
      )
    })
  })

  describe('removeInvalidToken', () => {
    it('should remove DeviceNotRegistered token from all users', async () => {
      mockUser.updateMany.mockResolvedValue({ modifiedCount: 1 })

      await NotificationService.removeInvalidToken('ExponentPushToken[dead]')

      expect(mockUser.updateMany).toHaveBeenCalledWith(
        { 'pushTokens.token': 'ExponentPushToken[dead]' },
        { $pull: { pushTokens: { token: 'ExponentPushToken[dead]' } } },
      )
    })
  })
})
