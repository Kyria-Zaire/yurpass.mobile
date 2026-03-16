import { Hono } from 'hono'
import { authMiddleware } from '../middlewares/auth.middleware.js'
import { validate } from '../middlewares/validate.js'
import { RoleService } from '../services/role.service.js'
import { handleApiError } from '../middlewares/error-handler.js'
import { requestRoleSchema } from '@yurpass/validators'
import type { z } from 'zod'

const rolesRoutes = new Hono()

// ─── POST /roles/request ─────────────────────────────────
rolesRoutes.post('/request', authMiddleware, validate(requestRoleSchema), async (c) => {
  try {
    const user = c.get('user')
    const { role } = c.get('validatedBody' as never) as z.infer<typeof requestRoleSchema>
    const result = await RoleService.requestRole(user.publicId, role)
    return c.json({ success: true, ...result })
  } catch (error: unknown) {
    return handleApiError(c, error)
  }
})

// ─── GET /roles/my-roles ─────────────────────────────────
rolesRoutes.get('/my-roles', authMiddleware, async (c) => {
  try {
    const user = c.get('user')
    const result = await RoleService.getMyRoles(user.publicId)
    return c.json({ success: true, data: result })
  } catch (error: unknown) {
    return handleApiError(c, error)
  }
})

export { rolesRoutes }
