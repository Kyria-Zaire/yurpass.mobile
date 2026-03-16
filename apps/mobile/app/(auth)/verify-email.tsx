import { useState, useEffect, useCallback } from 'react'
import { View, Text, KeyboardAvoidingView, Platform, StyleSheet, Alert } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import Animated, { FadeInDown } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import * as Linking from 'expo-linking'
import { Button } from '../../components/ui/Button'
import { COLORS, FONTS } from '../../constants/theme'
import * as AuthApi from '../../services/auth.service'

const RESEND_COOLDOWN = 60

export default function VerifyEmailScreen(): React.JSX.Element {
  const router = useRouter()
  const { email } = useLocalSearchParams<{ email: string }>()
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN)
  const [resending, setResending] = useState(false)

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [countdown])

  useEffect(() => {
    const subscription = Linking.addEventListener('url', (event) => {
      void handleDeepLink(event.url)
    })
    return () => subscription.remove()
  }, [])

  const handleDeepLink = async (url: string): Promise<void> => {
    const parsed = Linking.parse(url)
    const token = parsed.queryParams?.['token']
    if (typeof token !== 'string') return

    try {
      await AuthApi.verifyEmail(token)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      Alert.alert('Succès', 'Email vérifié avec succès !', [
        { text: 'Se connecter', onPress: () => router.replace('/(auth)/login' as never) },
      ])
    } catch (error: unknown) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      const message = error instanceof Error ? error.message : 'Erreur de vérification'
      Alert.alert('Erreur', message)
    }
  }

  const handleResend = useCallback(async (): Promise<void> => {
    if (!email || countdown > 0) return
    setResending(true)
    try {
      await AuthApi.register({
        email,
        password: '',
        displayName: '',
        city: '',
      })
    } catch {
      // Anti-enumeration: don't reveal if email exists
    } finally {
      setResending(false)
      setCountdown(RESEND_COOLDOWN)
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
  }, [email, countdown])

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Animated.View entering={FadeInDown.springify().delay(100)}>
          <Text style={styles.icon}>📧</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.springify().delay(200)}>
          <Text style={styles.title}>Vérifiez votre email</Text>
          <Text style={styles.subtitle}>
            Un lien de vérification a été envoyé à
          </Text>
          {email ? <Text style={styles.email}>{email}</Text> : null}
        </Animated.View>

        <Animated.View entering={FadeInDown.springify().delay(300)} style={styles.instructions}>
          <Text style={styles.instructionText}>
            Cliquez sur le lien dans l&apos;email pour activer votre compte.
            Vérifiez votre dossier spam si vous ne le trouvez pas.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.springify().delay(400)} style={styles.actions}>
          <Button
            variant="primary"
            size="lg"
            onPress={() => { void handleResend() }}
            loading={resending}
            disabled={countdown > 0}
          >
            {countdown > 0
              ? `Renvoyer dans ${countdown}s`
              : 'Renvoyer l\'email'}
          </Button>

          <Button
            variant="ghost"
            size="md"
            onPress={() => router.replace('/(auth)/login' as never)}
          >
            Retour à la connexion
          </Button>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
    gap: 16,
  },
  icon: {
    fontSize: 64,
    textAlign: 'center',
    marginBottom: 8,
  },
  title: {
    fontFamily: FONTS.heading,
    fontSize: 28,
    color: COLORS.text,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 16,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 8,
  },
  email: {
    fontFamily: FONTS.body,
    fontSize: 16,
    color: COLORS.accent,
    textAlign: 'center',
    fontWeight: '600',
    marginTop: 4,
  },
  instructions: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  instructionText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  actions: {
    gap: 12,
    marginTop: 24,
  },
})
