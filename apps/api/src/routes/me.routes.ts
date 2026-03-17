import { Hono } from 'hono'
import { authMiddleware } from '../middlewares/auth.middleware.js'
import { GuestService } from '../services/guest.service.js'
import { NotificationService } from '../services/notification.service.js'
import { handleApiError } from '../middlewares/error-handler.js'
import { participationParamsSchema, registerPushTokenSchema, removePushTokenSchema } from '@yurpass/validators'

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
