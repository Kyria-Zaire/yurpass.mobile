import { Queue, Worker } from 'bullmq'
import { NotificationService } from '../services/notification.service.js'
import { logger } from '../lib/logger.js'
import { env } from '../lib/env.js'

const CRON_QUEUE_NAME = 'notification-cron'

export function createNotificationCron(): { queue: Queue; worker: Worker } {
  const queue = new Queue(CRON_QUEUE_NAME, {
    connection: { url: env.REDIS_URL } as never,
  })

  // Schedule daily at 10:00 — J-1 event reminders
  void queue.upsertJobScheduler(
    'j-1-event-reminders',
    { pattern: '0 10 * * *' },
    {
      name: 'send-event-reminders',
      opts: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
      },
    },
  )

  const worker = new Worker(
    CRON_QUEUE_NAME,
    async (job) => {
      if (job.name === 'send-event-reminders') {
        logger.info('Running J-1 event reminders cron')
        await NotificationService.sendEventReminders()
      }
    },
    { connection: { url: env.REDIS_URL } as never },
  )

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, jobName: job.name }, 'Notification cron job completed')
  })

  worker.on('failed', (job, error) => {
    logger.error(
      { jobId: job?.id, jobName: job?.name, error },
      'Notification cron job failed',
    )
  })

  return { queue, worker }
}
