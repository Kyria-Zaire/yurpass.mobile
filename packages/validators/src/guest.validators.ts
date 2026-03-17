import { z } from 'zod'
import { publicIdSchema, paginationSchema } from './base.js'

export const inviteGuestSchema = z.object({
  guestUserId: publicIdSchema,
})

export const approveGuestSchema = z.object({
  hostNote: z.string().max(500).trim().optional(),
})

export const scanAccessCodeSchema = z.object({
  code: z.string().length(12, 'Le code d\'accès doit contenir 12 caractères'),
})

export const guestListQuerySchema = paginationSchema.extend({
  status: z
    .enum(['pending', 'approved', 'rejected', 'waitlist', 'attended', 'no-show'])
    .optional(),
})

export const participationParamsSchema = z.object({
  participationId: publicIdSchema,
})
