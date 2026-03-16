import { useState } from 'react'
import { Text, TextInput, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import Animated, { FadeInDown } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema } from '@yurpass/validators'
import { Button } from '../../components/ui/Button'
import { useAuthStore } from '../../stores/auth.store'
import { COLORS, FONTS } from '../../constants/theme'
import * as AuthApi from '../../services/auth.service'

interface LoginForm {
  email: string
  password: string
}

export default function LoginScreen(): React.JSX.Element {
  const router = useRouter()
  const setUser = useAuthStore((s) => s.setUser)
  const [loading, setLoading] = useState(false)

  const { control, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema as never),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = async (data: LoginForm): Promise<void> => {
    setLoading(true)
    try {
      const result = await AuthApi.login(data)

      if (result.requires2FA && result.tempToken) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        router.push({ pathname: '/(auth)/2fa-login', params: { tempToken: result.tempToken } } as never)
        return
      }

      if (result.tokens) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        const me = await AuthApi.getMe()
        setUser(me)
        router.replace('/(app)' as never)
      }
    } catch (error: unknown) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      const message = error instanceof Error ? error.message : 'Erreur de connexion'
      Alert.alert('Erreur', message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInDown.springify().delay(100)}>
          <Text style={styles.title}>Bon retour</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.springify().delay(200)}>
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.input, errors.email && styles.inputError]}
                placeholder="Email"
                placeholderTextColor={COLORS.textMuted}
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            )}
          />
          {errors.email && <Text style={styles.errorText}>{errors.email.message}</Text>}
        </Animated.View>

        <Animated.View entering={FadeInDown.springify().delay(300)}>
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.input, errors.password && styles.inputError]}
                placeholder="Mot de passe"
                placeholderTextColor={COLORS.textMuted}
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                secureTextEntry
              />
            )}
          />
          {errors.password && <Text style={styles.errorText}>{errors.password.message}</Text>}
        </Animated.View>

        <Animated.View entering={FadeInDown.springify().delay(400)} style={styles.actions}>
          <Button variant="primary" size="lg" onPress={handleSubmit(onSubmit)} loading={loading}>
            Se connecter
          </Button>

          <Button variant="ghost" size="md" onPress={() => router.push('/(auth)/register' as never)}>
            Pas encore membre ? S&apos;inscrire
          </Button>

          <Button variant="ghost" size="sm" onPress={() => Alert.alert('Info', 'Fonctionnalité bientôt disponible')}>
            Mot de passe oublié ?
          </Button>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
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
    gap: 16,
  },
  title: {
    fontFamily: FONTS.heading,
    fontSize: 32,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 16,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  errorText: {
    color: COLORS.error,
    fontFamily: FONTS.body,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  actions: {
    gap: 12,
    marginTop: 16,
  },
})
