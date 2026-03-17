import { z } from 'zod'

export const banUserSchema = z.object({
  reason: z.string().min(5, 'La raison doit contenir au moins 5 caractères').max(500),
})

export const suspendUserSchema = z.object({
  reason: z.string().min(5, 'La raison doit contenir au moins 5 caractères').max(500),
  until: z.string().datetime('Date de fin invalide'),
})

export const restoreUserSchema = z.object({
  reason: z.string().min(5, 'La raison doit contenir au moins 5 caractères').max(500),
})

export const adminUsersQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  role: z.enum(['guest', 'host', 'sam', 'model', 'admin']).optional(),
  search: z.string().max(100).optional(),
  status: z.enum(['active', 'banned', 'suspended']).optional(),
})

export const adminAuditLogsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  action: z.string().optional(),
  userId: z.string().optional(),
})

export const adminIncidentsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  level: z.enum(['info', 'warning', 'urgent']).optional(),
})
