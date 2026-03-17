import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  EventStatus,
  ParticipationStatus,
  UserRole,
  AuditAction,
  AuditResult,
} from '@yurpass/types'

// ─── Mocks ──────────────────────────────────────────────

const mockSamMission = {
  findOne: vi.fn(),
  updateOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
  find: vi.fn(),
  countDocuments: vi.fn(),
}

const mockEvent = {
  findOne: vi.fn(),
}

const mockParticipation = {
  findOne: vi.fn(),
}

const mockUser = {
  findOne: vi.fn(),
  find: vi.fn(),
}

const mockAuditLog = {
  create: vi.fn(),
}

vi.mock('../../models/sam-mission.model.js', () => ({
  SamMission: {
    findOne: (...args: unknown[]) => mockSamMission.findOne(...args),
    updateOne: (...args: unknown[]) => mockSamMission.updateOne(...args),
    findOneAndUpdate: (...args: unknown[]) => mockSamMission.findOneAndUpdate(...args),
    find: (...args: unknown[]) => mockSamMission.find(...args),
    countDocuments: (...args: unknown[]) => mockSamMission.countDocuments(...args),
  },
}))

vi.mock('../../models/event.model.js', () => ({
  Event: {
    findOne: (...args: unknown[]) => {
      const result = mockEvent.findOne(...args)
      const query = result && typeof result.then === 'function'
        ? result
        : Promise.resolve(result)
      ;(query as Record<string, unknown>).lean = () => result
      return query
    },
  },
}))

vi.mock('../../models/participation.model.js', () => ({
  Participation: {
    findOne: (...args: unknown[]) => mockParticipation.findOne(...args),
  },
}))

