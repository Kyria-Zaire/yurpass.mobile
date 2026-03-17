import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as EventApi from '../services/event.service'
import type { CreateEventInput } from '@yurpass/types'

// ─── Query Keys ─────────────────────────────────────────

export const eventKeys = {
  all: ['events'] as const,
  detail: (id: string) => ['events', id] as const,
  guests: (eventId: string, status?: string) =>
    ['events', eventId, 'guests', ...(status ? [status] : [])] as const,
}

// ─── Queries ────────────────────────────────────────────

export function useMyEvents(status?: string) {
  return useQuery({
    queryKey: [...eventKeys.all, status],
    queryFn: async () => {
      const res = await EventApi.listMyEvents({ status })
      return res.data
    },
  })
}

export function useEvent(eventId: string) {
  return useQuery({
    queryKey: eventKeys.detail(eventId),
    queryFn: async () => {
      const res = await EventApi.getEvent(eventId)
      return res.data
    },
    enabled: !!eventId,
  })
}

export function useGuests(eventId: string, status?: string) {
  return useQuery({
    queryKey: eventKeys.guests(eventId, status),
    queryFn: async () => {
      const res = await EventApi.listGuests(eventId, { status })
      return res.data
    },
    enabled: !!eventId,
  })
}

// ─── Mutations ──────────────────────────────────────────

export function useCreateEventMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateEventInput) => EventApi.createEvent(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: eventKeys.all })
    },
  })
}

export function usePublishEventMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (eventId: string) => EventApi.publishEvent(eventId),
    onSuccess: (_data, eventId) => {
      void queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId) })
      void queryClient.invalidateQueries({ queryKey: eventKeys.all })
    },
  })
}

export function useCancelEventMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (eventId: string) => EventApi.cancelEvent(eventId),
    onSuccess: (_data, eventId) => {
      void queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId) })
      void queryClient.invalidateQueries({ queryKey: eventKeys.all })
    },
  })
}

export function useApproveGuestMutation(eventId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: { participationId: string; hostNote?: string }) =>
      EventApi.approveGuest(eventId, params.participationId, params.hostNote),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: eventKeys.guests(eventId) })
      void queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId) })
    },
  })
}

export function useRejectGuestMutation(eventId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (participationId: string) =>
      EventApi.rejectGuest(eventId, participationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: eventKeys.guests(eventId) })
    },
  })
}
