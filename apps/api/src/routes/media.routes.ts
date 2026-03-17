import { Hono } from 'hono'
import { authMiddleware, requireRole, require2FA } from '../middlewares/auth.middleware.js'
import { validate } from '../middlewares/validate.js'
import { MediaService } from '../services/media.service.js'
import { handleApiError } from '../middlewares/error-handler.js'
import { AppError } from '../middlewares/error-handler.js'
import { eventParamsSchema } from '@yurpass/validators'
import { UserRole } from '@yurpass/types'
import { z } from 'zod'

const mediaParamsSchema = z.object({
  id: z.string().min(10).max(10),
})

const moderatePhotoSchema = z.object({
  action: z.enum(['approve', 'reject']),
})

const mediaRoutes = new Hono()

// ─── POST /events/:eventId/photos — Upload photo (host only, RB-018) ─

mediaRoutes.post(
  '/events/:eventId/photos',
  authMiddleware,
  requireRole([UserRole.HOST, UserRole.ADMIN]),
  require2FA,
  async (c) => {
    try {
      const user = c.get('user')
      const { eventId } = eventParamsSchema.parse({ eventId: c.req.param('eventId') })

      const body = await c.req.parseBody()
      const file = body['photo']

      if (!(file instanceof File)) {
        throw new AppError('Fichier photo requis (champ "photo")', 422, 'MISSING_FILE')
      }

      const result = await MediaService.uploadEventPhoto(eventId, user.publicId, file)
      return c.json({ success: true, data: result }, 201)
    } catch (error: unknown) {
      return handleApiError(c, error)
    }
  },
)

// ─── GET /events/:eventId/photos — Get event photos (participants) ─

mediaRoutes.get(
  '/events/:eventId/photos',
  authMiddleware,
  async (c) => {
    try {
      const user = c.get('user')
      const { eventId } = eventParamsSchema.parse({ eventId: c.req.param('eventId') })
      const result = await MediaService.getEventPhotos(eventId, user.publicId)
      return c.json({ success: true, data: result })
    } catch (error: unknown) {
      return handleApiError(c, error)
    }
  },
)

// ─── PUT /photos/:id/moderate — Admin moderate photo ─────────

mediaRoutes.put(
  '/photos/:id/moderate',
  authMiddleware,
  requireRole([UserRole.ADMIN]),
  require2FA,
  validate(moderatePhotoSchema),
  async (c) => {
    try {
      const user = c.get('user')
      const { id } = mediaParamsSchema.parse({ id: c.req.param('id') })
      const { action } = c.get('validatedBody' as never) as z.infer<typeof moderatePhotoSchema>
      await MediaService.moderatePhoto(id, user.publicId, action)
      return c.json({ success: true, message: action === 'approve' ? 'Photo approuvée' : 'Photo rejetée' })
    } catch (error: unknown) {
      return handleApiError(c, error)
    }
  },
)

// ─── DELETE /photos/:id — Delete photo (host or admin) ───────

mediaRoutes.delete(
  '/photos/:id',
  authMiddleware,
  async (c) => {
    try {
      const user = c.get('user')
      const { id } = mediaParamsSchema.parse({ id: c.req.param('id') })
      await MediaService.deletePhoto(id, user.publicId)
      return c.json({ success: true, message: 'Photo supprimée' })
    } catch (error: unknown) {
      return handleApiError(c, error)
    }
  },
)

export { mediaRoutes }
