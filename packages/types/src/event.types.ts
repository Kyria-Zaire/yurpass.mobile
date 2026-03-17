import type {
  IEvent,
  EventStatus,
  AccessType,
} from './index.js'

// ─── Host view — full event data ────────────────────────

export interface EventForHost extends IEvent {
  stats: {
    totalParticipants: number
    pendingApprovals: number
    checkedIn: number
  }
}

// ─── Guest view — address hidden until revealed ─────────

export interface EventForGuest {
  publicId: string
  hostId: string
  title: string
  description: string
  theme: IEvent['theme']
  schedule: IEvent['schedule']
  venue: {
    city: string
  }
  capacity: {
    max: number
    confirmed: number
  }
  access: IEvent['access']
  status: EventStatus
  mediaUrls: string[]
  createdAt: Date
}

// ─── Inputs ─────────────────────────────────────────────

export interface CreateEventInput {
  title: string
  description: string
  theme: {
    id: string
    name: string
    dresscode: string
  }
  schedule: {
    startDate: string | Date
    endDate: string | Date
    doorsOpenAt: string | Date
  }
  venue: {
    city: string
    address?: string
    coordinates?: {
      lat: number
      lng: number
    }
  }
  capacity: {
    max: number
  }
  access: {
    type: AccessType
    requiresContribution: boolean
    contributionDetails?: string
  }
  isPrivate?: boolean
}

export interface UpdateEventInput {
  title?: string
  description?: string
  theme?: {
    id: string
    name: string
    dresscode: string
  }
  schedule?: {
    startDate: string | Date
    endDate: string | Date
    doorsOpenAt: string | Date
  }
  venue?: {
    city: string
    address?: string
    coordinates?: {
      lat: number
      lng: number
    }
  }
  capacity?: {
    max: number
  }
  access?: {
    type: AccessType
    requiresContribution: boolean
    contributionDetails?: string
  }
  isPrivate?: boolean
}
