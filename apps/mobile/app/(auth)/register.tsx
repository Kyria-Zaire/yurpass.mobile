import { useState } from 'react'
import { Text, TextInput, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import Animated, { FadeInDown } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { registerSchema } from '@yurpass/validators'
import { Button } from '../../components/ui/Button'
import { PasswordStrength } from '../../components/ui/PasswordStrength'
import { COLORS, FONTS } from '../../constants/theme'
import * as AuthApi from '../../services/auth.service'

interface RegisterForm {
  email: string
  password: string
  displayName: string
  city: string
}

export default function RegisterScreen(): React.JSX.Element {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const { control, handleSubmit, watch, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema as never),
    defaultValues: { email: '', password: '', displayName: '', city: '' },
  })

  const password = watch('password')

  const onSubmit = async (data: RegisterForm): Promise<void> => {
    setLoading(true)
    try {
      await AuthApi.register(data)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      router.push({ pathname: '/(auth)/verify-email', params: { email: data.email } } as never)
    } catch (error: unknown) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      const message = error instanceof Error ? error.message : 'Erreur lors de l\'inscription'
      Alert.alert('Erreur', message)
    } finally {
      setLoading(false)
    }
  }

  const fields: { name: keyof RegisterForm; placeholder: string; keyboardType?: 'email-address'; secure?: boolean; delay: number }[] = [
    { name: 'displayName', placeholder: 'Nom affiché', delay: 200 },
    { name: 'email', placeholder: 'Email', keyboardType: 'email-address', delay: 300 },
    { name: 'password', placeholder: 'Mot de passe (min. 12 caractères)', secure: true, delay: 400 },
    { name: 'city', placeholder: 'Ville', delay: 500 },
  ]

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInDown.springify().delay(100)}>
          <Text style={styles.title}>Rejoindre Yurpass</Text>
          <Text style={styles.subtitle}>Votre accès à l&apos;exclusif</Text>
        </Animated.View>

        {fields.map((field) => (
          <Animated.View key={field.name} entering={FadeInDown.springify().delay(field.delay)}>
            <Controller
              control={control}
              name={field.name}
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.input, errors[field.name] && styles.inputError]}
                  placeholder={field.placeholder}
                  placeholderTextColor={COLORS.textMuted}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  keyboardType={field.keyboardType ?? 'default'}
                  secureTextEntry={field.secure}
                  autoCapitalize={field.name === 'email' ? 'none' : 'words'}
                />
              )}
            />
            {errors[field.name] && (
              <Text style={styles.errorText}>{errors[field.name]?.message}</Text>
            )}
            {field.name === 'password' && <PasswordStrength password={password} />}
          </Animated.View>
        ))}

        <Animated.View entering={FadeInDown.springify().delay(600)} style={styles.actions}>
          <Button
            variant="primary"
            size="lg"
            onPress={handleSubmit(onSubmit)}
            loading={loading}
          >
            Créer mon compte
          </Button>

          <Button
            variant="ghost"
            size="md"
            onPress={() => router.push('/(auth)/login' as never)}
          >
            Déjà membre ? Se connecter
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
  },
  subtitle: {
    fontFamily: FONTS.accent,
    fontSize: 16,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 1,
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
