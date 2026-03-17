import { apiFetch } from './auth.service'
import type {
  CreateRatingInput,
  RatingListResponse,
  ReputationScore,
  RatingRole,
} from '@yurpass/types'

// ─── Rating Service ──────────────────────────────────────

export async function submitRating(
  input: CreateRatingInput,
): Promise<{ success: boolean; data: { publicId: string } }> {
  return apiFetch('/ratings', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function getUserRatings(
  userId: string,
  params?: { role?: RatingRole; cursor?: string; limit?: number },
): Promise<{ success: boolean; data: RatingListResponse }> {
  const search = new URLSearchParams()
  if (params?.role) search.set('role', params.role)
  if (params?.cursor) search.set('cursor', params.cursor)
  if (params?.limit) search.set('limit', String(params.limit))
  const qs = search.toString()

  return apiFetch(`/ratings/users/${userId}/ratings${qs ? `?${qs}` : ''}`)
}

export async function getReputation(
  userId: string,
): Promise<{ success: boolean; data: ReputationScore }> {
  return apiFetch(`/ratings/users/${userId}/reputation`)
}

