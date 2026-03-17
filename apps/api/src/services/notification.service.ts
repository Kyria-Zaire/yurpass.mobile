import { Queue } from 'bullmq'
import { User } from '../models/user.model.js'
import { Participation } from '../models/participation.model.js'
import { Event } from '../models/event.model.js'
import { AuditLog } from '../models/audit-log.model.js'
import { logger } from '../lib/logger.js'
import { env } from '../lib/env.js'
import {
  NotificationType,
  ParticipationStatus,
  EventStatus,
  AuditAction,
  AuditResult,
} from '@yurpass/types'
import type { PushNotificationPayload } from '@yurpass/types'

const MAX_PUSH_TOKENS_PER_USER = 5

export interface NotificationJobData {
  userId: string
  payload: PushNotificationPayload
}

let notificationQueue: Queue<NotificationJobData> | null = null

function getQueue(): Queue<NotificationJobData> {
  if (!notificationQueue) {
    notificationQueue = new Queue<NotificationJobData>('notifications', {
      connection: { url: env.REDIS_URL } as never,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    })
  }
  return notificationQueue
}

export class NotificationService {
  // ─── Push token management ──────────────────────────────

  static async registerPushToken(
    userId: string,
    token: string,
    platform: 'ios' | 'android',
  ): Promise<void> {
    // Remove existing entry for this token (idempotent upsert)
    await User.updateOne(
      { publicId: userId },
      { $pull: { pushTokens: { token } } },
    )

    // Push new token, evict oldest if exceeding max
    const user = await User.findOneAndUpdate(
      { publicId: userId },
      {
        $push: {
          pushTokens: {
            $each: [{ token, platform, addedAt: new Date() }],
            $slice: -MAX_PUSH_TOKENS_PER_USER,
          },
        },
      },
      { new: true },
    )

    if (!user) {
      logger.warn({ userId }, 'User not found for push token registration')
      return
    }

    await AuditLog.create({
      action: AuditAction.PUSH_TOKEN_REGISTERED,
      userId,
      metadata: { platform },
      result: AuditResult.SUCCESS,
    })

    logger.info({ userId, platform }, 'Push token registered')
  }

  static async removePushToken(userId: string, token: string): Promise<void> {
    await User.updateOne(
      { publicId: userId },
      { $pull: { pushTokens: { token } } },
    )
    logger.info({ userId }, 'Push token removed')
  }

  static async removeInvalidToken(token: string): Promise<void> {
    await User.updateMany(
      { 'pushTokens.token': token },
      { $pull: { pushTokens: { token } } },
    )
    logger.info({ token: token.slice(0, 20) + '...' }, 'Invalid push token removed from all users')
  }

  // ─── Enqueue notifications ──────────────────────────────

  static async sendToUser(
    userId: string,
    payload: PushNotificationPayload,
  ): Promise<void> {
    try {
      await getQueue().add('push-notification', { userId, payload })
    } catch (error: unknown) {
      logger.error({ error, userId, type: payload.type }, 'Failed to enqueue notification')
    }
  }

  static async sendToUsers(
    userIds: string[],
    payload: PushNotificationPayload,
  ): Promise<void> {
    const jobs = userIds.map((userId) => ({
      name: 'push-notification',
      data: { userId, payload },
    }))

    try {
      await getQueue().addBulk(jobs)
    } catch (error: unknown) {
      logger.error({ error, count: userIds.length, type: payload.type }, 'Failed to enqueue bulk notifications')
    }
  }

  // ─── Notification builders (NEVER include sensitive data) ─

  static notifyGuestApproved(
    userId: string,
    eventTitle: string,
    participationId: string,
  ): void {
    const payload: PushNotificationPayload = {
      type: NotificationType.GUEST_APPROVED,
      title: 'Invitation acceptée',
      body: `Vous êtes accepté à ${eventTitle} !`,
      data: {
        participationId,
        deepLink: `/(app)/my-tickets/${participationId}`,
      },
    }
    void NotificationService.sendToUser(userId, payload)
  }

  static notifyGuestRejected(
    userId: string,
    eventTitle: string,
  ): void {
    const payload: PushNotificationPayload = {
      type: NotificationType.GUEST_REJECTED,
      title: 'Mise à jour',
      body: `Mise à jour de votre demande pour ${eventTitle}`,
      data: {
        deepLink: '/(app)/',
      },
    }
    void NotificationService.sendToUser(userId, payload)
  }

  static notifyGuestInvited(
    userId: string,
    eventTitle: string,
    participationId: string,
  ): void {
    const payload: PushNotificationPayload = {
      type: NotificationType.GUEST_INVITED,
      title: 'Nouvelle invitation',
      body: `Vous êtes invité à ${eventTitle}`,
      data: {
        participationId,
        deepLink: `/(app)/my-tickets/${participationId}`,
      },
    }
    void NotificationService.sendToUser(userId, payload)
  }

