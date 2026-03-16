import { useEffect, useRef, useCallback } from 'react'
import { AppState } from 'react-native'
import type { AppStateStatus } from 'react-native'
import { useAuthStore } from '../stores/auth.store'

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes

export function useInactivityLogout(): {
  resetTimer: () => void
} {
  const logout = useAuthStore((s) => s.logout)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const backgroundTimestamp = useRef<number | null>(null)
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = useCallback((): void => {
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current)
      inactivityTimer.current = null
    }
  }, [])

  const startTimer = useCallback((): void => {
    clearTimer()
    if (!isAuthenticated) return
    inactivityTimer.current = setTimeout(() => {
      void logout()
    }, INACTIVITY_TIMEOUT_MS)
  }, [isAuthenticated, logout, clearTimer])

  const resetTimer = useCallback((): void => {
    startTimer()
  }, [startTimer])

  useEffect(() => {
    if (!isAuthenticated) {
      clearTimer()
      return
    }

    startTimer()

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        backgroundTimestamp.current = Date.now()
        clearTimer()
      } else if (nextState === 'active') {
        if (backgroundTimestamp.current) {
          const elapsed = Date.now() - backgroundTimestamp.current
          backgroundTimestamp.current = null
          if (elapsed >= INACTIVITY_TIMEOUT_MS) {
            void logout()
            return
          }
        }
        startTimer()
      }
    })

    return () => {
      subscription.remove()
      clearTimer()
    }
  }, [isAuthenticated, startTimer, clearTimer, logout])

  return { resetTimer }
}
