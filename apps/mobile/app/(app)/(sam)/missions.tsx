import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native'
import Animated, { FadeInDown, withRepeat, withTiming, useSharedValue, useAnimatedStyle } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../../../constants/theme'
import { useSamMissions } from '../../../hooks/useSamQueries'
import type { SamMission } from '../../../services/sam.service'

type GroupedMissions = {
  active: SamMission[]
  upcoming: SamMission[]
  past: SamMission[]
}

function groupMissions(missions: SamMission[]): GroupedMissions {
  const active: SamMission[] = []
  const upcoming: SamMission[] = []
  const past: SamMission[] = []

  missions.forEach((m) => {
    if (m.status === 'active' || m.status === 'confirmed') {
      active.push(m)
    } else if (m.status === 'assigned') {
      upcoming.push(m)
    } else {
      past.push(m)
    }
  })

  return { active, upcoming, past }
}

function usePulse(initial: number, to: number) {
  const value = useSharedValue(initial)
  const style = useAnimatedStyle(() => ({
    opacity: value.value,
  }))

  value.value = withRepeat(withTiming(to, { duration: 800 }), -1, true)
  return style
}

export default function SamMissionsScreen(): React.JSX.Element {
  const router = useRouter()
  const { data, isLoading, error, refetch } = useSamMissions()

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Chargement des missions...</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>
          {error instanceof Error ? error.message : 'Erreur de chargement'}
        </Text>
        <Pressable style={styles.retryButton} onPress={() => void refetch()}>
          <Text style={styles.retryText}>Réessayer</Text>
        </Pressable>
      </View>
    )
  }

  const missions = data?.missions ?? []
  const grouped = groupMissions(missions)

  const renderMissionCard = (mission: SamMission, index: number, group: 'active' | 'upcoming' | 'past'): React.JSX.Element => {
    const countdown =
      group === 'upcoming' && mission.startedAt
        ? Math.max(
            0,
            Math.floor(
              (new Date(mission.startedAt).getTime() - Date.now()) / 60000,
            ),
          )
        : null

    const hasConfirmCta = mission.status === 'assigned'

    const handlePress = (): void => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      router.push(`/(app)/(sam)/mission/${mission.publicId}` as never)
    }

    const borderColor =
      mission.status === 'active'
        ? '#F59E0B'
        : mission.status === 'completed'
          ? '#10B981'
          : COLORS.border

    const pulseStyle =
      mission.status === 'active' ? usePulse(0.4, 1) : undefined

    return (
      <Animated.View
        key={mission.publicId}
        entering={FadeInDown.springify().delay(index * 60)}
        style={[styles.missionCard, { borderColor }]}
      >
        {pulseStyle && <Animated.View style={[styles.pulseOverlay, pulseStyle]} />}
        <Pressable onPress={handlePress} style={styles.missionContent}>
          <View style={styles.missionHeader}>
            <Text style={styles.missionTitle} numberOfLines={1}>
              Mission SAM
            </Text>
            <Text style={styles.missionStatus}>{mission.status.toUpperCase()}</Text>
          </View>

          {countdown !== null && (
            <Text style={styles.countdownText}>
              Début dans ~{countdown} min
            </Text>
          )}

          {hasConfirmCta && (
            <View style={styles.confirmCta}>
              <Text style={styles.confirmText}>Confirmer ma disponibilité</Text>
            </View>
          )}
        </Pressable>
      </Animated.View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Missions SAM</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {grouped.active.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>En cours</Text>
            {grouped.active.map((m, index) => renderMissionCard(m, index, 'active'))}
          </View>
        )}

        {grouped.upcoming.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>À venir</Text>
            {grouped.upcoming.map((m, index) =>
              renderMissionCard(m, index, 'upcoming'),
            )}
          </View>
        )}

        {grouped.past.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Passées</Text>
            {grouped.past.map((m, index) => renderMissionCard(m, index, 'past'))}
          </View>
        )}

        {missions.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Aucune mission pour le moment</Text>
            <Text style={styles.emptyText}>
              Vous recevrez une notification lorsqu&apos;un hôte assignera une mission SAM.
            </Text>
          </View>
        )}
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
    paddingTop: 56,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  headerTitle: {
    fontFamily: FONTS.heading,
    fontSize: 24,
    color: COLORS.text,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
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
  missionCard: {
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 2,
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
  },
  pulseOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  missionContent: {
    padding: SPACING.md,
  },
  missionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  missionTitle: {
    fontFamily: FONTS.heading,
    fontSize: 18,
    color: COLORS.text,
  },
  missionStatus: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  countdownText: {
    marginTop: SPACING.sm,
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textMuted,
  },
  confirmCta: {
    marginTop: SPACING.md,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
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
    marginBottom: SPACING.md,
  },
  retryButton: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  retryText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.accent,
  },
  emptyState: {
    marginTop: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  emptyTitle: {
    fontFamily: FONTS.heading,
    fontSize: 18,
    color: COLORS.text,
  },
  emptyText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
})

