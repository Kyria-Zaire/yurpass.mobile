import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  EventStatus,
  ParticipationStatus,
  RatingRole,
  AuditAction,
  AuditResult,
} from '@yurpass/types'
import type { CreateRatingInput } from '@yurpass/types'

// ─── Mocks ──────────────────────────────────────────────

const mockRating = {
  create: vi.fn(),
  findOne: vi.fn(),
  find: vi.fn(),
}

const mockUser = {
  updateOne: vi.fn(),
}

const mockParticipation = {
  findOne: vi.fn(),
}

const mockAuditLog = {
  create: vi.fn(),
}

const mockFindEventOrThrow = vi.fn()

vi.mock('../../models/rating.model.js', () => ({
  Rating: {
    create: (...args: unknown[]) => mockRating.create(...args),
    findOne: (...args: unknown[]) => mockRating.findOne(...args),
    find: (...args: unknown[]) => {
      const result = mockRating.find(...args)
      return {
        select: () => ({
          lean: () => result,
        }),
      }
    },
  },
}))

vi.mock('../../models/user.model.js', () => ({
  User: {
    updateOne: (...args: unknown[]) => mockUser.updateOne(...args),
  },
}))

vi.mock('../../models/participation.model.js', () => ({
  Participation: {
    findOne: (...args: unknown[]) => mockParticipation.findOne(...args),
  },
}))

vi.mock('../../models/audit-log.model.js', () => ({
  AuditLog: {
    create: (...args: unknown[]) => mockAuditLog.create(...args),
  },
}))

vi.mock('../event.service.js', () => ({
  findEventOrThrow: (...args: unknown[]) => mockFindEventOrThrow(...args),
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

// ─── Import after mocks ─────────────────────────────────

const { RatingService } = await import('../rating.service.js')

// ─── Fixtures ───────────────────────────────────────────

function makeEvent(endDateOffset: number) {
  const endDate = new Date(Date.now() + endDateOffset)
  return {
    _id: 'mongo-evt',
    publicId: 'evt-test-01',
    hostId: 'host-001',
    title: 'Soirée Test',
    status: EventStatus.COMPLETED,
    schedule: {
      startDate: new Date(endDate.getTime() - 6 * 60 * 60 * 1000),
      endDate,
      doorsOpenAt: new Date(endDate.getTime() - 7 * 60 * 60 * 1000),
    },
  }
}

const validInput: CreateRatingInput = {
  toUserId: 'user-target',
  eventId: 'evt-test-01',
  role: RatingRole.AS_GUEST,
  score: 4,
  comment: 'Super soirée',
}

// ─── Tests ──────────────────────────────────────────────

describe('RatingService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── submitRating ─────────────────────────────────────

  describe('submitRating', () => {
    it('should create rating J+25h after endDate', async () => {
      // endDate was 25 hours ago → within window
      const event = makeEvent(-25 * 60 * 60 * 1000)
      mockFindEventOrThrow.mockResolvedValue(event)
      mockParticipation.findOne.mockResolvedValue({ userId: 'rater-001' })
      mockRating.findOne.mockResolvedValue(null) // no duplicate
      mockRating.create.mockResolvedValue({ publicId: 'rat-xxx' })

      const result = await RatingService.submitRating(validInput, 'rater-001')

      expect(result.publicId).toBe('rat-xxx')
      expect(mockRating.create).toHaveBeenCalledWith(
        expect.objectContaining({
          fromUserId: 'rater-001',
          toUserId: 'user-target',
          score: 4,
          role: RatingRole.AS_GUEST,
        }),
      )
      expect(mockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.RATING_SUBMITTED,
          result: AuditResult.SUCCESS,
        }),
      )
    })

    it('RB-013: should reject rating at J+23h (before 24h window opens)', async () => {
      // endDate was 23 hours ago → too early
      const event = makeEvent(-23 * 60 * 60 * 1000)
      mockFindEventOrThrow.mockResolvedValue(event)

      await expect(
        RatingService.submitRating(validInput, 'rater-001'),
      ).rejects.toThrow('Notation disponible à partir du')
    })

    it('RB-014: should reject rating at J+8 days (window closed)', async () => {
      // endDate was 8 days ago → window expired
      const event = makeEvent(-8 * 24 * 60 * 60 * 1000)
      mockFindEventOrThrow.mockResolvedValue(event)
      mockParticipation.findOne.mockResolvedValue({ userId: 'rater-001' })

      await expect(
        RatingService.submitRating(validInput, 'rater-001'),
      ).rejects.toThrow('fenêtre de notation est fermée')
    })

    it('should reject duplicate rating same event + same role', async () => {
      const event = makeEvent(-25 * 60 * 60 * 1000)
      mockFindEventOrThrow.mockResolvedValue(event)
      mockParticipation.findOne.mockResolvedValue({ userId: 'rater-001' })
      mockRating.findOne.mockResolvedValue({ publicId: 'existing-rating' }) // duplicate

      await expect(
        RatingService.submitRating(validInput, 'rater-001'),
      ).rejects.toThrow('déjà noté')
    })
  })

  // ─── calculateReputationScore (RB-015) ────────────────

  describe('calculateReputationScore', () => {
    it('should apply weighted scores: host 1.5x, SAM 1.3x, guest 1.0x', async () => {
      // 1 host rating (5), 1 guest rating (3), 1 sam rating (4)
      // weighted = (5*1.5 + 3*1.0 + 4*1.3) / (1.5+1.0+1.3) = (7.5+3+5.2)/3.8 = 15.7/3.8 ≈ 4.1
      mockRating.find.mockResolvedValue([
        { role: RatingRole.AS_HOST, score: 5, createdAt: new Date() },
        { role: RatingRole.AS_GUEST, score: 3, createdAt: new Date() },
        { role: RatingRole.AS_SAM, score: 4, createdAt: new Date() },
      ])
      mockUser.updateOne.mockResolvedValue({})

      const result = await RatingService.calculateReputationScore('user-target')

      expect(result.avgRating).toBe(4.1)
      expect(result.score).toBe(82) // 4.1 * 20
      expect(result.totalRatings).toBe(3)
      expect(result.breakdown.asHost.count).toBe(1)
      expect(result.breakdown.asGuest.count).toBe(1)
      expect(result.breakdown.asSam.count).toBe(1)
    })

    it('should only include ratings from last 12 months', async () => {
      // The find query should use $gte with 12 months ago
      mockRating.find.mockResolvedValue([])
      mockUser.updateOne.mockResolvedValue({})

      await RatingService.calculateReputationScore('user-target')

      // Verify the filter passed to Rating.find includes createdAt $gte
      const findCall = mockRating.find.mock.calls[0][0] as Record<string, unknown>
      expect(findCall.toUserId).toBe('user-target')
      expect(findCall.createdAt).toBeDefined()
      const gte = (findCall.createdAt as Record<string, Date>).$gte
      // Should be ~12 months ago
      const monthsDiff = (Date.now() - gte.getTime()) / (30 * 24 * 60 * 60 * 1000)
      expect(monthsDiff).toBeGreaterThan(11)
      expect(monthsDiff).toBeLessThan(13)
    })
  })
})