  static notifyEventCancelled(
    userIds: string[],
    eventTitle: string,
  ): void {
    const payload: PushNotificationPayload = {
      type: NotificationType.EVENT_CANCELLED,
      title: 'Événement annulé',
      body: `${eventTitle} a été annulé`,
      data: {
        deepLink: '/(app)/',
      },
    }
    void NotificationService.sendToUsers(userIds, payload)
  }

  static notifyParticipationCancelled(
    hostId: string,
    eventTitle: string,
    guestDisplayName: string,
    eventId: string,
  ): void {
    const payload: PushNotificationPayload = {
      type: NotificationType.PARTICIPATION_CANCELLED,
      title: 'Annulation invité',
      body: `${guestDisplayName} a annulé sa participation à ${eventTitle}`,
      data: {
        eventId,
        deepLink: `/(app)/events/${eventId}/guests`,
      },
    }
    void NotificationService.sendToUser(hostId, payload)
  }

  // ─── SAM notifications ────────────────────────────────

  static notifySamMissionConfirmed(
    hostId: string,
    eventTitle: string,
    eventId: string,
  ): void {
    const payload: PushNotificationPayload = {
      type: NotificationType.SAM_MISSION_CONFIRMED,
      title: 'SAM confirmé',
      body: `Le SAM a confirmé sa mission pour ${eventTitle}`,
      data: {
        eventId,
        deepLink: `/(app)/events/${eventId}`,
      },
    }
    void NotificationService.sendToUser(hostId, payload)
  }

  static notifySamMissionCompleted(
    hostId: string,
    eventTitle: string,
    eventId: string,
    missionId: string,
  ): void {
    const payload: PushNotificationPayload = {
      type: NotificationType.SAM_MISSION_COMPLETED,
      title: 'Rapport SAM disponible',
      body: `La mission SAM pour ${eventTitle} est terminée`,
      data: {
        eventId,
        deepLink: `/(app)/sam/missions/${missionId}/report`,
      },
    }
    void NotificationService.sendToUser(hostId, payload)
  }

  static notifySamUrgentIncident(
    adminIds: string[],
    eventTitle: string,
    eventId: string,
    missionId: string,
  ): void {
    const payload: PushNotificationPayload = {
      type: NotificationType.SAM_URGENT_INCIDENT,
      title: '🚨 Incident urgent SAM',
      body: `Incident urgent signalé pour ${eventTitle}`,
      data: {
        eventId,
        deepLink: `/(app)/sam/missions/${missionId}/report`,
      },
    }
    void NotificationService.sendToUsers(adminIds, payload)
  }

  // ─── Media notifications ─────────────────────────────────

  static notifyMediaModerationPending(
    adminIds: string[],
    eventTitle: string,
    eventId: string,
  ): void {
    const payload: PushNotificationPayload = {
      type: NotificationType.MEDIA_MODERATION_PENDING,
      title: 'Photo en attente',
      body: `Nouvelle photo à modérer pour ${eventTitle}`,
      data: {
        eventId,
        deepLink: `/(app)/admin/moderation`,
      },
    }
    void NotificationService.sendToUsers(adminIds, payload)
  }

  // ─── CRON: J-1 event reminders ─────────────────────────

  static async sendEventReminders(): Promise<void> {
    const now = new Date()
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000)

    // Find events starting between 24h and 25h from now (1h window)
    const events = await Event.find({
      status: { $in: [EventStatus.PUBLISHED, EventStatus.FULL] },
      'schedule.startDate': { $gte: in24h, $lt: in25h },
      deletedAt: null,
    }).lean()

    if (events.length === 0) return

    for (const event of events) {
      const participations = await Participation.find({
        eventId: event.publicId,
        status: ParticipationStatus.APPROVED,
      })
        .select('userId publicId')
        .lean()

      if (participations.length === 0) continue

      const jobs = participations.map((p) => ({
        name: 'push-notification' as const,
        data: {
          userId: p.userId,
          payload: {
            type: NotificationType.EVENT_REMINDER,
            title: 'Rappel',
            body: `${event.title} commence demain !`,
            data: {
              eventId: event.publicId,
              participationId: p.publicId,
              deepLink: `/(app)/my-tickets/${p.publicId}`,
            },
          },
        },
      }))

      try {
        await getQueue().addBulk(jobs)
        logger.info(
          { eventId: event.publicId, count: jobs.length },
          'J-1 reminders enqueued',
        )
      } catch (error: unknown) {
        logger.error(
          { error, eventId: event.publicId },
          'Failed to enqueue J-1 reminders',
        )
      }
    }
  }
}
