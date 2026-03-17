import { Hono } from 'hono'
import { authMiddleware, requireRole, require2FA } from '../middlewares/auth.middleware.js'
import { validate } from '../middlewares/validate.js'
import { EventService } from '../services/event.service.js'
import { handleApiError } from '../middlewares/error-handler.js'
import {
  createEventSchema,
  updateEventSchema,
  eventParamsSchema,
  assignSamSchema,
  eventListQuerySchema,
} from '@yurpass/validators'
import { UserRole, EventStatus } from '@yurpass/types'
import type { CreateEventInput, UpdateEventInput } from '@yurpass/types'
import type { z } from 'zod'

const eventsRoutes = new Hono()

// ─── POST /events — Create event (host only, 2FA required) ──

eventsRoutes.post(
  '/',
  authMiddleware,
  requireRole([UserRole.HOST, UserRole.ADMIN]),
  require2FA,
  validate(createEventSchema),
  async (c) => {
    try {
      const user = c.get('user')
      const input = c.get('validatedBody' as never) as z.infer<typeof createEventSchema>
      const result = await EventService.createEvent(user.publicId, input as CreateEventInput)
      return c.json({ success: true, data: result }, 201)
    } catch (error: unknown) {
      return handleApiError(c, error)
    }
  },
)

// ─── GET /events — List host's events ───────────────────────

eventsRoutes.get(
  '/',
  authMiddleware,
  requireRole([UserRole.HOST, UserRole.ADMIN]),
  async (c) => {
    try {
      const user = c.get('user')
      const query = eventListQuerySchema.parse(c.req.query())
      const result = await EventService.listHostEvents(user.publicId, {
        status: query.status as EventStatus | undefined,
        cursor: query.cursor,
        limit: query.limit,
      })
      return c.json({ success: true, data: result })
    } catch (error: unknown) {
      return handleApiError(c, error)
    }
  },
)

// ─── GET /events/:eventId — Get event detail (host view) ────

eventsRoutes.get(
  '/:eventId',
  authMiddleware,
  requireRole([UserRole.HOST, UserRole.ADMIN]),
  async (c) => {
    try {
      const user = c.get('user')
      const { eventId } = eventParamsSchema.parse({ eventId: c.req.param('eventId') })
      const event = await EventService.getEventForHost(eventId, user.publicId)
      return c.json({ success: true, data: event })
    } catch (error: unknown) {
      return handleApiError(c, error)
    }
  },
)

// ─── GET /events/:eventId/public — Get event (guest view) ───

eventsRoutes.get(
  '/:eventId/public',
  authMiddleware,
  async (c) => {
    try {
      const { eventId } = eventParamsSchema.parse({ eventId: c.req.param('eventId') })
      const event = await EventService.getEventForGuest(eventId)
      return c.json({ success: true, data: event })
    } catch (error: unknown) {
      return handleApiError(c, error)
    }
  },
)

// ─── PATCH /events/:eventId — Update event ──────────────────

eventsRoutes.patch(
  '/:eventId',
  authMiddleware,
  requireRole([UserRole.HOST, UserRole.ADMIN]),
  require2FA,
  validate(updateEventSchema),
  async (c) => {
    try {
      const user = c.get('user')
      const { eventId } = eventParamsSchema.parse({ eventId: c.req.param('eventId') })
      const input = c.get('validatedBody' as never) as z.infer<typeof updateEventSchema>
      await EventService.updateEvent(eventId, user.publicId, input as UpdateEventInput)
      return c.json({ success: true, message: 'Événement mis à jour' })
    } catch (error: unknown) {
      return handleApiError(c, error)
    }
  },
)

// ─── POST /events/:eventId/publish — Publish event ──────────

eventsRoutes.post(
  '/:eventId/publish',
  authMiddleware,
  requireRole([UserRole.HOST, UserRole.ADMIN]),
  require2FA,
  async (c) => {
    try {
      const user = c.get('user')
      const { eventId } = eventParamsSchema.parse({ eventId: c.req.param('eventId') })
      await EventService.publishEvent(eventId, user.publicId)
      return c.json({ success: true, message: 'Événement publié' })
    } catch (error: unknown) {
      return handleApiError(c, error)
    }
  },
)

// ─── POST /events/:eventId/cancel — Cancel event ────────────

eventsRoutes.post(
  '/:eventId/cancel',
  authMiddleware,
  requireRole([UserRole.HOST, UserRole.ADMIN]),
  require2FA,
  async (c) => {
    try {
      const user = c.get('user')
      const { eventId } = eventParamsSchema.parse({ eventId: c.req.param('eventId') })
      await EventService.cancelEvent(eventId, user.publicId)
      return c.json({ success: true, message: 'Événement annulé' })
    } catch (error: unknown) {
      return handleApiError(c, error)
    }
  },
)

// ─── POST /events/:eventId/assign-sam — Assign SAM ──────────

eventsRoutes.post(
  '/:eventId/assign-sam',
  authMiddleware,
  requireRole([UserRole.HOST, UserRole.ADMIN]),
  require2FA,
  validate(assignSamSchema),
  async (c) => {
    try {
      const user = c.get('user')
      const { eventId } = eventParamsSchema.parse({ eventId: c.req.param('eventId') })
      const { samId } = c.get('validatedBody' as never) as z.infer<typeof assignSamSchema>
      await EventService.assignSam(eventId, user.publicId, samId)
      return c.json({ success: true, message: 'SAM assigné à l\'événement' })
    } catch (error: unknown) {
      return handleApiError(c, error)
    }
  },
)

export { eventsRoutes }
