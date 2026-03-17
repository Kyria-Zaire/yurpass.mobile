import { Hono } from 'hono'
import { authMiddleware, requireRole, require2FA } from '../middlewares/auth.middleware.js'
import { validate } from '../middlewares/validate.js'
import { SamService } from '../services/sam.service.js'
import { handleApiError } from '../middlewares/error-handler.js'
import {
  samMissionParamsSchema,
  samMissionsQuerySchema,
  logTripSchema,
  reportIncidentSchema,
  completeMissionSchema,
} from '@yurpass/validators'
import { UserRole } from '@yurpass/types'
import type { SamMissionStatus } from '../models/sam-mission.model.js'
import type { z } from 'zod'

const samRoutes = new Hono()

// ─── GET /sam/missions — List SAM's missions ─────────────────

samRoutes.get(
  '/missions',
  authMiddleware,
  requireRole([UserRole.SAM]),
  require2FA,
  async (c) => {
    try {
      const user = c.get('user')
      const query = samMissionsQuerySchema.parse(c.req.query())
      const result = await SamService.getMissions(user.publicId, {
        status: query.status as SamMissionStatus | undefined,
        cursor: query.cursor,
        limit: query.limit,
      })
      return c.json({ success: true, data: result })
    } catch (error: unknown) {
      return handleApiError(c, error)
    }
  },
)

// ─── PUT /sam/missions/:id/confirm — Confirm mission ─────────

samRoutes.put(
  '/missions/:id/confirm',
  authMiddleware,
  requireRole([UserRole.SAM]),
  require2FA,
  async (c) => {
    try {
      const user = c.get('user')
      const { id } = samMissionParamsSchema.parse({ id: c.req.param('id') })
      await SamService.confirmMission(id, user.publicId)
      return c.json({ success: true, message: 'Mission confirmée' })
    } catch (error: unknown) {
      return handleApiError(c, error)
    }
  },
)

// ─── PUT /sam/missions/:id/start — Start mission ─────────────

samRoutes.put(
  '/missions/:id/start',
  authMiddleware,
  requireRole([UserRole.SAM]),
  require2FA,
  async (c) => {
    try {
      const user = c.get('user')
      const { id } = samMissionParamsSchema.parse({ id: c.req.param('id') })
      await SamService.startMission(id, user.publicId)
      return c.json({ success: true, message: 'Mission démarrée' })
    } catch (error: unknown) {
      return handleApiError(c, error)
    }
  },
)

// ─── POST /sam/missions/:id/trips — Log a trip ───────────────

samRoutes.post(
  '/missions/:id/trips',
  authMiddleware,
  requireRole([UserRole.SAM]),
  require2FA,
  validate(logTripSchema),
  async (c) => {
    try {
      const user = c.get('user')
      const { id } = samMissionParamsSchema.parse({ id: c.req.param('id') })
      const body = c.get('validatedBody' as never) as z.infer<typeof logTripSchema>
      const result = await SamService.logTrip(id, user.publicId, {
        guestId: body.guestId,
        destination: body.destination,
        departureTime: new Date(body.departureTime),
      })
      return c.json({ success: true, data: result }, 201)
    } catch (error: unknown) {
      return handleApiError(c, error)
    }
  },
)

// ─── PUT /sam/missions/:id/trips/:index/arrival — Confirm arrival ─

samRoutes.put(
  '/missions/:id/trips/:index/arrival',
  authMiddleware,
  requireRole([UserRole.SAM]),
  require2FA,
  async (c) => {
    try {
      const user = c.get('user')
      const { id } = samMissionParamsSchema.parse({ id: c.req.param('id') })
      const tripIndex = parseInt(c.req.param('index'), 10)
      if (isNaN(tripIndex) || tripIndex < 0) {
        return c.json({ success: false, error: 'Index de trajet invalide' }, 422)
      }
      await SamService.confirmTripArrival(id, user.publicId, tripIndex)
      return c.json({ success: true, message: 'Arrivée confirmée' })
    } catch (error: unknown) {
      return handleApiError(c, error)
    }
  },
)

// ─── POST /sam/missions/:id/incidents — Report incident ──────

samRoutes.post(
  '/missions/:id/incidents',
  authMiddleware,
  requireRole([UserRole.SAM]),
  require2FA,
  validate(reportIncidentSchema),
  async (c) => {
    try {
      const user = c.get('user')
      const { id } = samMissionParamsSchema.parse({ id: c.req.param('id') })
      const body = c.get('validatedBody' as never) as z.infer<typeof reportIncidentSchema>
      await SamService.reportIncident(id, user.publicId, body)
      return c.json({ success: true, message: 'Incident signalé' }, 201)
    } catch (error: unknown) {
      return handleApiError(c, error)
    }
  },
)

// ─── PUT /sam/missions/:id/complete — Complete mission ───────

samRoutes.put(
  '/missions/:id/complete',
  authMiddleware,
  requireRole([UserRole.SAM]),
  require2FA,
  validate(completeMissionSchema),
  async (c) => {
    try {
      const user = c.get('user')
      const { id } = samMissionParamsSchema.parse({ id: c.req.param('id') })
      const body = c.get('validatedBody' as never) as z.infer<typeof completeMissionSchema>
      await SamService.completeMission(id, user.publicId, body.notes)
      return c.json({ success: true, message: 'Mission terminée' })
    } catch (error: unknown) {
      return handleApiError(c, error)
    }
  },
)

// ─── GET /sam/missions/:id/report — Mission report ───────────
// Accessible by SAM, host, or admin — no requireRole(['sam']) restriction

samRoutes.get(
  '/missions/:id/report',
  authMiddleware,
  async (c) => {
    try {
      const user = c.get('user')
      const { id } = samMissionParamsSchema.parse({ id: c.req.param('id') })
      const result = await SamService.getMissionReport(id, user.publicId)
      return c.json({ success: true, data: result })
    } catch (error: unknown) {
      return handleApiError(c, error)
    }
  },
)

export { samRoutes }
