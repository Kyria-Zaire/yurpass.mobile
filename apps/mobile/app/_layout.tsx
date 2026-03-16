import { useEffect, useState, useCallback } from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { Stack } from 'expo-router'
import { useFonts } from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '../stores/auth.store'
import { useProtectedRoute } from '../hooks/useProtectedRoute'
import { useInactivityLogout } from '../hooks/useInactivityLogout'
import { COLORS } from '../constants/theme'

SplashScreen.preventAutoHideAsync()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 2,
    },
  },
})

function RootNavigator(): React.JSX.Element | null {
  const { isLoading } = useAuthStore()

  useProtectedRoute()
  useInactivityLogout()

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    )
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.bg },
        animation: 'fade',
      }}
    />
  )
}

export default function RootLayout(): React.JSX.Element | null {
  const [appReady, setAppReady] = useState(false)
  const initialize = useAuthStore((s) => s.initialize)

  const [fontsLoaded] = useFonts({
    PlayfairDisplay: require('../assets/fonts/PlayfairDisplay-Regular.ttf'),
    'PlayfairDisplay-Bold': require('../assets/fonts/PlayfairDisplay-Bold.ttf'),
    Inter: require('../assets/fonts/Inter-Regular.ttf'),
    'Inter-Medium': require('../assets/fonts/Inter-Medium.ttf'),
    'Inter-SemiBold': require('../assets/fonts/Inter-SemiBold.ttf'),
    'Inter-Bold': require('../assets/fonts/Inter-Bold.ttf'),
    CormorantGaramond: require('../assets/fonts/CormorantGaramond-Regular.ttf'),
  })

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync()
      setAppReady(true)
    }
  }, [fontsLoaded])

  useEffect(() => {
    void onLayoutRootView()
  }, [onLayoutRootView])

  useEffect(() => {
    void initialize()
  }, [initialize])

  if (!fontsLoaded || !appReady) {
    return null
  }

  return (
    <QueryClientProvider client={queryClient}>
      <View style={styles.root} onLayout={onLayoutRootView}>
        <RootNavigator />
      </View>
    </QueryClientProvider>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
  },
})
