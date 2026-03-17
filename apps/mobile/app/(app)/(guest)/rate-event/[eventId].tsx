import { useState, useMemo } from 'react'
import { View, Text, StyleSheet, TextInput, ScrollView, Pressable } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../../../../constants/theme'
import { useEvent } from '../../../../hooks/useEventQueries'
import { useSubmitRatingMutation } from '../../../../hooks/useRatingQueries'
import { RatingRole } from '@yurpass/types'
import { StarRating } from '../../../../components/ui/StarRating'
import { Button } from '../../../../components/ui/Button'

const MAX_COMMENT_LENGTH = 300

export default function RateEventScreen(): React.JSX.Element {
  const { eventId } = useLocalSearchParams<{ eventId: string }>()
  const router = useRouter()

  const [hostRating, setHostRating] = useState(0)
  const [eventRating, setEventRating] = useState(0)
  const [comment, setComment] = useState('')
  const [showConfirmation, setShowConfirmation] = useState(false)

  const { data: event, isLoading, error } = useEvent(eventId ?? '')
  const submitRatingMutation = useSubmitRatingMutation()

  const { isRatingAvailable, ratingAvailableAt } = useMemo(() => {
    if (!event?.schedule?.endDate) {
      return { isRatingAvailable: false, ratingAvailableAt: undefined as Date | undefined }
    }

    const endDate = new Date(event.schedule.endDate)
    const availableAt = new Date(endDate.getTime() + 24 * 60 * 60 * 1000)
    const now = new Date()

    return {
      isRatingAvailable: now >= availableAt,
      ratingAvailableAt: availableAt,
    }
  }, [event])

  const handleSubmit = async (): Promise<void> => {
    if (!eventId || !event || !isRatingAvailable) return
    if (hostRating < 1 || eventRating < 1) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      return
    }

    try {
      await submitRatingMutation.mutateAsync({
        toUserId: event.hostId,
        eventId,
        role: RatingRole.AS_GUEST,
        score: hostRating,
        comment: comment.trim() ? comment.trim() : undefined,
      })

      // Optionally we could also send an event-level rating if backend supports it.

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setShowConfirmation(true)

      setTimeout(() => {
        setShowConfirmation(false)
        router.replace('/(app)')
      }, 900)
    } catch (e) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    }
  }

  const remainingChars = MAX_COMMENT_LENGTH - comment.length

  if (!eventId || isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    )
  }

  if (error || !event) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>
          {error instanceof Error ? error.message : 'Événement introuvable'}
        </Text>
        <Button variant="ghost" size="md" onPress={() => router.back()}>
          Retour
        </Button>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Noter la soirée
        </Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.springify()}>
          <BlurView intensity={40} tint="dark" style={styles.card}>
          <Text style={styles.title}>
            Comment était {event.title} ?
          </Text>

          {!isRatingAvailable && ratingAvailableAt && (
            <View style={styles.infoBanner}>
              <Ionicons name="time-outline" size={18} color={COLORS.accentGold} />
              <Text style={styles.infoText}>
                La notation sera disponible à partir du lendemain de la soirée.
              </Text>
            </View>
          )}

          {/* Section hôte */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Votre hôte</Text>
            <View style={styles.hostRow}>
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={24} color={COLORS.accentGold} />
              </View>
              <View style={styles.hostInfo}>
                <Text style={styles.hostName} numberOfLines={1}>
                  Votre hôte
                </Text>
                <Text style={styles.hostHint}>
                  Notez votre hôte
                </Text>
              </View>
            </View>

            <View style={styles.ratingRow}>
              <StarRating
                value={hostRating}
                onChange={setHostRating}
                size={28}
                readonly={!isRatingAvailable}
              />
            </View>

            <View style={styles.commentBlock}>
              <Text style={styles.commentLabel}>Votre commentaire (optionnel)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Racontez en quelques mots votre expérience..."
                placeholderTextColor={COLORS.textMuted}
                multiline
                maxLength={MAX_COMMENT_LENGTH}
                editable={isRatingAvailable}
                onChangeText={setComment}
                value={comment}
              />
              <Text style={styles.counterText}>
                {remainingChars} caractères restants
              </Text>
            </View>
          </View>

          {/* Section événement */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>L&apos;événement</Text>
            <Text style={styles.sectionHint}>
              Ambiance, lieu, organisation
            </Text>
            <View style={styles.ratingRow}>
              <StarRating
                value={eventRating}
                onChange={setEventRating}
                size={28}
                readonly={!isRatingAvailable}
              />
            </View>
          </View>

          <View style={styles.footer}>
            <Button
              variant="primary"
              size="lg"
              onPress={handleSubmit}
              disabled={!isRatingAvailable || submitRatingMutation.isPending}
              loading={submitRatingMutation.isPending}
            >
              Envoyer ma notation
            </Button>
          </BlurView>
        </Animated.View>
      </ScrollView>

      {showConfirmation && (
        <Animated.View
          entering={ZoomIn.springify()}
          style={styles.confirmationOverlay}
        >
          <View style={styles.confirmationCard}>
            <Ionicons
              name="checkmark-circle"
              size={48}
              color={COLORS.accentGold}
            />
            <Text style={styles.confirmationText}>
              Merci pour votre notation
            </Text>
          </View>
        </Animated.View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  loadingText: {
    fontFamily: FONTS.body,
    fontSize: 16,
    color: COLORS.textMuted,
  },
  errorText: {
    fontFamily: FONTS.body,
    fontSize: 16,
    color: COLORS.error,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontFamily: FONTS.heading,
    fontSize: 18,
    color: COLORS.text,
    flex: 1,
    textAlign: 'center',
  },
  headerPlaceholder: {
    width: 24,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: {
    fontFamily: FONTS.heading,
    fontSize: 22,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  infoBanner: {
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.lg,
  },
  infoText: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  section: {
    marginTop: SPACING.lg,
  },
  sectionLabel: {
    fontFamily: FONTS.heading,
    fontSize: 18,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  sectionHint: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: SPACING.sm,
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.accentGold,
  },
  hostInfo: {
    flex: 1,
  },
  hostName: {
    fontFamily: FONTS.body,
    fontSize: 16,
    color: COLORS.text,
  },
  hostHint: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  ratingRow: {
    marginTop: SPACING.sm,
  },
  commentBlock: {
    marginTop: SPACING.md,
  },
  commentLabel: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  textInput: {
    minHeight: 96,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: COLORS.surfaceElevated,
    textAlignVertical: 'top',
  },
  counterText: {
    marginTop: SPACING.xs,
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'right',
  },
  footer: {
    marginTop: SPACING.xl,
  },
  confirmationOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  confirmationCard: {
    backgroundColor: COLORS.surfaceElevated,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.accentGold,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  confirmationText: {
    fontFamily: FONTS.accent,
    fontSize: 18,
    color: COLORS.accentGold,
  },
})

