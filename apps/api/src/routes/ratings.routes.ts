import { Hono } from 'hono'
import { authMiddleware, requireRole, require2FA } from '../middlewares/auth.middleware.js'
import { validate } from '../middlewares/validate.js'
import { RatingService } from '../services/rating.service.js'
import { handleApiError } from '../middlewares/error-handler.js'
import {
  createRatingSchema,
  ratingListQuerySchema,
  moderateRatingSchema,
  ratingParamsSchema,
  userParamsSchema,
} from '@yurpass/validators'
import { UserRole, RatingRole } from '@yurpass/types'
import type { CreateRatingInput } from '@yurpass/types'
import type { z } from 'zod'

const ratingsRoutes = new Hono()

// ─── POST /ratings — Submit a rating ─────────────────────────

ratingsRoutes.post(
  '/',
  authMiddleware,
  validate(createRatingSchema),
  async (c) => {
    try {
      const user = c.get('user')
      const input = c.get('validatedBody' as never) as z.infer<typeof createRatingSchema>
      const result = await RatingService.submitRating(input as CreateRatingInput, user.publicId)
      return c.json({ success: true, data: result }, 201)
    } catch (error: unknown) {
      return handleApiError(c, error)
    }
  },
)

// ─── GET /users/:userId/ratings — Get user's ratings ─────────

ratingsRoutes.get(
  '/users/:userId/ratings',
  authMiddleware,
  async (c) => {
    try {
      const { userId } = userParamsSchema.parse({ userId: c.req.param('userId') })
      const query = ratingListQuerySchema.parse(c.req.query())
      const result = await RatingService.getUserRatings(userId, {
        role: query.role as RatingRole | undefined,
        cursor: query.cursor,
        limit: query.limit,
      })
      return c.json({ success: true, data: result })
    } catch (error: unknown) {
      return handleApiError(c, error)
    }
  },
)

// ─── GET /users/:userId/reputation — Get user's reputation score ─

ratingsRoutes.get(
  '/users/:userId/reputation',
  authMiddleware,
  async (c) => {
    try {
      const { userId } = userParamsSchema.parse({ userId: c.req.param('userId') })
      const result = await RatingService.calculateReputationScore(userId)
      return c.json({ success: true, data: result })
    } catch (error: unknown) {
      return handleApiError(c, error)
    }
  },
)

// ─── PUT /ratings/:ratingId/moderate — Admin moderate rating ─

ratingsRoutes.put(
  '/:ratingId/moderate',
  authMiddleware,
  requireRole([UserRole.ADMIN]),
  require2FA,
  validate(moderateRatingSchema),
  async (c) => {
    try {
      const user = c.get('user')
      const { ratingId } = ratingParamsSchema.parse({ ratingId: c.req.param('ratingId') })
      const { action } = c.get('validatedBody' as never) as z.infer<typeof moderateRatingSchema>
      await RatingService.moderateRating(ratingId, user.publicId, action)
      return c.json({ success: true, message: action === 'hide' ? 'Notation masquée' : 'Notation restaurée' })
    } catch (error: unknown) {
      return handleApiError(c, error)
    }
  },
)

export { ratingsRoutes }
