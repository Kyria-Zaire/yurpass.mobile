import { create } from 'zustand'
import { UserRole } from '@yurpass/types'
import type { SessionUser } from '@yurpass/types'
import * as AuthApi from '../services/auth.service'

interface AuthStore {
  user: SessionUser | null
  isLoading: boolean
  isAuthenticated: boolean
  setUser: (user: SessionUser | null) => void
  logout: () => Promise<void>
  initialize: () => Promise<void>
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  setUser: (user) =>
    set({
      user,
      isAuthenticated: user !== null,
      isLoading: false,
    }),

  logout: async () => {
    try {
      await AuthApi.logout()
    } finally {
      set({ user: null, isAuthenticated: false, isLoading: false })
    }
  },

  initialize: async () => {
    set({ isLoading: true })
    try {
      const token = await AuthApi.getAccessToken()
      if (!token) {
        set({ user: null, isAuthenticated: false, isLoading: false })
        return
      }

      const user = await AuthApi.getMe()
      set({ user, isAuthenticated: true, isLoading: false })
    } catch {
      await AuthApi.clearTokens()
      set({ user: null, isAuthenticated: false, isLoading: false })
    }
  },
}))

export function useAuth(): {
  user: SessionUser | null
  isAuthenticated: boolean
  isLoading: boolean
  hasRole: (role: UserRole) => boolean
  hasAnyRole: (roles: UserRole[]) => boolean
  isHost: boolean
  isSam: boolean
  isModel: boolean
  isAdmin: boolean
} {
  const { user, isAuthenticated, isLoading } = useAuthStore()

  const hasRole = (role: UserRole): boolean =>
    user?.roles.includes(role) ?? false

  const hasAnyRole = (roles: UserRole[]): boolean =>
    roles.some((r) => user?.roles.includes(r))

  return {
    user,
    isAuthenticated,
    isLoading,
    hasRole,
    hasAnyRole,
    isHost: hasRole(UserRole.HOST),
    isSam: hasRole(UserRole.SAM),
    isModel: hasRole(UserRole.MODEL),
    isAdmin: hasRole(UserRole.ADMIN),
  }
}
