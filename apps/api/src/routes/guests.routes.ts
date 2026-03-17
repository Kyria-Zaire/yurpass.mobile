import { Hono } from 'hono'
import { authMiddleware, requireRole, require2FA } from '../middlewares/auth.middleware.js'
import { validate } from '../middlewares/validate.js'
import { scanCodeRateLimit } from '../middlewares/rate-limit.js'
import { GuestService } from '../services/guest.service.js'
import { handleApiError } from '../middlewares/error-handler.js'
import {
  inviteGuestSchema,
  approveGuestSchema,
  scanAccessCodeSchema,
  guestListQuerySchema,
  eventParamsSchema,
} from '@yurpass/validators'
import { UserRole, ParticipationStatus } from '@yurpass/types'
import type { z } from 'zod'

const guestsRoutes = new Hono()

// ─── POST /events/:eventId/guests/invite — Host invites ─────

guestsRoutes.post(
  '/:eventId/guests/invite',
  authMiddleware,
  requireRole([UserRole.HOST, UserRole.ADMIN]),
  require2FA,
  validate(inviteGuestSchema),
  async (c) => {
    try {
      const user = c.get('user')
      const { eventId } = eventParamsSchema.parse({ eventId: c.req.param('eventId') })
      const { guestUserId } = c.get('validatedBody' as never) as z.infer<typeof inviteGuestSchema>
      const result = await GuestService.inviteGuest(user.publicId, eventId, guestUserId)
      return c.json({ success: true, data: result }, 201)
    } catch (error: unknown) {
      return handleApiError(c, error)
    }
  },
)

// ─── POST /events/:eventId/guests/apply — Guest applies ─────

guestsRoutes.post(
  '/:eventId/guests/apply',
  authMiddleware,
  async (c) => {
    try {
      const user = c.get('user')
      const { eventId } = eventParamsSchema.parse({ eventId: c.req.param('eventId') })
      const result = await GuestService.applyToEvent(user.publicId, eventId)
      return c.json({ success: true, data: result }, 201)
    } catch (error: unknown) {
      return handleApiError(c, error)
    }
  },
)

// ─── POST /events/:eventId/guests/:participationId/approve ──

guestsRoutes.post(
  '/:eventId/guests/:participationId/approve',
  authMiddleware,
  requireRole([UserRole.HOST, UserRole.ADMIN]),
  require2FA,
  validate(approveGuestSchema),
  async (c) => {
    try {
      const user = c.get('user')
      const { eventId } = eventParamsSchema.parse({ eventId: c.req.param('eventId') })
      const participationId = c.req.param('participationId')
      const body = c.get('validatedBody' as never) as z.infer<typeof approveGuestSchema>
      const result = await GuestService.approveGuest(
        user.publicId,
        eventId,
        participationId,
        body.hostNote,
      )
      return c.json({ success: true, data: result })
    } catch (error: unknown) {
      return handleApiError(c, error)
    }
  },
)

// ─── POST /events/:eventId/guests/:participationId/reject ───

guestsRoutes.post(
  '/:eventId/guests/:participationId/reject',
  authMiddleware,
  requireRole([UserRole.HOST, UserRole.ADMIN]),
  require2FA,
  async (c) => {
    try {
      const user = c.get('user')
      const { eventId } = eventParamsSchema.parse({ eventId: c.req.param('eventId') })
      const participationId = c.req.param('participationId')
      await GuestService.rejectGuest(user.publicId, eventId, participationId)
      return c.json({ success: true, message: 'Participation rejetée' })
    } catch (error: unknown) {
      return handleApiError(c, error)
    }
  },
)

// ─── POST /events/:eventId/guests/scan — Scan QR code ───────

guestsRoutes.post(
  '/:eventId/guests/scan',
  authMiddleware,
  requireRole([UserRole.HOST, UserRole.SAM, UserRole.ADMIN]),
  require2FA,
  scanCodeRateLimit,
  validate(scanAccessCodeSchema),
  async (c) => {
    try {
      const user = c.get('user')
      const { eventId } = eventParamsSchema.parse({ eventId: c.req.param('eventId') })
      const { code } = c.get('validatedBody' as never) as z.infer<typeof scanAccessCodeSchema>
      const ipAddress = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip')
      const userAgent = c.req.header('user-agent')
      const result = await GuestService.scanAccessCode(
        user.publicId,
        eventId,
        code,
        ipAddress,
        userAgent,
      )
      return c.json({ success: true, data: result })
    } catch (error: unknown) {
      return handleApiError(c, error)
    }
  },
)

// ─── GET /events/:eventId/guests — List guests (host) ───────

guestsRoutes.get(
  '/:eventId/guests',
  authMiddleware,
  requireRole([UserRole.HOST, UserRole.ADMIN]),
  require2FA,
  async (c) => {
    try {
      const user = c.get('user')
      const { eventId } = eventParamsSchema.parse({ eventId: c.req.param('eventId') })
      const query = guestListQuerySchema.parse(c.req.query())
      const result = await GuestService.listGuests(user.publicId, eventId, {
        status: query.status as ParticipationStatus | undefined,
        cursor: query.cursor,
        limit: query.limit,
      })
      return c.json({ success: true, data: result })
    } catch (error: unknown) {
      return handleApiError(c, error)
    }
  },
)

// ─── GET /events/:eventId/address — Reveal address (J-24h) ──

guestsRoutes.get(
  '/:eventId/address',
  authMiddleware,
  async (c) => {
    try {
      const user = c.get('user')
      const { eventId } = eventParamsSchema.parse({ eventId: c.req.param('eventId') })
      const result = await GuestService.getEventAddress(user.publicId, eventId)
      return c.json({ success: true, data: result })
    } catch (error: unknown) {
      return handleApiError(c, error)
    }
  },
)

export { guestsRoutes }
