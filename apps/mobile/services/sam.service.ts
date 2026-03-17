import { apiFetch } from './auth.service'

export type SamMissionStatus = 'assigned' | 'confirmed' | 'active' | 'completed' | 'cancelled'

export interface SamTrip {
  guestId: string
  guestName: string
  destination: string
  departureTime: string | Date
  arrivalConfirmedAt?: string | Date
  status: 'in-progress' | 'completed'
}

export interface SamIncident {
  description: string
  level: 'info' | 'warning' | 'urgent'
  reportedAt: string | Date
  resolvedAt?: string | Date
}

export interface SamMission {
  publicId: string
  eventId: string
  samId: string
  hostId: string
  status: SamMissionStatus
  confirmedAt?: string | Date
  startedAt?: string | Date
  completedAt?: string | Date
  trips: SamTrip[]
  incidents: SamIncident[]
  notes?: string
  createdAt: string | Date
  updatedAt: string | Date
}

export interface SamMissionListResponse {
  missions: SamMission[]
  nextCursor?: string
}

export async function listMissions(params?: {
  status?: SamMissionStatus
  cursor?: string
  limit?: number
}): Promise<{ success: boolean; data: SamMissionListResponse }> {
  const search = new URLSearchParams()
  if (params?.status) search.set('status', params.status)
  if (params?.cursor) search.set('cursor', params.cursor)
  if (params?.limit) search.set('limit', String(params.limit))
  const qs = search.toString()

  return apiFetch(`/sam/missions${qs ? `?${qs}` : ''}`)
}

export async function confirmMission(id: string): Promise<void> {
  await apiFetch(`/sam/missions/${id}/confirm`, { method: 'PUT' })
}

export async function startMission(id: string): Promise<void> {
  await apiFetch(`/sam/missions/${id}/start`, { method: 'PUT' })
}

export async function logTrip(
  id: string,
  input: Pick<SamTrip, 'guestId' | 'destination' | 'departureTime'>,
): Promise<{ success: boolean; data: SamMission }> {
  return apiFetch(`/sam/missions/${id}/trips`, {
    method: 'POST',
    body: JSON.stringify({
      guestId: input.guestId,
      destination: input.destination,
      departureTime: input.departureTime,
    }),
  })
}

export async function confirmArrival(id: string, tripIndex: number): Promise<void> {
  await apiFetch(`/sam/missions/${id}/trips/${tripIndex}/arrival`, { method: 'PUT' })
}

export async function reportIncident(
  id: string,
  input: Pick<SamIncident, 'description' | 'level'>,
): Promise<void> {
  await apiFetch(`/sam/missions/${id}/incidents`, {
    method: 'POST',
    body: JSON.stringify({
      description: input.description,
      level: input.level,
    }),
  })
}

export async function completeMission(
  id: string,
  notes?: string,
): Promise<void> {
  await apiFetch(`/sam/missions/${id}/complete`, {
    method: 'PUT',
    body: JSON.stringify({ notes }),
  })
}

