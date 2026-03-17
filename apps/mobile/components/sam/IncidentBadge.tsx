import { View, Text, StyleSheet } from 'react-native'
import Animated, { withRepeat, withTiming, useSharedValue, useAnimatedStyle } from 'react-native-reanimated'
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../../constants/theme'
import type { SamIncident } from '../../services/sam.service'

interface IncidentBadgeProps {
  incident: SamIncident
}

export function IncidentBadge({ incident }: IncidentBadgeProps): React.JSX.Element {
  const isUrgent = incident.level === 'urgent'
  const bgColor =
    incident.level === 'info'
      ? COLORS.surfaceElevated
      : incident.level === 'warning'
        ? '#F59E0B33'
        : '#EF444433'
  const textColor =
    incident.level === 'info'
      ? COLORS.textMuted
      : incident.level === 'warning'
        ? '#F59E0B'
        : '#EF4444'

  const pulse = useSharedValue(1)
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }))

  if (isUrgent) {
    pulse.value = withRepeat(withTiming(0.3, { duration: 600 }), -1, true)
  }

  return (
    <Animated.View style={[styles.badge, { backgroundColor: bgColor, borderColor: textColor }, isUrgent && animatedStyle]}>
      <View style={[styles.dot, { backgroundColor: textColor }]} />
      <Text style={[styles.text, { color: textColor }]}>
        {incident.level === 'info'
          ? 'INFO'
          : incident.level === 'warning'
            ? 'AVERTISSEMENT'
            : 'INCIDENT URGENT'}
      </Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  text: {
    fontFamily: FONTS.body,
    fontSize: 11,
    letterSpacing: 0.8,
  },
})

