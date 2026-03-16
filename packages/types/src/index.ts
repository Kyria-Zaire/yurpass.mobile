export enum UserRole {
  GUEST = 'guest',
  HOST = 'host',
  SAM = 'sam',
  MODEL = 'model',
  ADMIN = 'admin',
}

export enum EventStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  FULL = 'full',
  ONGOING = 'ongoing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum ParticipationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  WAITLIST = 'waitlist',
  ATTENDED = 'attended',
  NO_SHOW = 'no-show',
}

export enum AuditAction {
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  USER_LOGIN_FAILED = 'USER_LOGIN_FAILED',
  USER_2FA_ENABLED = 'USER_2FA_ENABLED',
  PASSWORD_RESET = 'PASSWORD_RESET',
  ROLE_GRANTED = 'ROLE_GRANTED',
  ROLE_REVOKED = 'ROLE_REVOKED',
  EVENT_CREATED = 'EVENT_CREATED',
  EVENT_CANCELLED = 'EVENT_CANCELLED',
  EVENT_GUEST_ADDED = 'EVENT_GUEST_ADDED',
  EVENT_GUEST_REMOVED = 'EVENT_GUEST_REMOVED',
  ACCESS_CODE_SCAN = 'ACCESS_CODE_SCAN',
  ACCESS_CODE_REFUSED = 'ACCESS_CODE_REFUSED',
  USER_REPORTED = 'USER_REPORTED',
  USER_BANNED = 'USER_BANNED',
  USER_SUSPENDED = 'USER_SUSPENDED',
  CONTENT_MODERATED = 'CONTENT_MODERATED',
  SAM_MISSION_STARTED = 'SAM_MISSION_STARTED',
  SAM_MISSION_COMPLETED = 'SAM_MISSION_COMPLETED',
}

export enum SubscriptionPlan {
  FREE = 'free',
  PREMIUM = 'premium',
}

export enum AccessType {
  INVITE_ONLY = 'invite-only',
  APPLICATION = 'application',
}

export enum AuditResult {
  SUCCESS = 'success',
  FAILURE = 'failure',
}
