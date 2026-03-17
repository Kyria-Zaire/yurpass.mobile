import { Media } from '../models/media.model.js'
import { Participation } from '../models/participation.model.js'
import { User } from '../models/user.model.js'
import { AuditLog } from '../models/audit-log.model.js'
import { logger } from '../lib/logger.js'
import {
  uploadEventPhoto,
  deleteCloudinaryAsset,
  validateImageBuffer,
} from '../lib/cloudinary.js'
import { findEventOrThrow, assertHost } from './event.service.js'
import { NotificationService } from './notification.service.js'
import {
  EventStatus,
  ParticipationStatus,
  UserRole,
  AuditAction,
  AuditResult,
} from '@yurpass/types'
import { AppError, NotFoundError, ForbiddenError } from '../middlewares/error-handler.js'

const MAX_EVENT_PHOTO_SIZE = 10 * 1024 * 1024 // 10 MB
const MAX_PHOTOS_PER_EVENT = 50

export class MediaService {
  // ─── Upload event photo (host only, RB-018) ───────────────

  static async uploadEventPhoto(
    eventId: string,
    hostId: string,
    file: File,
  ): Promise<{ publicId: string; url: string }> {
    const event = await findEventOrThrow(eventId)
    assertHost(event, hostId)

    // Event must be completed
    if (event.status !== EventStatus.COMPLETED) {
      throw new AppError(
        'Les photos ne peuvent être ajoutées qu\'aux événements terminés',
        422,
        'INVALID_STATUS',
      )
    }

    // File size check
    if (file.size > MAX_EVENT_PHOTO_SIZE) {
      throw new AppError('Le fichier ne doit pas dépasser 10 Mo', 422, 'FILE_TOO_LARGE')
    }

    const buffer = await file.arrayBuffer()

    // MIME type + magic bytes validation
    if (!validateImageBuffer(buffer, file.type)) {
      throw new AppError(
        'Format invalide — seuls JPEG, PNG et WebP sont acceptés',
        422,
        'INVALID_FILE_TYPE',
      )
    }

    // Limit photos per event
    const photoCount = await Media.countDocuments({
      eventId,
      deletedAt: null,
      status: { $ne: 'rejected' },
    })
    if (photoCount >= MAX_PHOTOS_PER_EVENT) {
      throw new AppError(
        `Maximum ${MAX_PHOTOS_PER_EVENT} photos par événement`,
        422,
        'MAX_PHOTOS_REACHED',
      )
    }

    // Upload to Cloudinary
    const cloudinaryResult = await uploadEventPhoto(buffer, eventId)

    // Create media document (pending moderation)
    const media = await Media.create({
      eventId,
      uploadedBy: hostId,
      cloudinaryId: cloudinaryResult.publicId,
      url: cloudinaryResult.secureUrl,
      width: cloudinaryResult.width,
      height: cloudinaryResult.height,
      status: 'pending',
    })

    await AuditLog.create({
      action: AuditAction.MEDIA_UPLOADED,
      userId: hostId,
      eventId,
      targetId: media.publicId,
      metadata: { cloudinaryId: cloudinaryResult.publicId },
      result: AuditResult.SUCCESS,
    })

    logger.info({ eventId, hostId, mediaId: media.publicId }, 'Event photo uploaded')

    // Notify admins for moderation
    const admins = await User.find(
      { roles: UserRole.ADMIN, deletedAt: null },
      { publicId: 1 },
    ).lean()

    const adminIds = admins.map((a) => a.publicId)
    if (adminIds.length > 0) {
      NotificationService.notifyMediaModerationPending(adminIds, event.title, eventId)
    }

    return { publicId: media.publicId, url: cloudinaryResult.secureUrl }
  }

  // ─── Get event photos ─────────────────────────────────────

  static async getEventPhotos(
    eventId: string,
    requesterId: string,
  ) {
    // Check requester access — must be participant or admin
    const requester = await User.findOne(
      { publicId: requesterId, deletedAt: null },
      { roles: 1 },
    ).lean()

    if (!requester) {
      throw new ForbiddenError('Accès refusé')
    }

    const isAdmin = (requester.roles as string[]).includes(UserRole.ADMIN)

    if (!isAdmin) {
      // Verify participation
      const participation = await Participation.findOne({
        userId: requesterId,
        eventId,
        status: { $in: [ParticipationStatus.APPROVED, ParticipationStatus.ATTENDED] },
      })

      if (!participation) {
        // Also allow the host
        const event = await findEventOrThrow(eventId)
        if (event.hostId !== requesterId) {
          throw new ForbiddenError('Vous devez être participant pour voir les photos')
        }
      }
    }

    // Admin sees all (including pending), participants see approved only
    const filter: Record<string, unknown> = {
      eventId,
      deletedAt: null,
    }

    if (!isAdmin) {
      filter.status = 'approved'
    }

    const photos = await Media.find(filter)
      .sort({ createdAt: -1 })
      .lean()

    return {
      photos: photos.map((p) => ({
        publicId: p.publicId,
        url: p.url,
        width: p.width,
        height: p.height,
        status: p.status,
        uploadedBy: p.uploadedBy,
        createdAt: p.createdAt,
      })),
      total: photos.length,
    }
  }

  // ─── Moderate photo (admin) ───────────────────────────────

  static async moderatePhoto(
    mediaId: string,
    adminId: string,
    action: 'approve' | 'reject',
  ): Promise<void> {
    const media = await Media.findOne({ publicId: mediaId, deletedAt: null })
    if (!media) {
      throw new NotFoundError('Photo introuvable')
    }

    if (action === 'reject') {
      // Delete from Cloudinary
      await deleteCloudinaryAsset(media.cloudinaryId)

      await Media.updateOne(
        { _id: media._id },
        { $set: { status: 'rejected' } },
      )
    } else {
      await Media.updateOne(
        { _id: media._id },
        { $set: { status: 'approved' } },
      )
    }

    await AuditLog.create({
      action: AuditAction.CONTENT_MODERATED,
      userId: adminId,
      targetId: mediaId,
      eventId: media.eventId,
      metadata: { type: 'photo', action },
      result: AuditResult.SUCCESS,
    })

    logger.info({ mediaId, adminId, action }, 'Photo moderated')
  }

  // ─── Delete photo (host or admin) ─────────────────────────

  static async deletePhoto(
    mediaId: string,
    requesterId: string,
  ): Promise<void> {
    const media = await Media.findOne({ publicId: mediaId, deletedAt: null })
    if (!media) {
      throw new NotFoundError('Photo introuvable')
    }

    // Check ownership or admin role
    const requester = await User.findOne(
      { publicId: requesterId, deletedAt: null },
      { roles: 1 },
    ).lean()

    const isAdmin = requester && (requester.roles as string[]).includes(UserRole.ADMIN)
    const isOwner = media.uploadedBy === requesterId

    if (!isAdmin && !isOwner) {
      throw new ForbiddenError('Seul l\'hôte ou un admin peut supprimer cette photo')
    }

    // Delete from Cloudinary
    await deleteCloudinaryAsset(media.cloudinaryId)

    // Soft delete
    await Media.updateOne(
      { _id: media._id },
      { $set: { deletedAt: new Date() } },
    )

    await AuditLog.create({
      action: AuditAction.MEDIA_DELETED,
      userId: requesterId,
      targetId: mediaId,
      eventId: media.eventId,
      metadata: { cloudinaryId: media.cloudinaryId },
      result: AuditResult.SUCCESS,
    })

    logger.info({ mediaId, requesterId }, 'Photo deleted')
  }
}
