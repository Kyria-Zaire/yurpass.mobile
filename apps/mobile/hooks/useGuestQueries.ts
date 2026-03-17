import { useQuery } from '@tanstack/react-query'
import * as GuestApi from '../services/guest.service'
import * as EventApi from '../services/event.service'

// ─── Query Keys ─────────────────────────────────────────

export const guestKeys = {
  myTicket: (participationId: string) => ['guest', 'myTicket', participationId] as const,
  eventAddress: (eventId: string) => ['events', eventId, 'address'] as const,
}

// ─── Queries ────────────────────────────────────────────

export function useMyTicket(participationId: string) {
  return useQuery({
    queryKey: guestKeys.myTicket(participationId),
    queryFn: async () => {
      const res = await GuestApi.getMyTicket(participationId)
      return res.data
    },
    enabled: !!participationId,
  })
}

export function useEventAddress(eventId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: guestKeys.eventAddress(eventId),
    queryFn: async () => {
      const res = await EventApi.getEventAddress(eventId)
      return res.data
    },
    enabled: !!eventId && (options?.enabled ?? true),
    retry: false,
  })
}
