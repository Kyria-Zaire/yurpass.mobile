import { Queue, Worker } from 'bullmq'
import { RatingService } from '../services/rating.service.js'
import type { ReputationJobData } from '../services/rating.service.js'
import { Event } from '../models/event.model.js'
import { logger } from '../lib/logger.js'
import { env } from '../lib/env.js'
import { EventStatus } from '@yurpass/types'

const QUEUE_NAME = 'reputation'
const CRON_QUEUE_NAME = 'reputation-cron'

export function createReputationWorker(): Worker {
  const worker = new Worker<ReputationJobData>(
    QUEUE_NAME,
    async (job) => {
      if (job.name === 'calculate-reputation') {
        await RatingService.calculateReputationScore(job.data.userId)
      }
    },
    {
      connection: { url: env.REDIS_URL } as never,
      concurrency: 3,
    },
  )

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, jobName: job.name }, 'Reputation job completed')
  })

  worker.on('failed', (job, error) => {
    logger.error(
      { jobId: job?.id, jobName: job?.name, error },
      'Reputation job failed',
    )
  })

  return worker
}

export function createReputationCron(): { queue: Queue; worker: Worker } {
  const queue = new Queue(CRON_QUEUE_NAME, {
    connection: { url: env.REDIS_URL } as never,
  })

  // Daily at 02:00 — mark events with expired rating windows as completed
  void queue.upsertJobScheduler(
    'close-rating-windows',
    { pattern: '0 2 * * *' },
    {
      name: 'close-rating-windows',
      opts: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
      },
    },
  )

  const worker = new Worker(
    CRON_QUEUE_NAME,
    async (job) => {
      if (job.name === 'close-rating-windows') {
        logger.info('Running close-rating-windows cron')
        await closeExpiredRatingWindows()
      }
    },
    { connection: { url: env.REDIS_URL } as never },
  )

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, jobName: job.name }, 'Reputation cron job completed')
  })

  worker.on('failed', (job, error) => {
    logger.error(
      { jobId: job?.id, jobName: job?.name, error },
      'Reputation cron job failed',
    )
  })

  return { queue, worker }
}

/**
 * Events completed > 7 days ago: rating window is closed.
 * This is informational — the service already checks the window dynamically,
 * but this cron ensures status consistency for queries.
 */
async function closeExpiredRatingWindows(): Promise<void> {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  // Find events that ended > 7 days ago and are still COMPLETED (not CANCELLED)
  const result = await Event.updateMany(
    {
      status: EventStatus.COMPLETED,
      'schedule.endDate': { $lte: sevenDaysAgo },
      ratingWindowClosed: { $ne: true },
    },
    {
      $set: { ratingWindowClosed: true },
    },
  )

  if (result.modifiedCount > 0) {
    logger.info({ count: result.modifiedCount }, 'Closed expired rating windows')
  }
}
