import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import * as SecureStore from 'expo-secure-store'
import { useRouter } from 'expo-router'
import { registerPushToken } from '../services/notification.service'
import { useAuthStore } from '../stores/auth.store'

const PUSH_TOKEN_KEY = 'yurpass_push_token'

// Configure notification handler for foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export function useNotifications(): void {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const notificationListener = useRef<Notifications.Subscription | null>(null)
  const responseListener = useRef<Notifications.Subscription | null>(null)

  useEffect(() => {
    if (!user) return

    void setupNotifications()

    // Foreground notification received
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (_notification) => {
        // Notification displayed automatically via handler above
      },
    )

    // User tapped notification → deep link
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as
          | { deepLink?: string }
          | undefined

        if (data?.deepLink) {
          router.push(data.deepLink as never)
        }
      },
    )

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove()
      }
      if (responseListener.current) {
        responseListener.current.remove()
      }
    }
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  async function setupNotifications(): Promise<void> {
    try {
      // Android notification channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('yurpass', {
          name: 'Yurpass',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          sound: 'default',
        })
      }

      // Request permission
      const { status: existingStatus } = await Notifications.getPermissionsAsync()
      let finalStatus = existingStatus

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync()
        finalStatus = status
      }

      if (finalStatus !== 'granted') {
        return
      }

      // Get Expo push token
      const projectId = process.env.EXPO_PUBLIC_PROJECT_ID
      const tokenData = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined,
      )
      const token = tokenData.data

      // Check if already registered
      const storedToken = await SecureStore.getItemAsync(PUSH_TOKEN_KEY)
      if (storedToken === token) {
        return
      }

      // Register with backend
      const platform = Platform.OS === 'ios' ? 'ios' : 'android'
      await registerPushToken(token, platform)

      // Store locally to avoid re-registration
      await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token)
    } catch {
      // Notification setup is non-critical — fail silently
    }
  }
}
