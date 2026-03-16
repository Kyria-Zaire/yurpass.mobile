import { useState, useCallback } from 'react'
import { Text, TextInput, ScrollView, StyleSheet, Alert } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import Animated, { FadeInDown } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { OTPInput } from '../../components/ui/OTPInput'
import { Button } from '../../components/ui/Button'
import { useAuthStore } from '../../stores/auth.store'
import { COLORS, FONTS, BORDER_RADIUS } from '../../constants/theme'
import * as AuthApi from '../../services/auth.service'

export default function TwoFactorLoginScreen(): React.JSX.Element {
  const router = useRouter()
  const { tempToken } = useLocalSearchParams<{ tempToken: string }>()
  const setUser = useAuthStore((s) => s.setUser)
  const [loading, setLoading] = useState(false)
  const [showBackupInput, setShowBackupInput] = useState(false)
  const [backupCode, setBackupCode] = useState('')

  const handleOTPComplete = useCallback(async (code: string): Promise<void> => {
    if (!tempToken) return
    setLoading(true)
    try {
      await AuthApi.login2FA(tempToken, code)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      const me = await AuthApi.getMe()
      setUser(me)
      router.replace('/(app)' as never)
    } catch (error: unknown) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      const message = error instanceof Error ? error.message : 'Code invalide'
      Alert.alert('Erreur', message)
    } finally {
      setLoading(false)
    }
  }, [tempToken, setUser, router])

  const handleBackupSubmit = useCallback(async (): Promise<void> => {
    if (!tempToken || !backupCode.trim()) return
    setLoading(true)
    try {
      await AuthApi.login2FA(tempToken, backupCode.trim())
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      const me = await AuthApi.getMe()
      setUser(me)
      router.replace('/(app)' as never)
    } catch (error: unknown) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      const message = error instanceof Error ? error.message : 'Code de secours invalide'
      Alert.alert('Erreur', message)
    } finally {
      setLoading(false)
    }
  }, [tempToken, backupCode, setUser, router])

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <Animated.View entering={FadeInDown.springify().delay(100)}>
        <Text style={styles.icon}>🔒</Text>
        <Text style={styles.title}>Vérification 2FA</Text>
        <Text style={styles.subtitle}>
          Entrez le code de votre application d&apos;authentification
        </Text>
      </Animated.View>

      {!showBackupInput ? (
        <>
          <Animated.View entering={FadeInDown.springify().delay(200)} style={styles.otpSection}>
            <OTPInput onComplete={(code) => { void handleOTPComplete(code) }} />
            {loading && <Text style={styles.loadingText}>Vérification...</Text>}
          </Animated.View>

          <Animated.View entering={FadeInDown.springify().delay(300)} style={styles.actions}>
            <Button
              variant="ghost"
              size="sm"
              onPress={() => setShowBackupInput(true)}
            >
              Utiliser un code de secours
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onPress={() => router.back()}
            >
              Retour
            </Button>
          </Animated.View>
        </>
      ) : (
        <>
          <Animated.View entering={FadeInDown.springify().delay(200)} style={styles.backupSection}>
            <Text style={styles.backupLabel}>Code de secours</Text>
            <TextInput
              style={styles.backupInput}
              placeholder="Entrez votre code de secours"
              placeholderTextColor={COLORS.textMuted}
              value={backupCode}
              onChangeText={setBackupCode}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Button
              variant="primary"
              size="lg"
              onPress={() => { void handleBackupSubmit() }}
              loading={loading}
              disabled={!backupCode.trim()}
            >
              Vérifier
            </Button>
          </Animated.View>

          <Animated.View entering={FadeInDown.springify().delay(300)} style={styles.actions}>
            <Button
              variant="ghost"
              size="sm"
              onPress={() => {
                setShowBackupInput(false)
                setBackupCode('')
              }}
            >
              Utiliser le code TOTP
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onPress={() => router.back()}
            >
              Retour
            </Button>
          </Animated.View>
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
    gap: 24,
  },
  icon: {
    fontSize: 56,
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
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  otpSection: {
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  backupSection: {
    gap: 12,
  },
  backupLabel: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textMuted,
    marginLeft: 4,
  },
  backupInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 16,
  },
  actions: {
    gap: 8,
    alignItems: 'center',
  },
})
