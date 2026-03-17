import { Hono } from 'hono'
import { authMiddleware } from '../middlewares/auth.middleware.js'
import { validate } from '../middlewares/validate.js'
import { GuestService } from '../services/guest.service.js'
import { NotificationService } from '../services/notification.service.js'
import { User } from '../models/user.model.js'
import { AuditLog } from '../models/audit-log.model.js'
import { handleApiError } from '../middlewares/error-handler.js'
import { AppError, NotFoundError } from '../middlewares/error-handler.js'
import { logger } from '../lib/logger.js'
import { uploadAvatar, deleteCloudinaryAsset, validateImageBuffer } from '../lib/cloudinary.js'
import {
  participationParamsSchema,
  registerPushTokenSchema,
  removePushTokenSchema,
  updateProfileSchema,
} from '@yurpass/validators'
import { AuditAction, AuditResult } from '@yurpass/types'

const MAX_AVATAR_SIZE = 5 * 1024 * 1024 // 5 MB

const meRoutes = new Hono()

// ─── GET /me/participations/:participationId — My ticket (guest) ───

meRoutes.get(
  '/participations/:participationId',
  authMiddleware,
  async (c) => {
    try {
      const user = c.get('user')
      const { participationId } = participationParamsSchema.parse({
        participationId: c.req.param('participationId'),
      })
      const result = await GuestService.getMyParticipation(user.publicId, participationId)
      return c.json({ success: true, data: result })
    } catch (error: unknown) {
      return handleApiError(c, error)
    }
  },
)

// ─── DELETE /me/participations/:participationId — Cancel participation (RB-011) ───

meRoutes.delete(
  '/participations/:participationId',
  authMiddleware,
  async (c) => {
    try {
      const user = c.get('user')
      const { participationId } = participationParamsSchema.parse({
        participationId: c.req.param('participationId'),
      })
      await GuestService.cancelParticipation(user.publicId, participationId)
      return c.json({ success: true, message: 'Participation annulée' })
    } catch (error: unknown) {
      return handleApiError(c, error)
    }
  },
)

// ─── PATCH /me/profile — Update profile fields ──────────────

meRoutes.patch(
  '/profile',
  authMiddleware,
  validate(updateProfileSchema),
  async (c) => {
    try {
      const authUser = c.get('user')
      const input = c.get('validatedBody' as never) as {
        displayName?: string
        bio?: string
        city?: string
      }

      const updateFields: Record<string, unknown> = {}
      if (input.displayName !== undefined) updateFields['profile.displayName'] = input.displayName
      if (input.bio !== undefined) updateFields['profile.bio'] = input.bio
      if (input.city !== undefined) updateFields['profile.city'] = input.city

      const user = await User.findOneAndUpdate(
        { publicId: authUser.publicId, deletedAt: null },
        { $set: updateFields },
        { new: true, projection: { 'profile.displayName': 1, 'profile.avatarUrl': 1, 'profile.bio': 1, 'profile.city': 1 } },
      ).lean()

      if (!user) {
        throw new NotFoundError('Utilisateur introuvable')
      }

      await AuditLog.create({
        action: AuditAction.PROFILE_UPDATED,
        userId: authUser.publicId,
        metadata: { fields: Object.keys(input) },
        result: AuditResult.SUCCESS,
      })

      logger.info({ userId: authUser.publicId, fields: Object.keys(input) }, 'Profile updated')

      return c.json({
        success: true,
        data: {
          displayName: (user.profile as { displayName: string }).displayName,
          avatarUrl: (user.profile as { avatarUrl?: string }).avatarUrl,
          bio: (user.profile as { bio?: string }).bio,
          city: (user.profile as { city: string }).city,
        },
      })
    } catch (error: unknown) {
      return handleApiError(c, error)
    }
  },
)

// ─── POST /me/avatar — Upload avatar image ──────────────────

meRoutes.post(
  '/avatar',
  authMiddleware,
  async (c) => {
    try {
      const authUser = c.get('user')

      const body = await c.req.parseBody()
      const file = body['avatar']

      if (!(file instanceof File)) {
        throw new AppError('Fichier avatar requis (champ "avatar")', 422, 'MISSING_FILE')
      }

      if (file.size > MAX_AVATAR_SIZE) {
        throw new AppError('Le fichier ne doit pas dépasser 5 Mo', 422, 'FILE_TOO_LARGE')
      }

      const buffer = await file.arrayBuffer()

      // Validate MIME type + magic bytes
      if (!validateImageBuffer(buffer, file.type)) {
        throw new AppError(
          'Format invalide — seuls JPEG, PNG et WebP sont acceptés',
          422,
          'INVALID_FILE_TYPE',
        )
      }

      // Fetch current user to get old cloudinaryAvatarId
      const currentUser = await User.findOne(
        { publicId: authUser.publicId, deletedAt: null },
        { 'profile.cloudinaryAvatarId': 1 },
      ).lean()

      if (!currentUser) {
        throw new NotFoundError('Utilisateur introuvable')
      }

      const oldCloudinaryId = (currentUser.profile as { cloudinaryAvatarId?: string }).cloudinaryAvatarId

      // Upload to Cloudinary
      const { publicId, secureUrl } = await uploadAvatar(buffer, authUser.publicId)

      // Update user
      await User.updateOne(
        { publicId: authUser.publicId },
        {
          $set: {
            'profile.avatarUrl': secureUrl,
            'profile.cloudinaryAvatarId': publicId,
          },
        },
      )

      // Delete old image if different
      if (oldCloudinaryId && oldCloudinaryId !== publicId) {
        void deleteCloudinaryAsset(oldCloudinaryId)
      }

      await AuditLog.create({
        action: AuditAction.PROFILE_UPDATED,
        userId: authUser.publicId,
        metadata: { field: 'avatar' },
        result: AuditResult.SUCCESS,
      })

      logger.info({ userId: authUser.publicId }, 'Avatar uploaded')

      return c.json({ success: true, data: { avatarUrl: secureUrl } })
    } catch (error: unknown) {
      return handleApiError(c, error)
    }
  },
)

// ─── PUT /me/push-token — Register push token ───────────

meRoutes.put(
  '/push-token',
  authMiddleware,
  async (c) => {
    try {
      const user = c.get('user')
      const body = await c.req.json()
      const { token, platform } = registerPushTokenSchema.parse(body)
      await NotificationService.registerPushToken(user.publicId, token, platform)
      return c.json({ success: true })
    } catch (error: unknown) {
      return handleApiError(c, error)
    }
  },
)

// ─── DELETE /me/push-token — Unregister push token ──────

meRoutes.delete(
  '/push-token',
  authMiddleware,
  async (c) => {
    try {
      const user = c.get('user')
      const body = await c.req.json()
      const { token } = removePushTokenSchema.parse(body)
      await NotificationService.removePushToken(user.publicId, token)
      return c.json({ success: true })
    } catch (error: unknown) {
      return handleApiError(c, error)
    }
  },
)

export { meRoutes }
