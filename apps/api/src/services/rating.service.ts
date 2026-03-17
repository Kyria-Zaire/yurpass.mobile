import { Queue } from 'bullmq'
import { Rating } from '../models/rating.model.js'
import { User } from '../models/user.model.js'
import { Participation } from '../models/participation.model.js'
import { AuditLog } from '../models/audit-log.model.js'
import { logger } from '../lib/logger.js'
import { env } from '../lib/env.js'
import { findEventOrThrow } from './event.service.js'
import {
  EventStatus,
  ParticipationStatus,
  RatingRole,
  AuditAction,
  AuditResult,
} from '@yurpass/types'
import type {
  CreateRatingInput,
  RatingListItem,
  RatingListResponse,
  ReputationScore,
  ReputationBreakdown,
} from '@yurpass/types'
import { AppError, NotFoundError } from '../middlewares/error-handler.js'

const RATING_WINDOW_HOURS = 24
const RATING_WINDOW_DAYS = 7
const REPUTATION_MONTHS = 12

const ROLE_WEIGHTS: Record<RatingRole, number> = {
  [RatingRole.AS_HOST]: 1.5,
  [RatingRole.AS_GUEST]: 1.0,
  [RatingRole.AS_SAM]: 1.3,
}

export interface ReputationJobData {
  userId: string
}

let reputationQueue: Queue<ReputationJobData> | null = null

function getReputationQueue(): Queue<ReputationJobData> {
  if (!reputationQueue) {
    reputationQueue = new Queue<ReputationJobData>('reputation', {
      connection: { url: env.REDIS_URL } as never,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    })
  }
  return reputationQueue
}

export class RatingService {
  // ─── Submit rating ────────────────────────────────────

  static async submitRating(
    input: CreateRatingInput,
    fromUserId: string,
  ): Promise<{ publicId: string }> {
    const event = await findEventOrThrow(input.eventId)

    // Event must be completed
    if (event.status !== EventStatus.COMPLETED) {
      throw new AppError(
        'Les notations ne sont possibles que pour les événements terminés',
        422,
        'INVALID_STATUS',
      )
    }

    const now = new Date()
    const endDate = event.schedule.endDate

    // RB-013: Notation disponible J+1 (24h after endDate)
    const ratingOpensAt = new Date(endDate.getTime() + RATING_WINDOW_HOURS * 60 * 60 * 1000)
    if (now < ratingOpensAt) {
      throw new AppError(
        `Notation disponible à partir du ${ratingOpensAt.toISOString()}`,
        400,
        'RATING_TOO_EARLY',
      )
    }

    // RB-014: Fenêtre de notation 7 jours max
    const ratingClosesAt = new Date(endDate.getTime() + RATING_WINDOW_DAYS * 24 * 60 * 60 * 1000)
    if (now > ratingClosesAt) {
      throw new AppError(
        'La fenêtre de notation est fermée (7 jours après l\'événement)',
        400,
        'RATING_WINDOW_CLOSED',
      )
    }

    // Verify fromUser attended the event
    const participation = await Participation.findOne({
      userId: fromUserId,
      eventId: input.eventId,
      status: ParticipationStatus.ATTENDED,
    })

    if (!participation) {
      throw new AppError(
        'Vous devez avoir participé à l\'événement pour le noter',
        403,
        'NOT_ATTENDED',
      )
    }

    // Check for duplicate (index unique will also catch this)
    const existing = await Rating.findOne({
      fromUserId,
      eventId: input.eventId,
      role: input.role,
    })

    if (existing) {
      throw new AppError(
        'Vous avez déjà noté cet utilisateur pour cet événement',
        409,
        'DUPLICATE_RATING',
      )
    }

    const rating = await Rating.create({
      fromUserId,
      toUserId: input.toUserId,
      eventId: input.eventId,
      role: input.role,
      score: input.score,
      comment: input.comment,
    })

    await AuditLog.create({
      action: AuditAction.RATING_SUBMITTED,
      userId: fromUserId,
      targetId: input.toUserId,
      eventId: input.eventId,
      metadata: { role: input.role, score: input.score },
      result: AuditResult.SUCCESS,
    })

    // Enqueue reputation recalculation (async)
    try {
      await getReputationQueue().add('calculate-reputation', { userId: input.toUserId })
    } catch (error: unknown) {
      logger.error({ error, userId: input.toUserId }, 'Failed to enqueue reputation calculation')
    }

    logger.info({ fromUserId, toUserId: input.toUserId, eventId: input.eventId, role: input.role }, 'Rating submitted')

    return { publicId: rating.publicId }
  }

  // ─── Get user ratings ─────────────────────────────────

