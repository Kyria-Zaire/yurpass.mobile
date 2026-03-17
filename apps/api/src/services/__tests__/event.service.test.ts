import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  EventStatus,
  UserRole,
  AuditAction,
  AuditResult,
  AccessType,
} from '@yurpass/types'
import type { CreateEventInput } from '@yurpass/types'

// ─── Mocks ──────────────────────────────────────────────

const mockEvent = {
  create: vi.fn(),
  findOne: vi.fn(),
  updateOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
  find: vi.fn(),
}

const mockParticipation = {
  countDocuments: vi.fn(),
  find: vi.fn(),
}

const mockUser = {
  findOne: vi.fn(),
}

const mockAuditLog = {
  create: vi.fn(),
}

vi.mock('../../models/event.model.js', () => ({
  Event: {
    create: (...args: unknown[]) => mockEvent.create(...args),
    findOne: (...args: unknown[]) => mockEvent.findOne(...args),
    updateOne: (...args: unknown[]) => mockEvent.updateOne(...args),
    findOneAndUpdate: (...args: unknown[]) => mockEvent.findOneAndUpdate(...args),
    find: (...args: unknown[]) => mockEvent.find(...args),
  },
}))

vi.mock('../../models/participation.model.js', () => ({
  Participation: {
    countDocuments: (...args: unknown[]) => mockParticipation.countDocuments(...args),
    find: (...args: unknown[]) => mockParticipation.find(...args),
  },
}))

vi.mock('../../models/user.model.js', () => ({
  User: {
    findOne: (...args: unknown[]) => mockUser.findOne(...args),
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
  env: { REDIS_URL: 'redis://localhost:6379' },
}))

vi.mock('nanoid', () => ({
  nanoid: (n?: number) => 'x'.repeat(n ?? 21),
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
    notifyEventCancelled: vi.fn(),
    notifyGuestApproved: vi.fn(),
    notifyGuestRejected: vi.fn(),
    notifyGuestInvited: vi.fn(),
    sendToUser: vi.fn(),
    sendToUsers: vi.fn(),
  },
}))

// ─── Import after mocks ─────────────────────────────────

const { EventService } = await import('../event.service.js')

// ─── Fixtures ───────────────────────────────────────────

const validInput: CreateEventInput = {
  title: 'Soirée Test',
  description: 'Description test',
  theme: { id: 'elegant', name: 'Élégant', dresscode: 'Costume' },
  schedule: {
    startDate: '2026-04-15T22:00:00.000Z',
    endDate: '2026-04-16T04:00:00.000Z',
    doorsOpenAt: '2026-04-15T21:30:00.000Z',
  },
  venue: { city: 'Paris', address: '123 Rue Test' },
  capacity: { max: 15 },
  access: { type: AccessType.INVITE_ONLY, requiresContribution: false },
}

function makeMockEventDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'mongo-event-id',
    publicId: 'evt-test-01',
    hostId: 'host-001',
    title: 'Soirée Test',
    description: 'Description',
    theme: { id: 'elegant', name: 'Élégant', dresscode: 'Costume' },
    schedule: {
      startDate: new Date('2026-04-15T22:00:00.000Z'),
      endDate: new Date('2026-04-16T04:00:00.000Z'),
      doorsOpenAt: new Date('2026-04-15T21:30:00.000Z'),
    },
    venue: { city: 'Paris', address: '123 Rue Test' },
    capacity: { max: 15, confirmed: 0, waitlist: 0 },
    access: { type: AccessType.INVITE_ONLY, requiresContribution: false },
    status: EventStatus.DRAFT,
    samRequired: false,
    samId: undefined,
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

// ─── Tests ──────────────────────────────────────────────

