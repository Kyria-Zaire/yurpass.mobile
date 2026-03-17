import { useState, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import Animated, { SlideInRight, SlideOutLeft, FadeInDown } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { z } from 'zod'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../../../constants/theme'
import { Button } from '../../../components/ui/Button'
import { useCreateEventMutation } from '../../../hooks/useEventQueries'
import type { CreateEventInput, AccessType } from '@yurpass/types'

// ─── Step Zod schemas ───────────────────────────────────

const step1Schema = z.object({
  title: z.string().min(3, 'Min. 3 caractères').max(100),
  description: z.string().min(10, 'Min. 10 caractères').max(2000),
  themeName: z.string().min(1, 'Thème requis'),
  dresscode: z.string().min(1, 'Dresscode requis'),
})

const step2Schema = z.object({
  city: z.string().min(1, 'Ville requise'),
  address: z.string().optional(),
  maxGuests: z.coerce.number().int().min(2, 'Min. 2 invités').max(500, 'Max. 500 invités'),
})

const step3Schema = z.object({
  startDate: z.string().min(1, 'Date de début requise'),
  endDate: z.string().min(1, 'Date de fin requise'),
  doorsOpenAt: z.string().min(1, 'Heure d\'ouverture requise'),
  accessType: z.enum(['invite-only', 'application']),
})

const TOTAL_STEPS = 3
const SAM_THRESHOLD = 20

export default function CreateEventScreen(): React.JSX.Element {
  const router = useRouter()
  const createMutation = useCreateEventMutation()

  const [step, setStep] = useState(1)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Step 1 fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [themeName, setThemeName] = useState('')
  const [dresscode, setDresscode] = useState('')

  // Step 2 fields
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  const [maxGuests, setMaxGuests] = useState('')

  // Step 3 fields
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [doorsOpenAt, setDoorsOpenAt] = useState('')
  const [accessType, setAccessType] = useState<'invite-only' | 'application'>('invite-only')

  // ─── Validation per step ────────────────────────────────

  const validateStep = useCallback((): boolean => {
    setErrors({})

    if (step === 1) {
      const result = step1Schema.safeParse({ title, description, themeName, dresscode })
      if (!result.success) {
        const fieldErrors: Record<string, string> = {}
        result.error.issues.forEach((issue) => {
          fieldErrors[issue.path[0] as string] = issue.message
        })
        setErrors(fieldErrors)
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        return false
      }
    }

    if (step === 2) {
      const result = step2Schema.safeParse({ city, address, maxGuests })
      if (!result.success) {
        const fieldErrors: Record<string, string> = {}
        result.error.issues.forEach((issue) => {
          fieldErrors[issue.path[0] as string] = issue.message
        })
        setErrors(fieldErrors)
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        return false
      }
    }

    if (step === 3) {
      const result = step3Schema.safeParse({ startDate, endDate, doorsOpenAt, accessType })
      if (!result.success) {
        const fieldErrors: Record<string, string> = {}
        result.error.issues.forEach((issue) => {
          fieldErrors[issue.path[0] as string] = issue.message
        })
        setErrors(fieldErrors)
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        return false
      }
    }

    return true
  }, [step, title, description, themeName, dresscode, city, address, maxGuests, startDate, endDate, doorsOpenAt, accessType])

  const handleNext = (): void => {
    if (!validateStep()) return
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setStep((s) => Math.min(s + 1, TOTAL_STEPS))
  }

  const handleBack = (): void => {
    if (step === 1) {
      router.back()
      return
    }
    setErrors({})
    setStep((s) => s - 1)
  }

  // ─── Submit ─────────────────────────────────────────────

  const handleSubmit = async (): Promise<void> => {
    if (!validateStep()) return

    const input: CreateEventInput = {
      title,
      description,
      theme: { id: 'custom', name: themeName, dresscode },
      schedule: {
        startDate,
        endDate,
        doorsOpenAt,
      },
      venue: {
        city,
        ...(address ? { address } : {}),
      },
      capacity: { max: Number(maxGuests) },
      access: {
        type: accessType as AccessType,
        requiresContribution: false,
      },
      isPrivate: true,
    }

    try {
      const result = await createMutation.mutateAsync(input)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      router.replace(`/(app)/(host)/dashboard/${result.data.publicId}` as never)
    } catch (error: unknown) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      const message = error instanceof Error ? error.message : 'Erreur lors de la création'
      Alert.alert('Erreur', message)
    }
  }

  // ─── Step indicator ─────────────────────────────────────

  const renderStepIndicator = (): React.JSX.Element => (
    <View style={styles.stepIndicator}>
      {[1, 2, 3].map((s) => (
        <View
          key={s}
          style={[
            styles.stepDot,
            s === step && styles.stepDotActive,
            s < step && styles.stepDotCompleted,
          ]}
        />
      ))}
    </View>
  )

  // ─── Render input helper ────────────────────────────────

  const renderInput = (
    label: string,
    value: string,
    onChangeText: (v: string) => void,
    fieldName: string,
    options?: {
      placeholder?: string
      multiline?: boolean
      keyboardType?: 'default' | 'numeric'
      maxLength?: number
    },
  ): React.JSX.Element => (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          options?.multiline && styles.inputMultiline,
          errors[fieldName] ? styles.inputError : undefined,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={options?.placeholder ?? label}
        placeholderTextColor={COLORS.textMuted}
        multiline={options?.multiline}
        keyboardType={options?.keyboardType ?? 'default'}
        maxLength={options?.maxLength}
      />
      {errors[fieldName] && <Text style={styles.errorText}>{errors[fieldName]}</Text>}
    </View>
  )

  // ─── Step 1: Infos de base ─────────────────────────────

  const renderStep1 = (): React.JSX.Element => (
    <Animated.View key="step1" entering={SlideInRight.springify()} exiting={SlideOutLeft.springify()}>
      <Text style={styles.stepTitle}>Informations</Text>
      <Text style={styles.stepSubtitle}>Décrivez votre événement</Text>

      {renderInput('Titre', title, setTitle, 'title', { maxLength: 100 })}
      {renderInput('Description', description, setDescription, 'description', {
        multiline: true,
        maxLength: 2000,
      })}
      {renderInput('Thème', themeName, setThemeName, 'themeName', {
        placeholder: 'Ex: Soirée Gatsby, Cocktail, Brunch...',
      })}
      {renderInput('Dresscode', dresscode, setDresscode, 'dresscode', {
        placeholder: 'Ex: Chic, Casual élégant, Noir & Or...',
      })}
    </Animated.View>
  )

  // ─── Step 2: Lieu & Capacité ───────────────────────────

  const maxGuestsNum = Number(maxGuests) || 0
  const showSamWarning = maxGuestsNum > SAM_THRESHOLD

  const renderStep2 = (): React.JSX.Element => (
    <Animated.View key="step2" entering={SlideInRight.springify()} exiting={SlideOutLeft.springify()}>
      <Text style={styles.stepTitle}>Lieu & Capacité</Text>
      <Text style={styles.stepSubtitle}>Où et combien ?</Text>

      {renderInput('Ville', city, setCity, 'city')}
      {renderInput('Adresse (optionnel)', address, setAddress, 'address', {
        placeholder: 'Révélée 24h avant l\'événement',
      })}
      {renderInput('Nombre max d\'invités', maxGuests, setMaxGuests, 'maxGuests', {
        keyboardType: 'numeric',
        placeholder: '2 - 500',
      })}

      {/* RB-005: SAM warning when > 20 */}
      {showSamWarning && (
        <Animated.View entering={FadeInDown.springify()} style={styles.samWarning}>
          <Ionicons name="shield-checkmark" size={20} color={COLORS.accentGold} />
          <Text style={styles.samWarningText}>
            Un accompagnateur SAM sera requis pour publier cet événement (plus de 20 invités).
          </Text>
        </Animated.View>
      )}
    </Animated.View>
  )

  // ─── Step 3: Date & Accès ──────────────────────────────

  const renderStep3 = (): React.JSX.Element => (
    <Animated.View key="step3" entering={SlideInRight.springify()} exiting={SlideOutLeft.springify()}>
      <Text style={styles.stepTitle}>Date & Accès</Text>
      <Text style={styles.stepSubtitle}>Quand et comment ?</Text>

      {renderInput('Date de début (ISO)', startDate, setStartDate, 'startDate', {
        placeholder: '2026-04-15T20:00:00.000Z',
      })}
      {renderInput('Date de fin (ISO)', endDate, setEndDate, 'endDate', {
        placeholder: '2026-04-16T02:00:00.000Z',
      })}
      {renderInput('Ouverture des portes (ISO)', doorsOpenAt, setDoorsOpenAt, 'doorsOpenAt', {
        placeholder: '2026-04-15T19:30:00.000Z',
      })}

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Type d&apos;accès</Text>
        <View style={styles.accessToggle}>
          <Pressable
            style={[
              styles.accessOption,
              accessType === 'invite-only' && styles.accessOptionActive,
            ]}
            onPress={() => setAccessType('invite-only')}
          >
            <Ionicons
              name="lock-closed"
              size={18}
              color={accessType === 'invite-only' ? COLORS.accent : COLORS.textMuted}
            />
            <Text
              style={[
                styles.accessOptionText,
                accessType === 'invite-only' && styles.accessOptionTextActive,
              ]}
            >
              Invitation
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.accessOption,
              accessType === 'application' && styles.accessOptionActive,
            ]}
            onPress={() => setAccessType('application')}
          >
            <Ionicons
              name="hand-right"
              size={18}
              color={accessType === 'application' ? COLORS.accent : COLORS.textMuted}
            />
            <Text
              style={[
                styles.accessOptionText,
                accessType === 'application' && styles.accessOptionTextActive,
              ]}
            >
              Candidature
            </Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  )

  // ─── Main render ────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleBack} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Créer un événement</Text>
          <Text style={styles.headerStep}>{step}/{TOTAL_STEPS}</Text>
        </View>

        {renderStepIndicator()}

        {/* Step content */}
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}

        {/* Navigation buttons */}
        <View style={styles.actions}>
          {step < TOTAL_STEPS ? (
            <Button variant="primary" size="lg" onPress={handleNext}>
              Suivant
            </Button>
          ) : (
            <Button
              variant="primary"
              size="lg"
              onPress={handleSubmit}
              loading={createMutation.isPending}
            >
              Créer l&apos;événement
            </Button>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: 60,
    paddingBottom: SPACING.xxl,
    gap: SPACING.md,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  headerTitle: {
    fontFamily: FONTS.heading,
    fontSize: 20,
    color: COLORS.text,
  },
  headerStep: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textMuted,
  },

  // Step indicator
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.border,
  },
  stepDotActive: {
    backgroundColor: COLORS.accent,
    width: 24,
  },
  stepDotCompleted: {
    backgroundColor: COLORS.accent,
  },

  // Step titles
  stepTitle: {
    fontFamily: FONTS.heading,
    fontSize: 28,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  stepSubtitle: {
    fontFamily: FONTS.accent,
    fontSize: 16,
    color: COLORS.textMuted,
    marginBottom: SPACING.lg,
    letterSpacing: 0.5,
  },

  // Fields
  fieldGroup: {
    marginBottom: SPACING.md,
  },
  label: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: SPACING.xs,
    fontWeight: '500',
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 16,
  },
  inputMultiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: COLORS.error,
  },
  errorText: {
    color: COLORS.error,
    fontFamily: FONTS.body,
    fontSize: 12,
    marginTop: SPACING.xs,
    marginLeft: SPACING.xs,
  },

  // SAM Warning (RB-005)
  samWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: 'rgba(201,168,76,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.3)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.xs,
  },
  samWarningText: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.accentGold,
    lineHeight: 18,
  },

  // Access type toggle
  accessToggle: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  accessOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surface,
  },
  accessOptionActive: {
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(139,92,246,0.1)',
  },
  accessOptionText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  accessOptionTextActive: {
    color: COLORS.accent,
  },

  // Actions
  actions: {
    marginTop: SPACING.lg,
    gap: SPACING.sm,
  },
})
