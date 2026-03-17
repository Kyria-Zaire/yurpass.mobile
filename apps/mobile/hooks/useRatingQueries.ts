import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as RatingApi from '../services/rating.service'
import type { CreateRatingInput, RatingRole } from '@yurpass/types'

// ─── Query Keys ─────────────────────────────────────────

export const ratingKeys = {
  userRatings: (userId: string, role?: RatingRole) =>
    ['ratings', 'user', userId, role] as const,
  reputation: (userId: string) => ['ratings', 'reputation', userId] as const,
}

// ─── Queries ────────────────────────────────────────────

export function useUserRatings(userId: string, role?: RatingRole) {
  return useQuery({
    queryKey: ratingKeys.userRatings(userId, role),
    queryFn: async () => {
      const res = await RatingApi.getUserRatings(userId, { role })
      return res.data
    },
    enabled: !!userId,
  })
}

export function useUserReputation(userId: string) {
  return useQuery({
    queryKey: ratingKeys.reputation(userId),
    queryFn: async () => {
      const res = await RatingApi.getReputation(userId)
      return res.data
    },
    enabled: !!userId,
  })
}

// ─── Mutations ──────────────────────────────────────────

export function useSubmitRatingMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateRatingInput) => RatingApi.submitRating(input),
    onSuccess: (_data, variables) => {
      // Invalidate reputation and ratings for rated user
      void queryClient.invalidateQueries({
        queryKey: ratingKeys.reputation(variables.toUserId),
      })
      void queryClient.invalidateQueries({
        queryKey: ratingKeys.userRatings(variables.toUserId, variables.role),
      })
    },
  })
}

