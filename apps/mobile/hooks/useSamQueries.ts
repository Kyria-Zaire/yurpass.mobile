import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as SamApi from '../services/sam.service'

export const samKeys = {
  missions: ['sam', 'missions'] as const,
  mission: (id: string) => ['sam', 'missions', id] as const,
}

export function useSamMissions() {
  return useQuery({
    queryKey: samKeys.missions,
    queryFn: async () => {
      const res = await SamApi.listMissions()
      return res.data
    },
  })
}

export function useSamMission(id: string) {
  return useQuery({
    queryKey: samKeys.mission(id),
    queryFn: async () => {
      const res = await SamApi.listMissions()
      return res.data.missions.find((m) => m.publicId === id) ?? null
    },
    enabled: !!id,
    refetchInterval: 30000,
  })
}

export function useConfirmMissionMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => SamApi.confirmMission(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: samKeys.missions })
    },
  })
}

export function useStartMissionMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => SamApi.startMission(id),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: samKeys.missions })
      void queryClient.invalidateQueries({ queryKey: samKeys.mission(id) })
    },
  })
}

export function useLogTripMutation(missionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Parameters<typeof SamApi.logTrip>[1]) =>
      SamApi.logTrip(missionId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: samKeys.mission(missionId) })
    },
  })
}

export function useConfirmArrivalMutation(missionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (tripIndex: number) => SamApi.confirmArrival(missionId, tripIndex),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: samKeys.mission(missionId) })
    },
  })
}

export function useReportIncidentMutation(missionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Parameters<typeof SamApi.reportIncident>[1]) =>
      SamApi.reportIncident(missionId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: samKeys.mission(missionId) })
    },
  })
}

export function useCompleteMissionMutation(missionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (notes?: string) => SamApi.completeMission(missionId, notes),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: samKeys.missions })
      void queryClient.invalidateQueries({ queryKey: samKeys.mission(missionId) })
    },
  })
}

