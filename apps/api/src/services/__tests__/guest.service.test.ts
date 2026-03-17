import { describe, it, expect, vi, beforeEach } from 'vitest'
import bcrypt from 'bcryptjs'
import {
  EventStatus,
  ParticipationStatus,
  AccessType,
  AuditAction,
  AuditResult,
} from '@yurpass/types'

// ─── Mocks ──────────────────────────────────────────────

const mockEvent = {
  findOne: vi.fn(),
  updateOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
}

const mockParticipation = {
  findOne: vi.fn(),
  find: vi.fn(),
  create: vi.fn(),
  updateOne: vi.fn(),
  countDocuments: vi.fn(),
}

const mockUser = {
  findOne: vi.fn(),
}

const mockAuditLog = {
  create: vi.fn(),
}

vi.mock('../../models/event.model.js', () => ({
  Event: {
    findOne: (...args: unknown[]) => mockEvent.findOne(...args),
    updateOne: (...args: unknown[]) => mockEvent.updateOne(...args),
    findOneAndUpdate: (...args: unknown[]) => mockEvent.findOneAndUpdate(...args),
  },
}))

vi.mock('../../models/participation.model.js', () => ({
  Participation: {
    findOne: (...args: unknown[]) => mockParticipation.findOne(...args),
    find: (...args: unknown[]) => mockParticipation.find(...args),
    create: (...args: unknown[]) => mockParticipation.create(...args),
    updateOne: (...args: unknown[]) => mockParticipation.updateOne(...args),
    countDocuments: (...args: unknown[]) => mockParticipation.countDocuments(...args),
  },
}))

vi.mock('../../models/user.model.js', () => ({
  User: {
    findOne: (...args: unknown[]) => mockUser.findOne(...args),
    find: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }),
  },
}))

vi.mock('../../models/audit-log.model.js', () => ({
  AuditLog: {
    create: (...args: unknown[]) => mockAuditLog.create(...args),
  },
}))

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('../../lib/env.js', () => ({
  env: {
    REDIS_URL: 'redis://localhost:6379',
    TICKET_CODE_ENCRYPTION_KEY: undefined,
  },
}))

vi.mock('../../lib/ticket-crypto.js', () => ({
  encryptTicketCode: vi.fn().mockReturnValue('encrypted-code'),
  decryptTicketCode: vi.fn().mockReturnValue('plain-code-123'),
}))

vi.mock('nanoid', () => ({
  nanoid: (n?: number) => 'A'.repeat(n ?? 21),
}))

vi.mock('bullmq', () => {
  const MockQueue = class {
    add = vi.fn()
    addBulk = vi.fn()
  }
  return { Queue: MockQueue, Worker: class {} }
})

vi.mock('./notification.service.js', () => ({
  NotificationService: {
    notifyGuestApproved: vi.fn(),
    notifyGuestRejected: vi.fn(),
    notifyGuestInvited: vi.fn(),
    notifyEventCancelled: vi.fn(),
    sendToUser: vi.fn(),
    sendToUsers: vi.fn(),
  },
}))

// ─── Import after mocks ─────────────────────────────────

const { GuestService } = await import('../guest.service.js')

// ─── Fixtures ───────────────────────────────────────────

function makeMockEventDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'mongo-event-id',
    publicId: 'evt-test-01',
    hostId: 'host-001',
    title: 'Soirée Test',
    status: EventStatus.PUBLISHED,
    schedule: {
      startDate: new Date('2026-04-15T22:00:00.000Z'),
      endDate: new Date('2026-04-16T04:00:00.000Z'),
      doorsOpenAt: new Date('2026-04-15T21:30:00.000Z'),
    },
    venue: { city: 'Paris', address: '123 Rue Test' },
    capacity: { max: 15, confirmed: 5, waitlist: 0 },
    access: { type: AccessType.INVITE_ONLY, requiresContribution: false },
    samRequired: false,
    isPrivate: true,
    mediaUrls: [],
    deletedAt: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
    toJSON() {
      return { ...this }
    },
    ...overrides,
  }
}

