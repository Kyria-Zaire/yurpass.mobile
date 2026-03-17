export * from './auth.types.js'
export * from './event.types.js'
export * from './guest.types.js'
export * from './notification.types.js'

// ─── Enums ───────────────────────────────────────────────

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
  USER_REGISTERED = 'USER_REGISTERED',
  EMAIL_VERIFIED = 'EMAIL_VERIFIED',
  TOKEN_REFRESHED = 'TOKEN_REFRESHED',
  PASSWORD_RESET_REQUESTED = 'PASSWORD_RESET_REQUESTED',
  ACCOUNT_DELETED = 'ACCOUNT_DELETED',
  ACCOUNT_ANONYMIZED = 'ACCOUNT_ANONYMIZED',
  ROLE_REQUESTED = 'ROLE_REQUESTED',
  EVENT_PUBLISHED = 'EVENT_PUBLISHED',
  EVENT_UPDATED = 'EVENT_UPDATED',
  SAM_ASSIGNED = 'SAM_ASSIGNED',
  ADDRESS_REVEALED = 'ADDRESS_REVEALED',
  PUSH_TOKEN_REGISTERED = 'PUSH_TOKEN_REGISTERED',
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

// ─── Interfaces ──────────────────────────────────────────

export interface IUserProfile {
  displayName: string
  avatarUrl?: string
  bio?: string
  city: string
  verifiedAt?: Date
}

export interface IUserReputation {
  score: number
  totalRatings: number
  avgRating: number
}

export interface IUserSecurity {
  twoFactorEnabled: boolean
  twoFactorSecret?: string
  loginAttempts: number
  lockedUntil?: Date
  lastLoginAt?: Date
  lastLoginIp?: string
}

export interface IUserSubscription {
  plan: SubscriptionPlan
  expiresAt?: Date
}

export interface IUser {
  publicId: string
  email: string
  passwordHash: string
  roles: UserRole[]
  profile: IUserProfile
  reputation: IUserReputation
  security: IUserSecurity
  subscription: IUserSubscription
  deletedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface IEventTheme {
  id: string
  name: string
  dresscode: string
}

export interface IEventSchedule {
  startDate: Date
  endDate: Date
  doorsOpenAt: Date
}

export interface IEventVenue {
  city: string
  address?: string
  coordinates?: {
    lat: number
    lng: number
  }
}

export interface IEventCapacity {
  max: number
  confirmed: number
  waitlist: number
}

export interface IEventAccess {
  type: AccessType
  requiresContribution: boolean
  contributionDetails?: string
}

export interface IEvent {
  publicId: string
  hostId: string
  title: string
  description: string
  theme: IEventTheme
  schedule: IEventSchedule
  venue: IEventVenue
  capacity: IEventCapacity
  access: IEventAccess
  status: EventStatus
  samRequired: boolean
  samId?: string
  mediaUrls: string[]
  isPrivate: boolean
  deletedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface IParticipationContribution {
  type: string
  validated: boolean
  validatedBy?: string
}

export interface IParticipationAccessCode {
  codeHash: string
  generatedAt: Date
  usedAt?: Date
  invalidated: boolean
}

export interface IParticipation {
  publicId: string
  userId: string
  eventId: string
  status: ParticipationStatus
  contribution?: IParticipationContribution
  accessCode?: IParticipationAccessCode
  invitedBy?: string
  hostNote?: string
  checkedInAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface IAuditLog {
  action: AuditAction
  userId?: string
  targetId?: string
  eventId?: string
  metadata: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  result: AuditResult
  createdAt: Date
}
