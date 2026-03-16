import { useState, useCallback } from 'react'
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import Animated, { FadeInDown } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import * as Clipboard from 'expo-clipboard'
import type { TwoFactorSetupResponse } from '@yurpass/types'
import { OTPInput } from '../../components/ui/OTPInput'
import { Button } from '../../components/ui/Button'
import { COLORS, FONTS, BORDER_RADIUS } from '../../constants/theme'
import * as AuthApi from '../../services/auth.service'

type SetupStep = 'init' | 'secret' | 'verify' | 'backup'

export default function Setup2FAScreen(): React.JSX.Element {
  const router = useRouter()
  const [step, setStep] = useState<SetupStep>('init')
  const [setupData, setSetupData] = useState<TwoFactorSetupResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)

  const handleSetup = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const data = await AuthApi.setup2FA()
      setSetupData(data)
      setStep('secret')
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    } catch (error: unknown) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      const message = error instanceof Error ? error.message : 'Erreur lors de la configuration'
      Alert.alert('Erreur', message)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleVerify = useCallback(async (code: string): Promise<void> => {
    setVerifying(true)
    try {
      await AuthApi.verify2FA(code)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setStep('backup')
    } catch (error: unknown) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      const message = error instanceof Error ? error.message : 'Code invalide'
      Alert.alert('Erreur', message)
    } finally {
      setVerifying(false)
    }
  }, [])

  const copyToClipboard = useCallback(async (text: string, label: string): Promise<void> => {
    await Clipboard.setStringAsync(text)
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    Alert.alert('Copié', `${label} copié dans le presse-papier`)
  }, [])

  const handleDone = useCallback((): void => {
    router.replace('/(app)' as never)
  }, [router])

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      {step === 'init' && (
        <Animated.View entering={FadeInDown.springify().delay(100)} style={styles.section}>
          <Text style={styles.icon}>🔐</Text>
          <Text style={styles.title}>Authentification 2FA</Text>
          <Text style={styles.description}>
            La double authentification renforce la sécurité de votre compte.
            Vous aurez besoin d&apos;une application comme Google Authenticator ou Authy.
          </Text>
          <Button
            variant="primary"
            size="lg"
            onPress={() => { void handleSetup() }}
            loading={loading}
          >
            Configurer le 2FA
          </Button>
        </Animated.View>
      )}

      {step === 'secret' && setupData && (
        <>
          <Animated.View entering={FadeInDown.springify().delay(100)} style={styles.section}>
            <Text style={styles.title}>Configurez votre app</Text>
            <Text style={styles.description}>
              Ouvrez votre application d&apos;authentification et ajoutez cette clé secrète manuellement :
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.springify().delay(200)} style={styles.secretContainer}>
            <Text style={styles.secretLabel}>Clé secrète</Text>
            <Text style={styles.secretValue} selectable>{setupData.secret}</Text>
            <Button
              variant="ghost"
              size="sm"
              onPress={() => { void copyToClipboard(setupData.secret, 'Clé secrète') }}
            >
              Copier la clé
            </Button>
          </Animated.View>

          <Animated.View entering={FadeInDown.springify().delay(300)} style={styles.section}>
            <Text style={styles.stepTitle}>Entrez le code à 6 chiffres</Text>
            <Text style={styles.description}>
              Saisissez le code affiché dans votre application pour vérifier la configuration.
            </Text>
            <OTPInput onComplete={(code) => { void handleVerify(code) }} />
            {verifying && <Text style={styles.verifyingText}>Vérification...</Text>}
          </Animated.View>
        </>
      )}

      {step === 'backup' && setupData && (
        <>
          <Animated.View entering={FadeInDown.springify().delay(100)} style={styles.section}>
            <Text style={styles.icon}>✅</Text>
            <Text style={styles.title}>2FA activé !</Text>
            <Text style={styles.description}>
              Sauvegardez vos codes de secours dans un endroit sûr.
              Chaque code ne peut être utilisé qu&apos;une seule fois.
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.springify().delay(200)} style={styles.backupContainer}>
            <Text style={styles.backupTitle}>Codes de secours</Text>
            <View style={styles.codesGrid}>
              {setupData.backupCodes.map((code) => (
                <View key={code} style={styles.codeItem}>
                  <Text style={styles.codeText}>{code}</Text>
                </View>
              ))}
            </View>
            <Button
              variant="ghost"
              size="sm"
              onPress={() => { void copyToClipboard(setupData.backupCodes.join('\n'), 'Codes de secours') }}
            >
              Copier tous les codes
            </Button>
          </Animated.View>

          <Animated.View entering={FadeInDown.springify().delay(300)} style={styles.section}>
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                Ces codes ne seront plus affichés. Conservez-les précieusement.
              </Text>
            </View>
            <Button variant="primary" size="lg" onPress={handleDone}>
              J&apos;ai sauvegardé mes codes
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
  section: {
    gap: 12,
    alignItems: 'center',
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
  stepTitle: {
    fontFamily: FONTS.heading,
    fontSize: 20,
    color: COLORS.text,
    textAlign: 'center',
  },
  description: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  secretContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  secretLabel: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  secretValue: {
    fontFamily: FONTS.body,
    fontSize: 18,
    color: COLORS.accent,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
  },
  verifyingText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 8,
  },
  backupContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    alignItems: 'center',
    gap: 12,
  },
  backupTitle: {
    fontFamily: FONTS.heading,
    fontSize: 16,
    color: COLORS.text,
  },
  codesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  codeItem: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  codeText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
    letterSpacing: 1,
  },
  warningBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.error,
    padding: 12,
  },
  warningText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.error,
    textAlign: 'center',
    lineHeight: 20,
  },
})
