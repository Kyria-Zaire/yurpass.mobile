export enum NotificationType {
  GUEST_APPROVED = 'GUEST_APPROVED',
  GUEST_REJECTED = 'GUEST_REJECTED',
  GUEST_INVITED = 'GUEST_INVITED',
  EVENT_REMINDER = 'EVENT_REMINDER',
  EVENT_CANCELLED = 'EVENT_CANCELLED',
  PARTICIPATION_CANCELLED = 'PARTICIPATION_CANCELLED',
  SAM_MISSION_CONFIRMED = 'SAM_MISSION_CONFIRMED',
  SAM_MISSION_COMPLETED = 'SAM_MISSION_COMPLETED',
  SAM_URGENT_INCIDENT = 'SAM_URGENT_INCIDENT',
  MEDIA_MODERATION_PENDING = 'MEDIA_MODERATION_PENDING',
}

export interface PushNotificationPayload {
  type: NotificationType
  title: string
  body: string
  data: {
    eventId?: string
    participationId?: string
    deepLink: string
  }
}

export interface RegisterPushTokenInput {
  token: string
  platform: 'ios' | 'android'
}
