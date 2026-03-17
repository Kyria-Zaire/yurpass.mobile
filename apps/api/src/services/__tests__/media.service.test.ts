import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  EventStatus,
  UserRole,
  AuditAction,
  AuditResult,
  ParticipationStatus,
} from '@yurpass/types'

// ─── Mocks ──────────────────────────────────────────────

const mockMedia = {
  create: vi.fn(),
  findOne: vi.fn(),
  find: vi.fn(),
  updateOne: vi.fn(),
  countDocuments: vi.fn(),
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

const mockUploadEventPhoto = vi.fn()
const mockDeleteCloudinaryAsset = vi.fn()
const mockValidateImageBuffer = vi.fn()

const mockFindEventOrThrow = vi.fn()
const mockAssertHost = vi.fn()

vi.mock('../../models/media.model.js', () => ({
  Media: {
    create: (...args: unknown[]) => mockMedia.create(...args),
    findOne: (...args: unknown[]) => mockMedia.findOne(...args),
    find: (...args: unknown[]) => mockMedia.find(...args),
    updateOne: (...args: unknown[]) => mockMedia.updateOne(...args),
    countDocuments: (...args: unknown[]) => mockMedia.countDocuments(...args),
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

vi.mock('../../lib/cloudinary.js', () => ({
  uploadEventPhoto: (...args: unknown[]) => mockUploadEventPhoto(...args),
  deleteCloudinaryAsset: (...args: unknown[]) => mockDeleteCloudinaryAsset(...args),
  validateImageBuffer: (...args: unknown[]) => mockValidateImageBuffer(...args),
}))

vi.mock('../event.service.js', () => ({
  findEventOrThrow: (...args: unknown[]) => mockFindEventOrThrow(...args),
  assertHost: (...args: unknown[]) => mockAssertHost(...args),
}))

vi.mock('../notification.service.js', () => ({
  NotificationService: {
    notifyMediaModerationPending: vi.fn(),
  },
}))

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('../../lib/env.js', () => ({
  env: { REDIS_URL: 'redis://localhost:6379' },
}))

// ─── Import after mocks ─────────────────────────────────

const { MediaService } = await import('../media.service.js')

// ─── Fixtures ───────────────────────────────────────────

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'mongo-event-id',
    publicId: 'evt-test-01',
    hostId: 'host-001',
    title: 'Soirée Test',
    status: EventStatus.COMPLETED,
    ...overrides,
  }
}

/** Create a minimal File-like object that works in Node without allocating real buffers */
function makeFile(opts: { size?: number; type?: string } = {}): File {
  const size = opts.size ?? 1024
  const type = opts.type ?? 'image/jpeg'
  const buf = new Uint8Array(Math.min(size, 64)) // small real buffer
  const blob = new Blob([buf], { type })
  // Patch .size to simulate large files without allocating memory
  const file = new File([blob], 'photo.jpg', { type })
  if (size !== file.size) {
    Object.defineProperty(file, 'size', { value: size })
  }
  return file
}

function makeMediaDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'mongo-media-id',
    publicId: 'media-0001',
    eventId: 'evt-test-01',
    uploadedBy: 'host-001',
    cloudinaryId: 'yurpass/events/evt-test-01/abc123',
    url: 'https://res.cloudinary.com/test/image/upload/photo.webp',
    width: 1200,
    height: 800,
    status: 'pending',
    deletedAt: null,
    createdAt: new Date(),
    ...overrides,
  }
}

// ─── Tests ──────────────────────────────────────────────

describe('MediaService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── uploadEventPhoto ─────────────────────────────────

  describe('uploadEventPhoto', () => {
    it('should upload photo with status "pending" and AuditLog', async () => {
      const event = makeEvent()
      mockFindEventOrThrow.mockResolvedValue(event)
      mockAssertHost.mockReturnValue(undefined)
      mockValidateImageBuffer.mockReturnValue(true)
      mockMedia.countDocuments.mockResolvedValue(0)
      mockUploadEventPhoto.mockResolvedValue({
        publicId: 'yurpass/events/evt-test-01/abc',
        secureUrl: 'https://res.cloudinary.com/test/photo.webp',
        width: 1600,
        height: 900,
      })
      mockMedia.create.mockResolvedValue({
        publicId: 'media-0001',
        url: 'https://res.cloudinary.com/test/photo.webp',
      })
      mockUser.find.mockResolvedValue([])

      const result = await MediaService.uploadEventPhoto(
        'evt-test-01',
        'host-001',
        makeFile(),
      )

      expect(result.publicId).toBe('media-0001')
      expect(result.url).toContain('cloudinary.com')

      // Media created with status pending
      expect(mockMedia.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: 'evt-test-01',
          uploadedBy: 'host-001',
          status: 'pending',
        }),
      )

      // AuditLog MEDIA_UPLOADED
      expect(mockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.MEDIA_UPLOADED,
          userId: 'host-001',
          eventId: 'evt-test-01',
          result: AuditResult.SUCCESS,
        }),
      )
    })

    it('should reject upload on non-completed event', async () => {
      mockFindEventOrThrow.mockResolvedValue(makeEvent({ status: EventStatus.PUBLISHED }))
      mockAssertHost.mockReturnValue(undefined)

      await expect(
        MediaService.uploadEventPhoto('evt-test-01', 'host-001', makeFile()),
      ).rejects.toThrow('Les photos ne peuvent être ajoutées qu\'aux événements terminés')
    })

    it('should reject files exceeding 10MB', async () => {
      mockFindEventOrThrow.mockResolvedValue(makeEvent())
      mockAssertHost.mockReturnValue(undefined)

      const bigFile = makeFile({ size: 11 * 1024 * 1024 })

      await expect(
        MediaService.uploadEventPhoto('evt-test-01', 'host-001', bigFile),
      ).rejects.toThrow('Le fichier ne doit pas dépasser 10 Mo')
    })

    it('should reject invalid MIME type / magic bytes mismatch', async () => {
      mockFindEventOrThrow.mockResolvedValue(makeEvent())
      mockAssertHost.mockReturnValue(undefined)
      mockValidateImageBuffer.mockReturnValue(false)

      await expect(
        MediaService.uploadEventPhoto('evt-test-01', 'host-001', makeFile({ type: 'application/pdf' })),
      ).rejects.toThrow('Format invalide')
    })
  })

  // ─── getEventPhotos ───────────────────────────────────

  describe('getEventPhotos', () => {
    it('guest should see only approved photos (empty when all pending)', async () => {
      mockUser.findOne.mockResolvedValue({
        publicId: 'guest-001',
        roles: [UserRole.GUEST],
      })
      mockParticipation.findOne.mockResolvedValue({
        userId: 'guest-001',
        eventId: 'evt-test-01',
        status: ParticipationStatus.ATTENDED,
      })
      mockMedia.find.mockReturnValue({
        sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }),
      })

      const result = await MediaService.getEventPhotos('evt-test-01', 'guest-001')

      expect(result.photos).toEqual([])
      expect(result.total).toBe(0)

      // Filter must enforce status: 'approved' for non-admin
      expect(mockMedia.find).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: 'evt-test-01',
          deletedAt: null,
          status: 'approved',
        }),
      )
    })

    it('guest should see photos after admin approval', async () => {
      mockUser.findOne.mockResolvedValue({
        publicId: 'guest-001',
        roles: [UserRole.GUEST],
      })
      mockParticipation.findOne.mockResolvedValue({
        userId: 'guest-001',
        eventId: 'evt-test-01',
        status: ParticipationStatus.ATTENDED,
      })

      const approvedPhoto = makeMediaDoc({ status: 'approved' })
      mockMedia.find.mockReturnValue({
        sort: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([approvedPhoto]),
        }),
      })

      const result = await MediaService.getEventPhotos('evt-test-01', 'guest-001')

      expect(result.photos).toHaveLength(1)
      expect(result.photos[0].publicId).toBe('media-0001')
      expect(result.photos[0].url).toBeDefined()
    })

    it('admin should see all photos including pending', async () => {
      mockUser.findOne.mockResolvedValue({
        publicId: 'admin-001',
        roles: [UserRole.ADMIN],
      })

      const pendingPhoto = makeMediaDoc({ status: 'pending' })
      const approvedPhoto = makeMediaDoc({ publicId: 'media-0002', status: 'approved' })
      mockMedia.find.mockReturnValue({
        sort: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([pendingPhoto, approvedPhoto]),
        }),
      })

      const result = await MediaService.getEventPhotos('evt-test-01', 'admin-001')

      expect(result.photos).toHaveLength(2)

      // No status filter for admin
      const filterArg = mockMedia.find.mock.calls[0][0] as Record<string, unknown>
      expect(filterArg.status).toBeUndefined()
    })

    it('non-participant non-host should be rejected', async () => {
      mockUser.findOne.mockResolvedValue({
        publicId: 'random-user',
        roles: [UserRole.GUEST],
      })
      mockParticipation.findOne.mockResolvedValue(null)
      mockFindEventOrThrow.mockResolvedValue(makeEvent({ hostId: 'host-001' }))

      await expect(
        MediaService.getEventPhotos('evt-test-01', 'random-user'),
      ).rejects.toThrow('Vous devez être participant pour voir les photos')
    })
  })

  // ─── moderatePhoto ────────────────────────────────────

  describe('moderatePhoto', () => {
    it('approve should set status to approved + AuditLog CONTENT_MODERATED', async () => {
      const media = makeMediaDoc()
      mockMedia.findOne.mockResolvedValue(media)
      mockMedia.updateOne.mockResolvedValue({})

      await MediaService.moderatePhoto('media-0001', 'admin-001', 'approve')

      expect(mockMedia.updateOne).toHaveBeenCalledWith(
        { _id: 'mongo-media-id' },
        { $set: { status: 'approved' } },
      )
      expect(mockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.CONTENT_MODERATED,
          userId: 'admin-001',
          metadata: { type: 'photo', action: 'approve' },
        }),
      )
    })

    it('reject should delete from Cloudinary + set status rejected', async () => {
      const media = makeMediaDoc()
      mockMedia.findOne.mockResolvedValue(media)
      mockMedia.updateOne.mockResolvedValue({})
      mockDeleteCloudinaryAsset.mockResolvedValue(undefined)

      await MediaService.moderatePhoto('media-0001', 'admin-001', 'reject')

      expect(mockDeleteCloudinaryAsset).toHaveBeenCalledWith(
        'yurpass/events/evt-test-01/abc123',
      )
      expect(mockMedia.updateOne).toHaveBeenCalledWith(
        { _id: 'mongo-media-id' },
        { $set: { status: 'rejected' } },
      )
    })
  })

  // ─── deletePhoto ──────────────────────────────────────

  describe('deletePhoto', () => {
    it('host (owner) should soft-delete + Cloudinary cleanup', async () => {
      const media = makeMediaDoc()
      mockMedia.findOne.mockResolvedValue(media)
      mockUser.findOne.mockResolvedValue({
        publicId: 'host-001',
        roles: [UserRole.HOST],
      })
      mockDeleteCloudinaryAsset.mockResolvedValue(undefined)
      mockMedia.updateOne.mockResolvedValue({})

      await MediaService.deletePhoto('media-0001', 'host-001')

      expect(mockDeleteCloudinaryAsset).toHaveBeenCalledWith(
        'yurpass/events/evt-test-01/abc123',
      )
      // Soft delete
      expect(mockMedia.updateOne).toHaveBeenCalledWith(
        { _id: 'mongo-media-id' },
        { $set: { deletedAt: expect.any(Date) } },
      )
      expect(mockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.MEDIA_DELETED,
          userId: 'host-001',
        }),
      )
    })

    it('non-owner non-admin should be rejected', async () => {
      const media = makeMediaDoc()
      mockMedia.findOne.mockResolvedValue(media)
      mockUser.findOne.mockResolvedValue({
        publicId: 'random-user',
        roles: [UserRole.GUEST],
      })

      await expect(
        MediaService.deletePhoto('media-0001', 'random-user'),
      ).rejects.toThrow('Seul l\'hôte ou un admin peut supprimer cette photo')
    })
  })

  // ─── Full flow: upload → pending → approve → visible ──

  describe('full moderation flow', () => {
    it('upload creates pending, guest sees nothing, admin approves, guest sees photo', async () => {
      // Step 1: Host uploads → status: pending
      mockFindEventOrThrow.mockResolvedValue(makeEvent())
      mockAssertHost.mockReturnValue(undefined)
      mockValidateImageBuffer.mockReturnValue(true)
      mockMedia.countDocuments.mockResolvedValue(0)
      mockUploadEventPhoto.mockResolvedValue({
        publicId: 'yurpass/events/evt-test-01/photo1',
        secureUrl: 'https://res.cloudinary.com/test/photo1.webp',
        width: 1600,
        height: 900,
      })
      mockMedia.create.mockResolvedValue({
        publicId: 'media-new-1',
        url: 'https://res.cloudinary.com/test/photo1.webp',
      })
      mockUser.find.mockResolvedValue([{ publicId: 'admin-001' }])

      const uploadResult = await MediaService.uploadEventPhoto(
        'evt-test-01',
        'host-001',
        makeFile(),
      )

      expect(uploadResult.publicId).toBe('media-new-1')
      expect(mockMedia.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pending' }),
      )

      // Step 2: Guest queries → empty (only approved visible)
      vi.clearAllMocks()
      mockUser.findOne.mockResolvedValue({
        publicId: 'guest-001',
        roles: [UserRole.GUEST],
      })
      mockParticipation.findOne.mockResolvedValue({
        userId: 'guest-001',
        eventId: 'evt-test-01',
        status: ParticipationStatus.ATTENDED,
      })
      mockMedia.find.mockReturnValue({
        sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }),
      })

      const guestBefore = await MediaService.getEventPhotos('evt-test-01', 'guest-001')
      expect(guestBefore.photos).toHaveLength(0)
      expect(mockMedia.find).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'approved' }),
      )

      // Step 3: Admin approves
      vi.clearAllMocks()
      mockMedia.findOne.mockResolvedValue(makeMediaDoc({ publicId: 'media-new-1' }))
      mockMedia.updateOne.mockResolvedValue({})

      await MediaService.moderatePhoto('media-new-1', 'admin-001', 'approve')

      expect(mockMedia.updateOne).toHaveBeenCalledWith(
        expect.anything(),
        { $set: { status: 'approved' } },
      )

      // Step 4: Guest queries again → sees the photo
      vi.clearAllMocks()
      mockUser.findOne.mockResolvedValue({
        publicId: 'guest-001',
        roles: [UserRole.GUEST],
      })
      mockParticipation.findOne.mockResolvedValue({
        userId: 'guest-001',
        eventId: 'evt-test-01',
        status: ParticipationStatus.ATTENDED,
      })
      mockMedia.find.mockReturnValue({
        sort: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([
            makeMediaDoc({ publicId: 'media-new-1', status: 'approved' }),
          ]),
        }),
      })

      const guestAfter = await MediaService.getEventPhotos('evt-test-01', 'guest-001')
      expect(guestAfter.photos).toHaveLength(1)
      expect(guestAfter.photos[0].publicId).toBe('media-new-1')
    })
  })
})
