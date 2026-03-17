import { z } from 'zod'
import { publicIdSchema, paginationSchema } from './base.js'

const themeSchema = z.object({
  id: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  dresscode: z.string().min(1).max(200),
})

const scheduleSchema = z
  .object({
    startDate: z.coerce.date().refine(
      (d) => d > new Date(),
      'La date de début doit être dans le futur',
    ),
    endDate: z.coerce.date(),
    doorsOpenAt: z.coerce.date(),
  })
  .refine((s) => s.endDate > s.startDate, {
    message: 'La date de fin doit être après la date de début',
    path: ['endDate'],
  })
  .refine((s) => s.doorsOpenAt <= s.startDate, {
    message: 'L\'ouverture des portes doit être avant ou au début de l\'événement',
    path: ['doorsOpenAt'],
  })

const venueSchema = z.object({
  city: z.string().min(1).max(100).trim(),
  address: z.string().max(300).trim().optional(),
  coordinates: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .optional(),
})

const accessSchema = z.object({
  type: z.enum(['invite-only', 'application']),
  requiresContribution: z.boolean().default(false),
  contributionDetails: z.string().max(500).trim().optional(),
})

const capacitySchema = z.object({
  max: z.number().int().min(2).max(500),
})

export const createEventSchema = z.object({
  title: z.string().min(3, 'Le titre doit contenir au moins 3 caractères').max(100).trim(),
  description: z.string().min(10, 'La description doit contenir au moins 10 caractères').max(2000).trim(),
  theme: themeSchema,
  schedule: scheduleSchema,
  venue: venueSchema,
  capacity: capacitySchema,
  access: accessSchema,
  isPrivate: z.boolean().default(true),
})

export const updateEventSchema = z.object({
  title: z.string().min(3).max(100).trim().optional(),
  description: z.string().min(10).max(2000).trim().optional(),
  theme: themeSchema.optional(),
  schedule: scheduleSchema.optional(),
  venue: venueSchema.optional(),
  capacity: capacitySchema.optional(),
  access: accessSchema.optional(),
  isPrivate: z.boolean().optional(),
})

export const eventParamsSchema = z.object({
  eventId: publicIdSchema,
})

export const assignSamSchema = z.object({
  samId: publicIdSchema,
})

export const eventListQuerySchema = paginationSchema.extend({
  status: z.enum(['draft', 'published', 'full', 'ongoing', 'completed', 'cancelled']).optional(),
})
