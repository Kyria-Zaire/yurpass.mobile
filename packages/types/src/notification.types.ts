export enum NotificationType {
  GUEST_APPROVED = 'GUEST_APPROVED',
  GUEST_REJECTED = 'GUEST_REJECTED',
  GUEST_INVITED = 'GUEST_INVITED',
  EVENT_REMINDER = 'EVENT_REMINDER',
  EVENT_CANCELLED = 'EVENT_CANCELLED',
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
