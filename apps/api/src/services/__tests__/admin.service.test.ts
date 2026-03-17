import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  UserRole,
  EventStatus,
  AuditAction,
  AuditResult,
} from '@yurpass/types'

// ─── Mocks ──────────────────────────────────────────────

const mockUser = {
  findOne: vi.fn(),
  updateOne: vi.fn(),
  countDocuments: vi.fn(),
}

const mockEvent = {
  countDocuments: vi.fn(),
}

const mockMedia = {
  countDocuments: vi.fn(),
  find: vi.fn(),
}

const mockSamMission = {
  countDocuments: vi.fn(),
}

const mockAuditLog = {
  create: vi.fn(),
}

vi.mock('../../models/user.model.js', () => ({
  User: {
    findOne: (...args: unknown[]) => mockUser.findOne(...args),
    updateOne: (...args: unknown[]) => mockUser.updateOne(...args),
    countDocuments: (...args: unknown[]) => mockUser.countDocuments(...args),
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    }),
  },
}))

vi.mock('../../models/event.model.js', () => ({
  Event: {
    countDocuments: (...args: unknown[]) => mockEvent.countDocuments(...args),
  },
}))

vi.mock('../../models/media.model.js', () => ({
  Media: {
    countDocuments: (...args: unknown[]) => mockMedia.countDocuments(...args),
    find: (...args: unknown[]) => {
      const result = mockMedia.find(...args)
      return {
        sort: () => ({
          limit: () => ({
            lean: () => result,
          }),
        }),
      }
    },
  },
}))

vi.mock('../../models/sam-mission.model.js', () => ({
  SamMission: {
    countDocuments: (...args: unknown[]) => mockSamMission.countDocuments(...args),
  },
}))

vi.mock('../../models/audit-log.model.js', () => ({
  AuditLog: {
    create: (...args: unknown[]) => mockAuditLog.create(...args),
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    findOne: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    }),
  },
}))

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

// ─── Import after mocks ─────────────────────────────────

const { AdminService } = await import('../admin.service.js')

// ─── Tests ──────────────────────────────────────────────

describe('AdminService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── banUser ──────────────────────────────────────────

  describe('banUser', () => {
    it('should set deletedAt on ban', async () => {
      mockUser.findOne.mockResolvedValue({
        _id: 'mongo-user-id',
        publicId: 'user-target',
        roles: [UserRole.GUEST],
        deletedAt: null,
      })
      mockUser.updateOne.mockResolvedValue({})

      await AdminService.banUser('user-target', 'admin-001', 'Comportement abusif')

      expect(mockUser.updateOne).toHaveBeenCalledWith(
        { _id: 'mongo-user-id' },
        { $set: { deletedAt: expect.any(Date) } },
      )
      expect(mockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.USER_BANNED,
          userId: 'admin-001',
          targetId: 'user-target',
          metadata: { reason: 'Comportement abusif' },
          result: AuditResult.SUCCESS,
        }),
      )
    })

    it('should prevent banning an admin', async () => {
      mockUser.findOne.mockResolvedValue({
        _id: 'mongo-admin-id',
        publicId: 'admin-target',
        roles: [UserRole.ADMIN],
        deletedAt: null,
      })

      await expect(
        AdminService.banUser('admin-target', 'admin-001', 'Test'),
      ).rejects.toThrow('Impossible de bannir un administrateur')
    })
  })

  // ─── certifySAM ──────────────────────────────────────

  describe('certifySAM', () => {
    it('should set verifiedAt and create audit log', async () => {
      mockUser.findOne.mockResolvedValue({
        _id: 'mongo-sam-id',
        publicId: 'sam-user',
        roles: [UserRole.GUEST, UserRole.SAM],
        profile: { displayName: 'SAM User', verifiedAt: undefined },
        deletedAt: null,
      })
      mockUser.updateOne.mockResolvedValue({})

      await AdminService.certifySAM('sam-user', 'admin-001')

      expect(mockUser.updateOne).toHaveBeenCalledWith(
        { _id: 'mongo-sam-id' },
        { $set: { 'profile.verifiedAt': expect.any(Date) } },
      )
      expect(mockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.SAM_CERTIFIED,
          userId: 'admin-001',
          targetId: 'sam-user',
          result: AuditResult.SUCCESS,
        }),
      )
    })
  })

  // ─── getStats ─────────────────────────────────────────

  describe('getStats', () => {
    it('should return all expected metrics', async () => {
      // Mock all countDocuments calls in order
      mockUser.countDocuments
        .mockResolvedValueOnce(100) // totalUsers
        .mockResolvedValueOnce(3) // banned
        .mockResolvedValueOnce(2) // suspended
        .mockResolvedValueOnce(80) // guest
        .mockResolvedValueOnce(15) // host
        .mockResolvedValueOnce(5) // sam
        .mockResolvedValueOnce(2) // model
        .mockResolvedValueOnce(3) // admin

      mockEvent.countDocuments
        .mockResolvedValueOnce(50) // total
        .mockResolvedValueOnce(5) // draft
        .mockResolvedValueOnce(20) // published
        .mockResolvedValueOnce(3) // full
        .mockResolvedValueOnce(2) // ongoing
        .mockResolvedValueOnce(18) // completed
        .mockResolvedValueOnce(2) // cancelled

      mockMedia.countDocuments.mockResolvedValue(7) // pending
      mockSamMission.countDocuments.mockResolvedValue(1) // unresolved urgent

      const stats = await AdminService.getStats()

      expect(stats.users.total).toBe(100)
      expect(stats.users.banned).toBe(3)
      expect(stats.users.suspended).toBe(2)
      expect(stats.users.byRole.guest).toBe(80)
      expect(stats.users.byRole.host).toBe(15)
      expect(stats.users.byRole.sam).toBe(5)
      expect(stats.events.total).toBe(50)
      expect(stats.events.byStatus.completed).toBe(18)
      expect(stats.media.pendingModeration).toBe(7)
      expect(stats.incidents.unresolvedUrgent).toBe(1)
    })
  })

  // ─── getPendingContent ────────────────────────────────

  describe('getPendingContent', () => {
    it('should return pending photos', async () => {
      mockMedia.find.mockResolvedValue([
        {
          publicId: 'photo-001',
          eventId: 'evt-01',
          uploadedBy: 'host-001',
          url: 'https://cdn.test/photo.jpg',
          width: 1920,
          height: 1080,
          status: 'pending',
          createdAt: new Date(),
        },
      ])

      const result = await AdminService.getPendingContent()

      expect(result.photos).toHaveLength(1)
      expect(result.photos[0].publicId).toBe('photo-001')
      expect(result.photos[0].status).toBe('pending')
      expect(result.total).toBe(1)
    })
  })

  // ─── restoreUser ──────────────────────────────────────

  describe('restoreUser', () => {
    it('should restore banned user (clear deletedAt)', async () => {
      mockUser.findOne.mockResolvedValue({
        _id: 'mongo-user-id',
        publicId: 'banned-user',
        roles: [UserRole.GUEST],
        deletedAt: new Date(),
        security: { lockedUntil: null },
      })
      mockUser.updateOne.mockResolvedValue({})

      await AdminService.restoreUser('banned-user', 'admin-001', 'Erreur de ban')

      expect(mockUser.updateOne).toHaveBeenCalledWith(
        { _id: 'mongo-user-id' },
        { $set: expect.objectContaining({ deletedAt: null }) },
      )
      expect(mockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.USER_RESTORED,
          result: AuditResult.SUCCESS,
        }),
      )
    })
  })
})
