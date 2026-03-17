export enum RatingRole {
  AS_GUEST = 'as-guest',
  AS_HOST = 'as-host',
  AS_SAM = 'as-sam',
}

export interface IRating {
  publicId: string
  fromUserId: string
  toUserId: string
  eventId: string
  role: RatingRole
  score: number
  comment?: string
  isVisible: boolean
  createdAt: Date
  updatedAt: Date
}

export interface CreateRatingInput {
  toUserId: string
  eventId: string
  role: RatingRole
  score: number
  comment?: string
}

export interface RatingListItem {
  publicId: string
  fromUserId: string
  fromDisplayName?: string
  role: RatingRole
  score: number
  comment?: string
  createdAt: Date
}

export interface RatingListResponse {
  ratings: RatingListItem[]
  nextCursor?: string
  total: number
  avgScore: number
}

export interface ReputationBreakdown {
  asHost: { avg: number; count: number }
  asGuest: { avg: number; count: number }
  asSam: { avg: number; count: number }
}

export interface ReputationScore {
  score: number
  avgRating: number
  totalRatings: number
  breakdown: ReputationBreakdown
}
