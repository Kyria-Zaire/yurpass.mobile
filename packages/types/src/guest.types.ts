import type { ParticipationStatus } from './index.js'
import type { EventForGuest } from './event.types.js'

export interface GuestListItem {
  publicId: string
  userId: string
  displayName: string
  avatarUrl?: string
  status: ParticipationStatus
  invitedBy?: string
  hostNote?: string
  checkedInAt?: Date
  createdAt: Date
}

export interface GuestListResponse {
  guests: GuestListItem[]
  nextCursor?: string
  total: number
}

export interface ApproveGuestResponse {
  participationId: string
  accessCode: string
  status: ParticipationStatus
}

export interface ScanResultResponse {
  participationId: string
  guestDisplayName: string
  guestAvatarUrl?: string
  checkedInAt: Date
}

export interface EventAddressResponse {
  address: string
  coordinates?: {
    lat: number
    lng: number
  }
}

// ─── My Ticket (guest) ───────────────────────────────────

export interface MyTicketParticipation {
  publicId: string
  eventId: string
  status: ParticipationStatus
  /** Plain access code for QR — only present if approved and encryption configured */
  accessCode?: string
  checkedInAt?: Date
}

export interface MyTicketResponse {
  event: EventForGuest
  participation: MyTicketParticipation
}
