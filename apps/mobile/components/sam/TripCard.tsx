import { View, Text, StyleSheet, Pressable } from 'react-native'
import Animated, { withRepeat, withTiming, useSharedValue, useAnimatedStyle } from 'react-native-reanimated'
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../../constants/theme'
import type { SamTrip } from '../../services/sam.service'

interface TripCardProps {
  trip: SamTrip
  index: number
  onConfirmArrival?: () => void
}

function useBorderPulse(enabled: boolean) {
  const value = useSharedValue(0.4)
  const style = useAnimatedStyle(() => ({
    opacity: value.value,
  }))

  if (enabled) {
    value.value = withRepeat(withTiming(1, { duration: 800 }), -1, true)
  }

  return enabled ? style : undefined
}

export function TripCard({ trip, index, onConfirmArrival }: TripCardProps): React.JSX.Element {
  const isInProgress = trip.status === 'in-progress'
  const borderColor = isInProgress ? '#F59E0B' : '#10B981'
  const pulseStyle = useBorderPulse(isInProgress)

  const departureTime =
    trip.departureTime != null
      ? new Date(trip.departureTime).toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : ''

  return (
    <Animated.View style={[styles.card, { borderColor }]}>
      {pulseStyle && <Animated.View style={[styles.pulseOverlay, pulseStyle]} />}
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Trajet #{index + 1}</Text>
          <Text style={[styles.status, isInProgress ? styles.statusInProgress : styles.statusCompleted]}>
            {isInProgress ? 'En cours' : 'Terminé'}
          </Text>
        </View>
        <Text style={styles.guest}>{trip.guestName}</Text>
        <Text style={styles.destination}>{trip.destination}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>Départ {departureTime}</Text>
        </View>
        {isInProgress && onConfirmArrival && (
          <Pressable style={styles.confirmButton} onPress={onConfirmArrival}>
            <Text style={styles.confirmText}>Confirmer arrivée</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 2,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.surface,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  pulseOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  content: {
    padding: SPACING.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  title: {
    fontFamily: FONTS.heading,
    fontSize: 16,
    color: COLORS.text,
  },
  status: {
    fontFamily: FONTS.body,
    fontSize: 12,
  },
  statusInProgress: {
    color: '#F59E0B',
  },
  statusCompleted: {
    color: '#10B981',
  },
  guest: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 2,
  },
  destination: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: SPACING.xs,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  meta: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  confirmButton: {
    marginTop: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
  },
  confirmText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
})