describe('EventService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── createEvent ──────────────────────────────────────

  describe('createEvent', () => {
    it('should create event in DRAFT status', async () => {
      mockEvent.create.mockResolvedValue({ publicId: 'xxxxxxxxxx' })

      const result = await EventService.createEvent('host-001', validInput)

      expect(result.publicId).toBeDefined()
      expect(mockEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: EventStatus.DRAFT,
          hostId: 'host-001',
        }),
      )
      expect(mockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.EVENT_CREATED,
          result: AuditResult.SUCCESS,
        }),
      )
    })

    it('RB-005: should set samRequired=true when capacity > 20', async () => {
      mockEvent.create.mockResolvedValue({ publicId: 'xxxxxxxxxx' })

      const input = { ...validInput, capacity: { max: 25 } }
      await EventService.createEvent('host-001', input)

      expect(mockEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          samRequired: true,
        }),
      )
    })

    it('should set samRequired=false when capacity <= 20', async () => {
      mockEvent.create.mockResolvedValue({ publicId: 'xxxxxxxxxx' })

      await EventService.createEvent('host-001', validInput)

      expect(mockEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          samRequired: false,
        }),
      )
    })
  })

  // ─── publishEvent ─────────────────────────────────────

  describe('publishEvent', () => {
    it('should publish a draft event', async () => {
      mockEvent.findOne.mockResolvedValue(makeMockEventDoc())
      mockEvent.updateOne.mockResolvedValue({})

      await EventService.publishEvent('evt-test-01', 'host-001')

      expect(mockEvent.updateOne).toHaveBeenCalledWith(
        expect.anything(),
        { $set: { status: EventStatus.PUBLISHED } },
      )
    })

    it('RB-005: should block publish when SAM required but not assigned', async () => {
      const event = makeMockEventDoc({
        samRequired: true,
        samId: undefined,
        capacity: { max: 30, confirmed: 0, waitlist: 0 },
      })
      mockEvent.findOne.mockResolvedValue(event)

      await expect(
        EventService.publishEvent('evt-test-01', 'host-001'),
      ).rejects.toThrow('Un SAM doit être assigné avant de publier')
    })

    it('should throw ForbiddenError if not the host', async () => {
      mockEvent.findOne.mockResolvedValue(makeMockEventDoc())

      await expect(
        EventService.publishEvent('evt-test-01', 'not-the-host'),
      ).rejects.toThrow('Vous n\'êtes pas le host de cet événement')
    })
  })

  // ─── assignSam ────────────────────────────────────────

  describe('assignSam', () => {
    it('RB-006: should throw ForbiddenError when host assigns himself', async () => {
      mockEvent.findOne.mockResolvedValue(makeMockEventDoc())

      await expect(
        EventService.assignSam('evt-test-01', 'host-001', 'host-001'),
      ).rejects.toThrow('Le host ne peut pas être son propre SAM')
    })

    it('should throw when user does not have SAM role', async () => {
      mockEvent.findOne.mockResolvedValue(makeMockEventDoc())
      mockUser.findOne.mockResolvedValue({
        publicId: 'user-no-sam',
        roles: [UserRole.GUEST],
        deletedAt: null,
      })

      await expect(
        EventService.assignSam('evt-test-01', 'host-001', 'user-no-sam'),
      ).rejects.toThrow('Cet utilisateur n\'a pas le rôle SAM')
    })

    it('should assign SAM successfully when valid', async () => {
      mockEvent.findOne.mockResolvedValue(makeMockEventDoc())
      mockUser.findOne.mockResolvedValue({
        publicId: 'sam-user',
        roles: [UserRole.GUEST, UserRole.SAM],
        deletedAt: null,
      })
      mockEvent.updateOne.mockResolvedValue({})

      await EventService.assignSam('evt-test-01', 'host-001', 'sam-user')

      expect(mockEvent.updateOne).toHaveBeenCalledWith(
        expect.anything(),
        { $set: { samId: 'sam-user' } },
      )
      expect(mockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.SAM_ASSIGNED,
          targetId: 'sam-user',
        }),
      )
    })
  })

  // ─── getEventForGuest ─────────────────────────────────

  describe('getEventForGuest', () => {
    it('should hide address in guest view', async () => {
      const event = makeMockEventDoc({
        status: EventStatus.PUBLISHED,
        venue: { city: 'Paris', address: '42 Secret Street', coordinates: { lat: 48.8, lng: 2.3 } },
      })
      mockEvent.findOne.mockResolvedValue(event)

      const result = await EventService.getEventForGuest('evt-test-01')

      expect(result.venue.city).toBe('Paris')
      expect((result.venue as Record<string, unknown>).address).toBeUndefined()
    })
  })
})
