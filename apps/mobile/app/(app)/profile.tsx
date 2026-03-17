import { View, Text, StyleSheet, Pressable, ScrollView, Image } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { BlurView } from 'expo-blur'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../../constants/theme'
import { useAuth } from '../../stores/auth.store'
import { useUserReputation, useUserRatings } from '../../hooks/useRatingQueries'
import { StarRating } from '../../components/ui/StarRating'
import { Button } from '../../components/ui/Button'

export default function ProfileScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ userId?: string }>()
  const router = useRouter()
  const { user, isHost } = useAuth()

  const viewedUserId = params.userId ?? user?.publicId ?? ''
  const isMe = !params.userId || params.userId === user?.publicId

  const { data: reputation } = useUserReputation(viewedUserId)
  const { data: ratings } = useUserRatings(viewedUserId)

  const displayName = user?.profile.displayName ?? 'Invité Yurpass'
  const city = user?.profile.city ?? ''
  const avatarUrl = user?.profile.avatarUrl

  const handleInvite = (): void => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    // Navigation vers flow d'invitation d'événement (sera branché sur YP dédié)
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Profil
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
          <View style={styles.avatarRow}>
            <View style={styles.avatarWrapper}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitial}>
                    {displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.identity}>
              <Text style={styles.name}>{displayName}</Text>
              {city ? <Text style={styles.city}>{city}</Text> : null}
              <View style={styles.rolesRow}>
                {isHost && (
                  <View style={styles.roleBadge}>
                    <Text style={styles.roleText}>HOST</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          <View style={styles.reputationBlock}>
            <View style={styles.reputationHeader}>
              <Text style={styles.reputationLabel}>Réputation</Text>
              {reputation && (
                <Text style={styles.reputationScore}>
                  {reputation.avgRating.toFixed(1)} · {reputation.totalRatings} notations
                </Text>
              )}
            </View>
            <StarRating
              value={reputation?.avgRating ?? 0}
              size={22}
              readonly
              allowHalf
            />
          </View>

          {ratings && ratings.ratings.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Dernières notations</Text>
              {ratings.ratings.slice(0, 5).map((rating) => (
                <View key={rating.publicId} style={styles.ratingRowItem}>
                  <View style={styles.ratingHeader}>
                    <StarRating value={rating.score} size={16} readonly allowHalf />
                    <Text style={styles.ratingDate}>
                      {new Date(rating.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  {rating.comment ? (
                    <Text style={styles.ratingComment}>{rating.comment}</Text>
                  ) : null}
                  <Text style={styles.ratingAuthor}>Auteur anonyme</Text>
                </View>
              ))}
            </View>
          )}

          {!isMe && isHost && (
            <View style={styles.actions}>
              <Button variant="primary" size="lg" onPress={handleInvite}>
                Inviter à ma soirée
              </Button>
            </View>
          )}
        </BlurView>
        </Animated.View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
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
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.lg,
  },
  avatarWrapper: {
    width: 72,
    height: 72,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 2,
    borderColor: COLORS.accentGold,
    padding: 2,
    backgroundColor: COLORS.surfaceElevated,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: BORDER_RADIUS.full,
  },
  avatarFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surface,
  },
  avatarInitial: {
    fontFamily: FONTS.heading,
    fontSize: 28,
    color: COLORS.text,
  },
  identity: {
    flex: 1,
  },
  name: {
    fontFamily: FONTS.heading,
    fontSize: 22,
    color: COLORS.text,
  },
  city: {
    marginTop: 4,
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textMuted,
  },
  rolesRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  roleBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.accentGold,
  },
  roleText: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.accentGold,
    letterSpacing: 1,
  },
  reputationBlock: {
    marginTop: SPACING.lg,
  },
  reputationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  reputationLabel: {
    fontFamily: FONTS.heading,
    fontSize: 18,
    color: COLORS.text,
  },
  reputationScore: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  section: {
    marginTop: SPACING.lg,
  },
  sectionTitle: {
    fontFamily: FONTS.heading,
    fontSize: 18,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  ratingRowItem: {
    paddingVertical: SPACING.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    gap: SPACING.xs,
  },
  ratingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratingDate: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  ratingComment: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.text,
  },
  ratingAuthor: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  actions: {
    marginTop: SPACING.xl,
  },
})