  static async getUserRatings(
    userId: string,
    options: { role?: RatingRole; cursor?: string; limit: number },
  ): Promise<RatingListResponse> {
    const filter: Record<string, unknown> = {
      toUserId: userId,
      isVisible: true,
    }

    if (options.role) {
      filter.role = options.role
    }

    if (options.cursor) {
      filter._id = { $lt: options.cursor }
    }

    const [ratings, total, avgResult] = await Promise.all([
      Rating.find(filter)
        .sort({ createdAt: -1 })
        .limit(options.limit + 1)
        .lean(),
      Rating.countDocuments({ toUserId: userId, isVisible: true, ...(options.role ? { role: options.role } : {}) }),
      Rating.aggregate([
        { $match: { toUserId: userId, isVisible: true, ...(options.role ? { role: options.role } : {}) } },
        { $group: { _id: null, avg: { $avg: '$score' } } },
      ]),
    ])

    const hasMore = ratings.length > options.limit
    if (hasMore) ratings.pop()

    // Batch fetch display names
    const fromUserIds = [...new Set(ratings.map((r) => r.fromUserId))]
    const users = await User.find(
      { publicId: { $in: fromUserIds }, deletedAt: null },
      { publicId: 1, 'profile.displayName': 1 },
    ).lean()

    const userMap = new Map(users.map((u) => [u.publicId, u]))

    const items: RatingListItem[] = ratings.map((r) => {
      const fromUser = userMap.get(r.fromUserId)
      return {
        publicId: r.publicId,
        fromUserId: r.fromUserId,
        fromDisplayName: (fromUser?.profile as { displayName?: string })?.displayName,
        role: r.role as RatingRole,
        score: r.score,
        comment: r.comment,
        createdAt: r.createdAt,
      }
    })

    const nextCursor = hasMore && ratings.length > 0
      ? String((ratings[ratings.length - 1] as Record<string, unknown>)._id)
      : undefined

    const avgScore = avgResult.length > 0 ? Math.round(((avgResult[0] as { avg: number }).avg) * 10) / 10 : 0

    return { ratings: items, nextCursor, total, avgScore }
  }

  // ─── Calculate reputation score (RB-015) ──────────────

  static async calculateReputationScore(userId: string): Promise<ReputationScore> {
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - REPUTATION_MONTHS)

    const ratings = await Rating.find({
      toUserId: userId,
      isVisible: true,
      createdAt: { $gte: twelveMonthsAgo },
    })
      .select('role score')
      .lean()

    // Calculate breakdown
    const breakdown: ReputationBreakdown = {
      asHost: { avg: 0, count: 0 },
      asGuest: { avg: 0, count: 0 },
      asSam: { avg: 0, count: 0 },
    }

    const byRole: Record<RatingRole, number[]> = {
      [RatingRole.AS_HOST]: [],
      [RatingRole.AS_GUEST]: [],
      [RatingRole.AS_SAM]: [],
    }

    for (const r of ratings) {
      byRole[r.role as RatingRole].push(r.score)
    }

    for (const [role, scores] of Object.entries(byRole)) {
      if (scores.length > 0) {
        const avg = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
        const key = role === RatingRole.AS_HOST ? 'asHost'
          : role === RatingRole.AS_GUEST ? 'asGuest'
            : 'asSam'
        breakdown[key] = { avg, count: scores.length }
      }
    }

    // Weighted average across all roles
    let weightedSum = 0
    let weightTotal = 0

    for (const r of ratings) {
      const weight = ROLE_WEIGHTS[r.role as RatingRole]
      weightedSum += r.score * weight
      weightTotal += weight
    }

    const avgRating = weightTotal > 0
      ? Math.round((weightedSum / weightTotal) * 10) / 10
      : 0

    const totalRatings = ratings.length

    // Score on 100 (avgRating / 5 * 100)
    const score = Math.round(avgRating * 20)

    // Update user reputation
    await User.updateOne(
      { publicId: userId },
      {
        $set: {
          'reputation.score': score,
          'reputation.avgRating': avgRating,
          'reputation.totalRatings': totalRatings,
        },
      },
    )

    logger.info({ userId, score, avgRating, totalRatings }, 'Reputation recalculated')

    return { score, avgRating, totalRatings, breakdown }
  }

  // ─── Moderate rating (admin) ──────────────────────────

  static async moderateRating(
    ratingId: string,
    adminId: string,
    action: 'hide' | 'restore',
  ): Promise<void> {
    const rating = await Rating.findOne({ publicId: ratingId })
    if (!rating) {
      throw new NotFoundError('Notation introuvable')
    }

    const isVisible = action === 'restore'
    await Rating.updateOne(
      { _id: rating._id },
      { $set: { isVisible } },
    )

    await AuditLog.create({
      action: AuditAction.CONTENT_MODERATED,
      userId: adminId,
      targetId: ratingId,
      metadata: { type: 'rating', action },
      result: AuditResult.SUCCESS,
    })

    // Recalculate reputation for the rated user
    try {
      await getReputationQueue().add('calculate-reputation', { userId: rating.toUserId })
    } catch (error: unknown) {
      logger.error({ error, userId: rating.toUserId }, 'Failed to enqueue reputation recalculation')
    }

    logger.info({ ratingId, adminId, action }, 'Rating moderated')
  }
}
