import { z } from 'zod'
import { publicIdSchema, paginationSchema } from './base.js'

export const samMissionParamsSchema = z.object({
  id: publicIdSchema,
})

export const samMissionsQuerySchema = paginationSchema.extend({
  status: z
    .enum(['assigned', 'confirmed', 'active', 'completed', 'cancelled'])
    .optional(),
})

export const logTripSchema = z.object({
  guestId: publicIdSchema,
  destination: z
    .string()
    .min(2, 'La destination doit contenir au moins 2 caractères')
    .max(200, 'La destination ne doit pas dépasser 200 caractères')
    .trim(),
  departureTime: z.coerce.date(),
})

export const confirmArrivalSchema = z.object({
  tripIndex: z.number().int().min(0),
})

export const reportIncidentSchema = z.object({
  description: z
    .string()
    .min(10, 'La description doit contenir au moins 10 caractères')
    .max(500, 'La description ne doit pas dépasser 500 caractères')
    .trim(),
  level: z.enum(['info', 'warning', 'urgent']),
})

export const completeMissionSchema = z.object({
  notes: z
    .string()
    .max(1000, 'Les notes ne doivent pas dépasser 1000 caractères')
    .trim()
    .optional(),
})
