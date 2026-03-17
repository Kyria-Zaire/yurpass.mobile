import { apiFetch } from './auth.service'
import type {
  EventForHost,
  GuestListResponse,
  ApproveGuestResponse,
  ScanResultResponse,
  EventAddressResponse,
  CreateEventInput,
} from '@yurpass/types'

// ─── Events ─────────────────────────────────────────────

export interface EventListResponse {
  events: EventForHost[]
  nextCursor?: string
}

export async function createEvent(
  input: CreateEventInput,
): Promise<{ success: boolean; data: { publicId: string } }> {
  return apiFetch('/events', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function listMyEvents(params?: {
  status?: string
  cursor?: string
  limit?: number
}): Promise<{ success: boolean; data: EventListResponse }> {
  const query = new URLSearchParams()
  if (params?.status) query.set('status', params.status)
  if (params?.cursor) query.set('cursor', params.cursor)
  if (params?.limit) query.set('limit', String(params.limit))
  const qs = query.toString()
  return apiFetch(`/events${qs ? `?${qs}` : ''}`)
}

export async function getEvent(
  eventId: string,
): Promise<{ success: boolean; data: EventForHost }> {
  return apiFetch(`/events/${eventId}`)
}

export async function publishEvent(eventId: string): Promise<void> {
  await apiFetch(`/events/${eventId}/publish`, { method: 'POST' })
}

export async function cancelEvent(eventId: string): Promise<void> {
  await apiFetch(`/events/${eventId}/cancel`, { method: 'POST' })
}

// ─── Guests ─────────────────────────────────────────────

export async function listGuests(
  eventId: string,
  params?: { status?: string; cursor?: string; limit?: number },
): Promise<{ success: boolean; data: GuestListResponse }> {
  const query = new URLSearchParams()
  if (params?.status) query.set('status', params.status)
  if (params?.cursor) query.set('cursor', params.cursor)
  if (params?.limit) query.set('limit', String(params.limit))
  const qs = query.toString()
  return apiFetch(`/events/${eventId}/guests${qs ? `?${qs}` : ''}`)
}

export async function inviteGuest(
  eventId: string,
  guestUserId: string,
): Promise<{ success: boolean; data: { participationId: string } }> {
  return apiFetch(`/events/${eventId}/guests/invite`, {
    method: 'POST',
    body: JSON.stringify({ guestUserId }),
  })
}

export async function approveGuest(
  eventId: string,
  participationId: string,
  hostNote?: string,
): Promise<{ success: boolean; data: ApproveGuestResponse }> {
  return apiFetch(`/events/${eventId}/guests/${participationId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ hostNote }),
  })
}

export async function rejectGuest(
  eventId: string,
  participationId: string,
): Promise<void> {
  await apiFetch(`/events/${eventId}/guests/${participationId}/reject`, {
    method: 'POST',
  })
}

export async function scanAccessCode(
  eventId: string,
  code: string,
): Promise<{ success: boolean; data: ScanResultResponse }> {
  return apiFetch(`/events/${eventId}/guests/scan`, {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
}

export async function getEventAddress(
  eventId: string,
): Promise<{ success: boolean; data: EventAddressResponse }> {
  return apiFetch(`/events/${eventId}/address`)
}
