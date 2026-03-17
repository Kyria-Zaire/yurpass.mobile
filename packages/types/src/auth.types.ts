import type { UserRole } from './index.js'

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface SessionUser {
  publicId: string
  email: string
  roles: UserRole[]
  profile: {
    displayName: string
    avatarUrl?: string
    bio?: string
    city: string
    verifiedAt?: Date
  }
  reputation: {
    score: number
    totalRatings: number
    avgRating: number
  }
  security: {
    twoFactorEnabled: boolean
  }
  subscription: {
    plan: string
    expiresAt?: Date
  }
  createdAt: Date
}

export interface LoginResponse {
  success: true
  tokens?: AuthTokens
  requires2FA?: boolean
  tempToken?: string
}

export interface TwoFactorSetupResponse {
  totpURI: string
  secret: string
  backupCodes: string[]
}

export interface RegisterInput {
  email: string
  password: string
  displayName: string
  city: string
}

export interface LoginInput {
  email: string
  password: string
}

export interface UpdateProfileInput {
  displayName?: string
  bio?: string
  city?: string
}
