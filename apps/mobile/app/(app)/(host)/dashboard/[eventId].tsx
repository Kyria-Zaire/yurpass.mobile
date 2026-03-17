import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOWS } from '../../../../constants/theme'
import { Button } from '../../../../components/ui/Button'
import {
  useEvent,
  useGuests,
  usePublishEventMutation,
  useCancelEventMutation,
  useApproveGuestMutation,
  useRejectGuestMutation,
} from '../../../../hooks/useEventQueries'
import type { GuestListItem } from '@yurpass/types'

type StatusFilter = 'all' | 'pending' | 'approved' | 'attended'

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'pending', label: 'En attente' },
  { key: 'approved', label: 'Approuvés' },
  { key: 'attended', label: 'Présents' },
]

export default function DashboardScreen(): React.JSX.Element {
  const { eventId } = useLocalSearchParams<{ eventId: string }>()
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  // ─── Data fetching ──────────────────────────────────────

  const { data: event, isLoading: eventLoading, refetch: refetchEvent } = useEvent(eventId)
  const guestStatus = statusFilter === 'all' ? undefined : statusFilter
  const { data: guestsData, isLoading: guestsLoading, refetch: refetchGuests } = useGuests(eventId, guestStatus)

  const publishMutation = usePublishEventMutation()
  const cancelMutation = useCancelEventMutation()
  const approveMutation = useApproveGuestMutation(eventId)
  const rejectMutation = useRejectGuestMutation(eventId)

  // ─── Socket.io live updates ─────────────────────────────

  useEffect(() => {
    // Socket.io connection for real-time updates
    // Will be fully implemented when Socket.io backend is ready (YP-024)
    // For now, we rely on TanStack Query refetch + pull-to-refresh

    const interval = setInterval(() => {
      void refetchEvent()
      void refetchGuests()
    }, 30000) // Poll every 30s as fallback

    return () => clearInterval(interval)
  }, [refetchEvent, refetchGuests])

  // ─── Actions ────────────────────────────────────────────

  const handlePublish = useCallback((): void => {
    Alert.alert(
      'Publier l\'événement ?',
      'L\'événement sera visible par les invités.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Publier',
          onPress: async () => {
            try {
              await publishMutation.mutateAsync(eventId)
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            } catch (error: unknown) {
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
              const message = error instanceof Error ? error.message : 'Erreur'
              Alert.alert('Erreur', message)
            }
          },
        },
      ],
    )
  }, [eventId, publishMutation])

  const handleCancel = useCallback((): void => {
    Alert.alert(
      'Annuler l\'événement ?',
      'Cette action est irréversible.',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Annuler l\'événement',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelMutation.mutateAsync(eventId)
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            } catch (error: unknown) {
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
              const message = error instanceof Error ? error.message : 'Erreur'
              Alert.alert('Erreur', message)
            }
          },
        },
      ],
    )
  }, [eventId, cancelMutation])

  const handleApprove = useCallback(
    async (participationId: string): Promise<void> => {
      try {
        const result = await approveMutation.mutateAsync({ participationId })
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        Alert.alert(
          'Invité approuvé',
          `Code d'accès : ${result.data.accessCode}\n\nCe code ne sera plus affiché.`,
        )
      } catch (error: unknown) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        const message = error instanceof Error ? error.message : 'Erreur'
        Alert.alert('Erreur', message)
      }
    },
    [approveMutation],
  )

  const handleReject = useCallback(
    (participationId: string): void => {
      Alert.alert('Rejeter cet invité ?', '', [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Rejeter',
          style: 'destructive',
          onPress: async () => {
            try {
              await rejectMutation.mutateAsync(participationId)
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            } catch (error: unknown) {
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
              const message = error instanceof Error ? error.message : 'Erreur'
              Alert.alert('Erreur', message)
            }
          },
        },
      ])
    },
    [rejectMutation],
  )

  const handleOpenScanner = (): void => {
    router.push(`/(app)/(host)/scanner/${eventId}` as never)
  }

  // ─── Stats cards ────────────────────────────────────────

  const renderStats = (): React.JSX.Element | null => {
    if (!event) return null

    const stats = [
      {
        label: 'Confirmés',
        value: event.stats.totalParticipants,
        icon: 'people' as const,
        color: COLORS.accent,
      },
      {
        label: 'En attente',
        value: event.stats.pendingApprovals,
        icon: 'hourglass' as const,
        color: COLORS.accentGold,
      },
      {
        label: 'Présents',
        value: event.stats.checkedIn,
        icon: 'checkmark-circle' as const,
        color: COLORS.success,
      },
    ]

    return (
      <View style={styles.statsRow}>
        {stats.map((stat, i) => (
          <Animated.View
            key={stat.label}
            entering={FadeInUp.springify().delay(i * 100)}
            style={styles.statCard}
          >
            <Ionicons name={stat.icon} size={22} color={stat.color} />
            <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </Animated.View>
        ))}
      </View>
    )
  }

  // ─── Guest row ──────────────────────────────────────────

  const renderGuestItem = ({ item, index }: { item: GuestListItem; index: number }): React.JSX.Element => {
    const isPending = item.status === 'pending'
    const statusColor =
      item.status === 'attended'
        ? COLORS.success
        : item.status === 'approved'
          ? COLORS.accent
          : item.status === 'rejected'
            ? COLORS.error
            : COLORS.accentGold

    return (
      <Animated.View
        entering={FadeInDown.springify().delay(index * 50)}
        style={styles.guestRow}
      >
        <View style={styles.guestInfo}>
          <View style={[styles.guestAvatar, { borderColor: statusColor }]}>
            <Text style={styles.guestInitial}>
              {item.displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.guestDetails}>
            <Text style={styles.guestName}>{item.displayName}</Text>
            <Text style={[styles.guestStatus, { color: statusColor }]}>
              {item.status === 'pending' && 'En attente'}
              {item.status === 'approved' && 'Approuvé'}
              {item.status === 'attended' && 'Présent'}
              {item.status === 'rejected' && 'Rejeté'}
              {item.status === 'waitlist' && 'Liste d\'attente'}
              {item.status === 'no-show' && 'Absent'}
            </Text>
          </View>
        </View>

        {isPending && (
          <View style={styles.guestActions}>
            <Pressable
              style={styles.approveBtn}
              onPress={() => void handleApprove(item.publicId)}
            >
              <Ionicons name="checkmark" size={20} color={COLORS.success} />
            </Pressable>
            <Pressable
              style={styles.rejectBtn}
              onPress={() => handleReject(item.publicId)}
            >
              <Ionicons name="close" size={20} color={COLORS.error} />
            </Pressable>
          </View>
        )}
      </Animated.View>
    )
  }

  // ─── Loading state ──────────────────────────────────────

  if (eventLoading || !event) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    )
  }

  // ─── Main render ────────────────────────────────────────

  const isPublished = event.status === 'published' || event.status === 'full' || event.status === 'ongoing'
  const isDraft = event.status === 'draft'
  const isCancelled = event.status === 'cancelled'
  const isCompleted = event.status === 'completed'

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{event.title}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(event.status) }]}>
            <Text style={styles.statusText}>{event.status.toUpperCase()}</Text>
          </View>
        </View>
        {isPublished && (
          <Pressable onPress={handleOpenScanner} style={styles.scannerButton}>
            <Ionicons name="qr-code" size={24} color={COLORS.accent} />
          </Pressable>
        )}
      </View>

      {/* Stats */}
      {renderStats()}

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((f) => (
          <Pressable
            key={f.key}
            style={[styles.filterTab, statusFilter === f.key && styles.filterTabActive]}
            onPress={() => setStatusFilter(f.key)}
          >
            <Text
              style={[
                styles.filterTabText,
                statusFilter === f.key && styles.filterTabTextActive,
              ]}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Guest list */}
      <FlatList
        data={guestsData?.guests ?? []}
        keyExtractor={(item) => item.publicId}
        renderItem={renderGuestItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={guestsLoading}
            onRefresh={() => {
              void refetchGuests()
              void refetchEvent()
            }}
            tintColor={COLORS.accent}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>Aucun invité</Text>
          </View>
        }
      />

      {/* Bottom actions */}
      {!isCancelled && !isCompleted && (
        <View style={styles.bottomActions}>
          {isDraft && (
            <Button
              variant="primary"
              size="lg"
              onPress={handlePublish}
              loading={publishMutation.isPending}
            >
              Publier l&apos;événement
            </Button>
          )}
          {isPublished && (
            <Button variant="primary" size="lg" onPress={handleOpenScanner}>
              Ouvrir le scanner
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onPress={handleCancel}
            loading={cancelMutation.isPending}
          >
            Annuler l&apos;événement
          </Button>
        </View>
      )}
    </View>
  )
}

// ─── Helpers ────────────────────────────────────────────

function getStatusColor(status: string): string {
  switch (status) {
    case 'draft': return COLORS.textMuted
    case 'published': return COLORS.accent
    case 'full': return COLORS.accentGold
    case 'ongoing': return COLORS.success
    case 'completed': return COLORS.textMuted
    case 'cancelled': return COLORS.error
    default: return COLORS.textMuted
  }
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontFamily: FONTS.body,
    fontSize: 16,
    color: COLORS.textMuted,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    gap: SPACING.md,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    gap: SPACING.xs,
  },
  headerTitle: {
    fontFamily: FONTS.heading,
    fontSize: 18,
    color: COLORS.text,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  statusText: {
    fontFamily: FONTS.body,
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 1,
  },
  scannerButton: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    gap: SPACING.xs,
    ...SHADOWS.sm,
  },
  statValue: {
    fontFamily: FONTS.heading,
    fontSize: 28,
  },
  statLabel: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500',
  },

  // Filters
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  filterTab: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surface,
  },
  filterTabActive: {
    backgroundColor: COLORS.accent,
  },
  filterTabText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },

  // Guest list
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 120,
  },
  guestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 0.5,
    borderColor: COLORS.border,
  },
  guestInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flex: 1,
  },
  guestAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestInitial: {
    fontFamily: FONTS.heading,
    fontSize: 16,
    color: COLORS.text,
  },
  guestDetails: {
    flex: 1,
    gap: 2,
  },
  guestName: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '500',
  },
  guestStatus: {
    fontFamily: FONTS.body,
    fontSize: 12,
  },
  guestActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  approveBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(16,185,129,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(239,68,68,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty state
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

  // Bottom actions
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
    backgroundColor: COLORS.bg,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
    gap: SPACING.sm,
  },
})
