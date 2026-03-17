import { Worker } from 'bullmq'
import { User } from '../models/user.model.js'
import { NotificationService, type NotificationJobData } from '../services/notification.service.js'
import { logger } from '../lib/logger.js'
import { env } from '../lib/env.js'

interface ExpoPushMessage {
  to: string
  title: string
  body: string
  data?: Record<string, unknown>
  sound?: 'default' | null
  priority?: 'default' | 'normal' | 'high'
  channelId?: string
}

interface ExpoPushTicket {
  status: 'ok' | 'error'
  id?: string
  message?: string
  details?: { error?: string }
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

export function createNotificationWorker(): Worker<NotificationJobData> {
  const worker = new Worker<NotificationJobData>(
    'notifications',
    async (job) => {
      if (job.name === 'push-notification') {
        await sendPushNotification(job.data)
      }
    },
    {
      connection: { url: env.REDIS_URL } as never,
      concurrency: 5,
    },
  )

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, type: job.data.payload.type }, 'Notification job completed')
  })

  worker.on('failed', (job, error) => {
    logger.error(
      { jobId: job?.id, type: job?.data.payload.type, error },
      'Notification job failed',
    )
  })

  return worker
}

async function sendPushNotification(data: NotificationJobData): Promise<void> {
  const { userId, payload } = data

  const user = await User.findOne(
    { publicId: userId, deletedAt: null },
    { pushTokens: 1 },
  ).lean()

  if (!user || !user.pushTokens || user.pushTokens.length === 0) {
    logger.info({ userId }, 'No push tokens found for user — skipping')
    return
  }

  const messages: ExpoPushMessage[] = user.pushTokens.map((t) => ({
    to: t.token,
    title: payload.title,
    body: payload.body,
    data: payload.data as Record<string, unknown>,
    sound: 'default' as const,
    priority: 'high' as const,
    channelId: 'yurpass',
  }))

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }

  if (env.EXPO_ACCESS_TOKEN) {
    headers['Authorization'] = `Bearer ${env.EXPO_ACCESS_TOKEN}`
  }

  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(messages),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Expo Push API error ${response.status}: ${errorText}`)
  }

  const result = (await response.json()) as { data: ExpoPushTicket[] }

  // Handle invalid tokens
  for (let i = 0; i < result.data.length; i++) {
    const ticket = result.data[i]
    if (
      ticket.status === 'error' &&
      ticket.details?.error === 'DeviceNotRegistered'
    ) {
      const invalidToken = user.pushTokens[i].token
      await NotificationService.removeInvalidToken(invalidToken)
    }
  }
}
