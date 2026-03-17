import { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { z } from 'zod'
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../../../../constants/theme'
import { useGuests } from '../../../../hooks/useEventQueries'
import { useSubmitRatingMutation } from '../../../../hooks/useRatingQueries'
import type { GuestListItem } from '@yurpass/types'
import { RatingRole } from '@yurpass/types'
import { StarRating } from '../../../../components/ui/StarRating'
import { Button } from '../../../../components/ui/Button'

const ratingSchema = z.object({
  score: z.number().min(1).max(5),
  note: z.string().max(300).optional(),
})

type RatingForm = z.infer<typeof ratingSchema>

type GuestRatingRow = GuestListItem & { rating: RatingForm }

export default function RateGuestsScreen(): React.JSX.Element {
  const { eventId } = useLocalSearchParams<{ eventId: string }>()
  const router = useRouter()

  const { data: guestsData, isLoading, error } = useGuests(eventId ?? '', 'attended')
  const submitRatingMutation = useSubmitRatingMutation()

  const [guestsWithRatings, setGuestsWithRatings] = useState<GuestRatingRow[]>([])

  useEffect(() => {
    if (!guestsData?.guests) return
    setGuestsWithRatings(
      guestsData.guests.map((guest) => ({
        ...guest,
        rating: { score: 0, note: undefined },
      })),
    )
  }, [guestsData])

  const handleChangeScore = (guestPublicId: string, score: number): void => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setGuestsWithRatings((prev) =>
      prev.map((g) =>
        g.publicId === guestPublicId ? { ...g, rating: { ...g.rating, score } } : g,
      ),
    )
  }

  const handleChangeNote = (guestPublicId: string, note: string): void => {
    setGuestsWithRatings((prev) =>
      prev.map((g) =>
        g.publicId === guestPublicId
          ? {
              ...g,
              rating: { ...g.rating, note: note.trim() ? note : undefined },
            }
          : g,
      ),
    )
  }

  const handleValidateAll = async (): Promise<void> => {
    if (!eventId) return

    const payloads = guestsWithRatings
      .filter((g) => g.rating.score > 0)
      .map((g) => ({
        toUserId: g.userId,
        eventId,
        role: RatingRole.AS_HOST,
        score: g.rating.score,
        comment: g.rating.note,
      }))

    try {
      for (const input of payloads) {
        ratingSchema.parse({ score: input.score, note: input.comment })
        // eslint-disable-next-line no-await-in-loop
        await submitRatingMutation.mutateAsync(input)
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      router.back()
    } catch (e) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    }
  }

  const renderGuestItem = ({ item, index }: { item: GuestRatingRow; index: number }): React.JSX.Element => {
    const remaining = 300 - (item.rating.note?.length ?? 0)

    return (
      <Animated.View entering={FadeInDown.springify().delay(index * 50)}>
        <BlurView intensity={30} tint="dark" style={styles.guestCard}>
          <View style={styles.guestHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>
              {item.displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.guestInfo}>
            <Text style={styles.guestName} numberOfLines={1}>
              {item.displayName}
            </Text>
            <Text style={styles.guestMeta}>Invité présent</Text>
          </View>
        </View>

          <View style={styles.ratingRow}>
            <StarRating
              value={item.rating.score}
              onChange={(value) => handleChangeScore(item.publicId, value)}
              size={24}
            />
          </View>

          <View style={styles.noteBlock}>
            <Text style={styles.noteLabel}>Note courte (optionnel)</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="Mentionnez un détail marquant, une attitude..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              maxLength={300}
              onChangeText={(text) => handleChangeNote(item.publicId, text)}
              value={item.rating.note ?? ''}
            />
            <Text style={styles.counterText}>{remaining} caractères restants</Text>
          </View>
        </BlurView>
      </Animated.View>
    )
  }

  if (!eventId || isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>
          {error instanceof Error ? error.message : 'Invités introuvables'}
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
          Noter les invités
        </Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <FlatList
        data={guestsWithRatings}
        keyExtractor={(item) => item.publicId}
        renderItem={renderGuestItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>Aucun invité présent</Text>
          </View>
        }
      />

      <View style={styles.bottomBar}>
        <Button
          variant="primary"
          size="lg"
          onPress={handleValidateAll}
          disabled={submitRatingMutation.isPending}
          loading={submitRatingMutation.isPending}
        >
          Valider toutes les notations
        </Button>
      </View>
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
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl + SPACING.lg,
  },
  guestCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  guestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.accentGold,
  },
  avatarInitial: {
    fontFamily: FONTS.heading,
    fontSize: 18,
    color: COLORS.text,
  },
  guestInfo: {
    flex: 1,
  },
  guestName: {
    fontFamily: FONTS.body,
    fontSize: 16,
    color: COLORS.text,
  },
  guestMeta: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  ratingRow: {
    marginTop: SPACING.sm,
  },
  noteBlock: {
    marginTop: SPACING.md,
  },
  noteLabel: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  noteInput: {
    minHeight: 64,
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
  emptyState: {
    alignItems: 'center',
    paddingTop: SPACING.xxl,
    gap: SPACING.md,
  },
  emptyText: {
    fontFamily: FONTS.body,
    fontSize: 16,
    color: COLORS.textMuted,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
    backgroundColor: COLORS.bg,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
  },
})

