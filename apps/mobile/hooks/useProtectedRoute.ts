import { useEffect } from 'react'
import { useRouter, useSegments } from 'expo-router'
import { useAuthStore } from '../stores/auth.store'

export function useProtectedRoute(): void {
  const { isAuthenticated, isLoading } = useAuthStore()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return

    const inAuthGroup = segments[0] === '(auth)'

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/welcome' as never)
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(app)' as never)
    }
  }, [isAuthenticated, isLoading, segments, router])
}
