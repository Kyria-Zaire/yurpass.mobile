import { z } from 'zod'
import { publicIdSchema, paginationSchema } from './base.js'

export const createRatingSchema = z.object({
  toUserId: publicIdSchema,
  eventId: publicIdSchema,
  role: z.enum(['as-guest', 'as-host', 'as-sam']),
  score: z.number().int().min(1).max(5),
  comment: z.string().max(300).trim().optional(),
})

export const ratingListQuerySchema = paginationSchema.extend({
  role: z.enum(['as-guest', 'as-host', 'as-sam']).optional(),
})

export const moderateRatingSchema = z.object({
  action: z.enum(['hide', 'restore']),
})

export const ratingParamsSchema = z.object({
  ratingId: publicIdSchema,
})

export const userParamsSchema = z.object({
  userId: publicIdSchema,
})