function makeMockParticipation(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'mongo-part-id',
    publicId: 'part-001',
    userId: 'guest-001',
    eventId: 'evt-test-01',
    status: ParticipationStatus.PENDING,
    accessCode: undefined,
    invitedBy: 'host-001',
    hostNote: undefined,
    checkedInAt: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

// ─── Tests ──────────────────────────────────────────────

describe('GuestService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── approveGuest ─────────────────────────────────────

  describe('approveGuest', () => {
    it('should return plain access code ONCE and store bcrypt hash in DB', async () => {
      const event = makeMockEventDoc()
      mockEvent.findOne.mockResolvedValue(event)
      mockParticipation.findOne.mockResolvedValue(makeMockParticipation())
      mockEvent.findOneAndUpdate.mockResolvedValue({
        ...event,
        capacity: { max: 15, confirmed: 6, waitlist: 0 },
      })
      mockParticipation.updateOne.mockResolvedValue({})

      const result = await GuestService.approveGuest(
        'host-001',
        'evt-test-01',
        'part-001',
      )

      // Plain code returned to caller
      expect(result.accessCode).toBeDefined()
      expect(result.accessCode).toHaveLength(12)
      expect(result.status).toBe(ParticipationStatus.APPROVED)

      // Verify hash stored in DB (not plain code)
      const updateCall = mockParticipation.updateOne.mock.calls[0]
      const setData = (updateCall[1] as Record<string, unknown>).$set as Record<string, unknown>
      const storedHash = setData['accessCode.codeHash'] as string

      // Hash should NOT equal the plain code
      expect(storedHash).not.toBe(result.accessCode)
      // Hash should be a valid bcrypt hash
      expect(storedHash).toMatch(/^\$2[aby]\$/)
      // Hash should verify against the plain code
      const isValid = await bcrypt.compare(result.accessCode, storedHash)
      expect(isValid).toBe(true)
    })
  })

  // ─── scanAccessCode ───────────────────────────────────

  describe('scanAccessCode', () => {
    it('RB-002: valid scan → status ATTENDED + accessCode invalidated', async () => {
      const plainCode = 'ABCDEF123456'
      const codeHash = await bcrypt.hash(plainCode, 4) // low rounds for test speed

      const event = makeMockEventDoc({
        status: EventStatus.ONGOING,
        schedule: {
          startDate: new Date(Date.now() - 60 * 60 * 1000), // started 1h ago
          endDate: new Date(Date.now() + 3 * 60 * 60 * 1000), // ends in 3h
          doorsOpenAt: new Date(Date.now() - 90 * 60 * 1000),
        },
      })
      mockEvent.findOne.mockResolvedValue(event)

      mockParticipation.find.mockResolvedValue([
        makeMockParticipation({
          status: ParticipationStatus.APPROVED,
          accessCode: { codeHash, generatedAt: new Date(), invalidated: false },
        }),
      ])
      mockParticipation.updateOne.mockResolvedValue({})
      mockUser.findOne.mockResolvedValue({
        profile: { displayName: 'John Doe', avatarUrl: undefined },
      })

      const result = await GuestService.scanAccessCode(
        'scanner-001',
        'evt-test-01',
        plainCode,
      )

      expect(result.guestDisplayName).toBe('John Doe')
      expect(result.checkedInAt).toBeDefined()

      // Verify DB updated with invalidated=true and ATTENDED status
      expect(mockParticipation.updateOne).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          $set: expect.objectContaining({
            'accessCode.invalidated': true,
            status: ParticipationStatus.ATTENDED,
          }),
        }),
      )

      // Verify audit log
      expect(mockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.ACCESS_CODE_SCAN,
          result: AuditResult.SUCCESS,
        }),
      )
    })

    it('RB-002: same code twice → "already used" error', async () => {
      const plainCode = 'ABCDEF123456'
      const codeHash = await bcrypt.hash(plainCode, 4)

      const event = makeMockEventDoc({
        status: EventStatus.ONGOING,
        schedule: {
          startDate: new Date(Date.now() - 60 * 60 * 1000),
          endDate: new Date(Date.now() + 3 * 60 * 60 * 1000),
          doorsOpenAt: new Date(Date.now() - 90 * 60 * 1000),
        },
      })
      mockEvent.findOne.mockResolvedValue(event)

      // Code already used (usedAt is set)
      mockParticipation.find.mockResolvedValue([
        makeMockParticipation({
          status: ParticipationStatus.ATTENDED,
          accessCode: {
            codeHash,
            generatedAt: new Date(),
            usedAt: new Date(), // Already scanned
            invalidated: true,
          },
        }),
      ])

      await expect(
        GuestService.scanAccessCode('scanner-001', 'evt-test-01', plainCode),
      ).rejects.toThrow('Code déjà utilisé')

      expect(mockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.ACCESS_CODE_REFUSED,
          metadata: expect.objectContaining({ reason: 'ALREADY_USED' }),
        }),
      )
    })

    it('RB-003: scan after event.endDate → "expired" error', async () => {
      const event = makeMockEventDoc({
        schedule: {
          startDate: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8h ago
          endDate: new Date(Date.now() - 2 * 60 * 60 * 1000), // ended 2h ago
          doorsOpenAt: new Date(Date.now() - 9 * 60 * 60 * 1000),
        },
      })
      mockEvent.findOne.mockResolvedValue(event)

      await expect(
        GuestService.scanAccessCode('scanner-001', 'evt-test-01', 'ANY_CODE_123'),
      ).rejects.toThrow('Code expiré — événement terminé')

      expect(mockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.ACCESS_CODE_REFUSED,
          metadata: expect.objectContaining({ reason: 'EVENT_ENDED' }),
        }),
      )
    })

    it('should log ACCESS_CODE_REFUSED for invalid code', async () => {
      const event = makeMockEventDoc({
        status: EventStatus.ONGOING,
        schedule: {
          startDate: new Date(Date.now() - 60 * 60 * 1000),
          endDate: new Date(Date.now() + 3 * 60 * 60 * 1000),
          doorsOpenAt: new Date(Date.now() - 90 * 60 * 1000),
        },
      })
      mockEvent.findOne.mockResolvedValue(event)

      // No participations match
      mockParticipation.find.mockResolvedValue([])

      await expect(
        GuestService.scanAccessCode('scanner-001', 'evt-test-01', 'INVALID_CODE!'),
      ).rejects.toThrow('Code d\'accès invalide')

      expect(mockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.ACCESS_CODE_REFUSED,
          metadata: expect.objectContaining({ reason: 'NO_MATCH' }),
          result: AuditResult.FAILURE,
        }),
      )
    })
  })

  // ─── getEventAddress (J-24h reveal) ───────────────────

  describe('getEventAddress', () => {
    it('RB-004: should hide address when J+25h (more than 24h before)', async () => {
      const event = makeMockEventDoc({
        schedule: {
          startDate: new Date(Date.now() + 25 * 60 * 60 * 1000), // 25h from now
          endDate: new Date(Date.now() + 31 * 60 * 60 * 1000),
          doorsOpenAt: new Date(Date.now() + 24.5 * 60 * 60 * 1000),
        },
      })
      mockEvent.findOne.mockResolvedValue(event)
      mockParticipation.findOne.mockResolvedValue(
        makeMockParticipation({ status: ParticipationStatus.APPROVED }),
      )

      await expect(
        GuestService.getEventAddress('guest-001', 'evt-test-01'),
      ).rejects.toThrow('L\'adresse sera révélée 24h avant l\'événement')
    })

    it('RB-004: should reveal address when J-23h (less than 24h before)', async () => {
      const event = makeMockEventDoc({
        schedule: {
          startDate: new Date(Date.now() + 23 * 60 * 60 * 1000), // 23h from now
          endDate: new Date(Date.now() + 29 * 60 * 60 * 1000),
          doorsOpenAt: new Date(Date.now() + 22.5 * 60 * 60 * 1000),
        },
        venue: { city: 'Paris', address: '42 Rue Secrète' },
      })
      mockEvent.findOne.mockResolvedValue(event)
      mockParticipation.findOne.mockResolvedValue(
        makeMockParticipation({ status: ParticipationStatus.APPROVED }),
      )

      const result = await GuestService.getEventAddress('guest-001', 'evt-test-01')

      expect(result.address).toBe('42 Rue Secrète')
      expect(mockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.ADDRESS_REVEALED,
          result: AuditResult.SUCCESS,
        }),
      )
    })

    it('should throw ForbiddenError when guest is not approved', async () => {
      const event = makeMockEventDoc({
        schedule: {
          startDate: new Date(Date.now() + 23 * 60 * 60 * 1000),
          endDate: new Date(Date.now() + 29 * 60 * 60 * 1000),
          doorsOpenAt: new Date(Date.now() + 22.5 * 60 * 60 * 1000),
        },
      })
      mockEvent.findOne.mockResolvedValue(event)
      mockParticipation.findOne.mockResolvedValue(null) // not approved

      await expect(
        GuestService.getEventAddress('guest-001', 'evt-test-01'),
      ).rejects.toThrow('Vous devez être approuvé pour voir l\'adresse')
    })
  })

  // ─── inviteGuest ──────────────────────────────────────

  describe('inviteGuest', () => {
    it('should create participation and notify guest', async () => {
      mockEvent.findOne.mockResolvedValue(makeMockEventDoc())
      mockUser.findOne.mockResolvedValue({
        publicId: 'guest-new',
        roles: ['guest'],
        deletedAt: null,
      })
      mockParticipation.findOne.mockResolvedValue(null) // no existing
      mockParticipation.create.mockResolvedValue({
        publicId: 'new-part-id',
      })

      const result = await GuestService.inviteGuest('host-001', 'evt-test-01', 'guest-new')

      expect(result.participationId).toBe('new-part-id')
      expect(mockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.EVENT_GUEST_ADDED,
        }),
      )
    })
  })

  // ─── rejectGuest ──────────────────────────────────────

  describe('rejectGuest', () => {
    it('should reject pending guest and update status', async () => {
      mockEvent.findOne.mockResolvedValue(makeMockEventDoc())
      mockParticipation.findOne.mockResolvedValue(makeMockParticipation())
      mockParticipation.updateOne.mockResolvedValue({})

      await GuestService.rejectGuest('host-001', 'evt-test-01', 'part-001')

      expect(mockParticipation.updateOne).toHaveBeenCalledWith(
        expect.anything(),
        { $set: { status: ParticipationStatus.REJECTED } },
      )
    })
  })
})
