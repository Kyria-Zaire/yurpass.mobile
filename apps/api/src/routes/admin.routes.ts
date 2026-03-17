import { Hono } from 'hono'
import { authMiddleware, requireRole, require2FA } from '../middlewares/auth.middleware.js'
import { validate } from '../middlewares/validate.js'
import { AdminService } from '../services/admin.service.js'
import { MediaService } from '../services/media.service.js'
import { handleApiError } from '../middlewares/error-handler.js'
import { UserRole } from '@yurpass/types'
import {
  banUserSchema,
  suspendUserSchema,
  restoreUserSchema,
  adminUsersQuerySchema,
  adminAuditLogsQuerySchema,
  adminIncidentsQuerySchema,
} from '@yurpass/validators'
import { z } from 'zod'

const userIdParamsSchema = z.object({
  id: z.string().min(10).max(10),
})

const photoIdParamsSchema = z.object({
  id: z.string().min(10).max(10),
})

const moderatePhotoSchema = z.object({
  action: z.enum(['approve', 'reject']),
})

const adminRoutes = new Hono()

// All admin routes require auth + admin role
adminRoutes.use('*', authMiddleware, requireRole([UserRole.ADMIN]))

// ─── GET /admin/stats — Dashboard statistics ──────────────

adminRoutes.get('/stats', async (c) => {
  try {
    const stats = await AdminService.getStats()
    return c.json({ success: true, data: stats })
  } catch (error: unknown) {
    return handleApiError(c, error)
  }
})

// ─── GET /admin/users — List users (cursor pagination) ────

adminRoutes.get('/users', async (c) => {
  try {
    const query = adminUsersQuerySchema.parse({
      cursor: c.req.query('cursor'),
      limit: c.req.query('limit'),
      role: c.req.query('role'),
      search: c.req.query('search'),
      status: c.req.query('status'),
    })
    const result = await AdminService.getUsers(query)
    return c.json({ success: true, data: result })
  } catch (error: unknown) {
    return handleApiError(c, error)
  }
})

// ─── PUT /admin/users/:id/ban — Ban user ──────────────────

adminRoutes.put(
  '/users/:id/ban',
  require2FA,
  validate(banUserSchema),
  async (c) => {
    try {
      const admin = c.get('user')
      const { id } = userIdParamsSchema.parse({ id: c.req.param('id') })
      const { reason } = c.get('validatedBody' as never) as z.infer<typeof banUserSchema>
      await AdminService.banUser(id, admin.publicId, reason)
      return c.json({ success: true, message: 'Utilisateur banni' })
    } catch (error: unknown) {
      return handleApiError(c, error)
    }
  },
)

// ─── PUT /admin/users/:id/suspend — Suspend user ─────────

adminRoutes.put(
  '/users/:id/suspend',
  require2FA,
  validate(suspendUserSchema),
  async (c) => {
    try {
      const admin = c.get('user')
      const { id } = userIdParamsSchema.parse({ id: c.req.param('id') })
      const { reason, until } = c.get('validatedBody' as never) as z.infer<typeof suspendUserSchema>
      await AdminService.suspendUser(id, admin.publicId, reason, until)
      return c.json({ success: true, message: 'Utilisateur suspendu' })
    } catch (error: unknown) {
      return handleApiError(c, error)
    }
  },
)

// ─── PUT /admin/users/:id/restore — Restore user ─────────

adminRoutes.put(
  '/users/:id/restore',
  require2FA,
  validate(restoreUserSchema),
  async (c) => {
    try {
      const admin = c.get('user')
      const { id } = userIdParamsSchema.parse({ id: c.req.param('id') })
      const { reason } = c.get('validatedBody' as never) as z.infer<typeof restoreUserSchema>
      await AdminService.restoreUser(id, admin.publicId, reason)
      return c.json({ success: true, message: 'Utilisateur restauré' })
    } catch (error: unknown) {
      return handleApiError(c, error)
    }
  },
)

// ─── GET /admin/content/pending — Pending moderation ──────

adminRoutes.get('/content/pending', async (c) => {
  try {
    const result = await AdminService.getPendingContent()
    return c.json({ success: true, data: result })
  } catch (error: unknown) {
    return handleApiError(c, error)
  }
})

// ─── PUT /admin/content/photos/:id/moderate — Moderate photo

adminRoutes.put(
  '/content/photos/:id/moderate',
  require2FA,
  validate(moderatePhotoSchema),
  async (c) => {
    try {
      const admin = c.get('user')
      const { id } = photoIdParamsSchema.parse({ id: c.req.param('id') })
      const { action } = c.get('validatedBody' as never) as z.infer<typeof moderatePhotoSchema>
      await MediaService.moderatePhoto(id, admin.publicId, action)
      return c.json({ success: true, message: action === 'approve' ? 'Photo approuvée' : 'Photo rejetée' })
    } catch (error: unknown) {
      return handleApiError(c, error)
    }
  },
)

// ─── PUT /admin/users/:id/certify-sam — Certify SAM ──────

adminRoutes.put(
  '/users/:id/certify-sam',
  require2FA,
  async (c) => {
    try {
      const admin = c.get('user')
      const { id } = userIdParamsSchema.parse({ id: c.req.param('id') })
      await AdminService.certifySAM(id, admin.publicId)
      return c.json({ success: true, message: 'SAM certifié' })
    } catch (error: unknown) {
      return handleApiError(c, error)
    }
  },
)

// ─── GET /admin/audit-logs — Audit logs ───────────────────

adminRoutes.get('/audit-logs', async (c) => {
  try {
    const query = adminAuditLogsQuerySchema.parse({
      cursor: c.req.query('cursor'),
      limit: c.req.query('limit'),
      action: c.req.query('action'),
      userId: c.req.query('userId'),
    })
    const result = await AdminService.getAuditLogs(query)
    return c.json({ success: true, data: result })
  } catch (error: unknown) {
    return handleApiError(c, error)
  }
})

// ─── GET /admin/incidents — SAM incidents ─────────────────

adminRoutes.get('/incidents', async (c) => {
  try {
    const query = adminIncidentsQuerySchema.parse({
      cursor: c.req.query('cursor'),
      limit: c.req.query('limit'),
      level: c.req.query('level'),
    })
    const result = await AdminService.getIncidents(query)
    return c.json({ success: true, data: result })
  } catch (error: unknown) {
    return handleApiError(c, error)
  }
})

export { adminRoutes }