vi.mock('../../models/user.model.js', () => ({
  User: {
    findOne: (...args: unknown[]) => {
      const result = mockUser.findOne(...args)
      return { lean: () => result }
    },
    find: (...args: unknown[]) => {
      const result = mockUser.find(...args)
      return { lean: () => result }
    },
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

vi.mock('bullmq', () => {
  const MockQueue = class {
    add = vi.fn()
    addBulk = vi.fn()
  }
  return { Queue: MockQueue, Worker: class {} }
})

vi.mock('../notification.service.js', () => ({
  NotificationService: {
    notifySamMissionConfirmed: vi.fn(),
    notifySamMissionCompleted: vi.fn(),
    notifySamUrgentIncident: vi.fn(),
    sendToUser: vi.fn(),
    sendToUsers: vi.fn(),
  },
}))

// ─── Import after mocks ─────────────────────────────────

const { SamService } = await import('../sam.service.js')

// ─── Fixtures ───────────────────────────────────────────

function makeMission(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'mongo-mission-id',
    publicId: 'mission-01',
    eventId: 'evt-test-01',
    samId: 'sam-001',
    hostId: 'host-001',
    status: 'assigned',
    trips: [],
    incidents: [],
    confirmedAt: undefined,
    startedAt: undefined,
    completedAt: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
    toJSON() {
      return { ...this }
    },
    ...overrides,
  }
}

// ─── Tests ──────────────────────────────────────────────

describe('SamService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── confirmMission ─────────────────────────────────────

  describe('confirmMission', () => {
    it('should confirm mission and notify host', async () => {
      mockSamMission.findOne.mockResolvedValue(makeMission({ status: 'assigned' }))
      mockSamMission.updateOne.mockResolvedValue({})
      mockEvent.findOne.mockResolvedValue({ title: 'Soirée Test' })

      await SamService.confirmMission('mission-01', 'sam-001')

      expect(mockSamMission.updateOne).toHaveBeenCalledWith(
        expect.anything(),
        { $set: expect.objectContaining({ status: 'confirmed' }) },
      )
      expect(mockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.SAM_MISSION_CONFIRMED,
          result: AuditResult.SUCCESS,
        }),
      )
    })
  })

  // ─── startMission ──────────────────────────────────────

  describe('startMission', () => {
    it('should start mission on ongoing event', async () => {
      mockSamMission.findOne.mockResolvedValue(makeMission({ status: 'confirmed' }))
      mockEvent.findOne.mockResolvedValue({
        publicId: 'evt-test-01',
        status: EventStatus.ONGOING,
        deletedAt: null,
      })
      mockSamMission.updateOne.mockResolvedValue({})

      await SamService.startMission('mission-01', 'sam-001')

      expect(mockSamMission.updateOne).toHaveBeenCalledWith(
        expect.anything(),
        { $set: expect.objectContaining({ status: 'active' }) },
      )
    })

    it('should throw error on non-ongoing event', async () => {
      mockSamMission.findOne.mockResolvedValue(makeMission({ status: 'confirmed' }))
      mockEvent.findOne.mockResolvedValue({
        publicId: 'evt-test-01',
        status: EventStatus.PUBLISHED,
        deletedAt: null,
      })

      await expect(
        SamService.startMission('mission-01', 'sam-001'),
      ).rejects.toThrow('L\'événement doit être en cours')
    })
  })

  // ─── logTrip ───────────────────────────────────────────

  describe('logTrip', () => {
    it('should add trip with correct data', async () => {
      mockSamMission.findOne.mockResolvedValue(makeMission({ status: 'active' }))
      mockParticipation.findOne.mockResolvedValue({ userId: 'guest-001' })
      mockUser.findOne.mockResolvedValue({ profile: { displayName: 'Marie Dupont' } })
      mockSamMission.findOneAndUpdate.mockResolvedValue({
        trips: [{ guestId: 'guest-001', status: 'in-progress' }],
      })

      const result = await SamService.logTrip('mission-01', 'sam-001', {
        guestId: 'guest-001',
        destination: '12 Rue de la Paix',
        departureTime: new Date(),
      })

      expect(result.tripIndex).toBe(0)
      expect(mockSamMission.findOneAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        {
          $push: {
            trips: expect.objectContaining({
              guestId: 'guest-001',
              guestName: 'Marie Dupont',
              destination: '12 Rue de la Paix',
              status: 'in-progress',
            }),
          },
        },
        { new: true },
      )
      expect(mockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.SAM_TRIP_LOGGED,
        }),
      )
    })
  })

  // ─── confirmTripArrival ────────────────────────────────

  describe('confirmTripArrival', () => {
    it('should mark trip as completed', async () => {
      const mission = makeMission({
        status: 'active',
        trips: [
          { guestId: 'guest-001', guestName: 'Marie', destination: 'Maison', departureTime: new Date(), status: 'in-progress' },
        ],
      })
      mockSamMission.findOne.mockResolvedValue(mission)
      mockSamMission.updateOne.mockResolvedValue({})

      await SamService.confirmTripArrival('mission-01', 'sam-001', 0)

      expect(mockSamMission.updateOne).toHaveBeenCalledWith(
        expect.anything(),
        {
          $set: expect.objectContaining({
            'trips.0.status': 'completed',
          }),
        },
      )
      expect(mockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.SAM_TRIP_COMPLETED,
        }),
      )
    })
  })

  // ─── reportIncident ────────────────────────────────────

  describe('reportIncident', () => {
    it('should notify admins immediately on urgent incident', async () => {
      mockSamMission.findOne.mockResolvedValue(makeMission({ status: 'active' }))
      mockSamMission.updateOne.mockResolvedValue({})
      mockUser.find.mockResolvedValue([
        { publicId: 'admin-001' },
        { publicId: 'admin-002' },
      ])
      mockEvent.findOne.mockResolvedValue({ title: 'Soirée Test' })

      await SamService.reportIncident('mission-01', 'sam-001', {
        description: 'Altercation grave',
        level: 'urgent',
      })

      expect(mockSamMission.updateOne).toHaveBeenCalledWith(
        expect.anything(),
        {
          $push: {
            incidents: expect.objectContaining({
              level: 'urgent',
              description: 'Altercation grave',
            }),
          },
        },
      )
      expect(mockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.SAM_INCIDENT_REPORTED,
        }),
      )
    })
  })

  // ─── SAM ownership check ──────────────────────────────

  describe('ownership check', () => {
    it('should throw ForbiddenError when SAM acts on another SAM mission', async () => {
      mockSamMission.findOne.mockResolvedValue(
        makeMission({ samId: 'sam-001' }),
      )

      await expect(
        SamService.confirmMission('mission-01', 'sam-999'),
      ).rejects.toThrow('Vous n\'êtes pas le SAM assigné')
    })
  })
})
