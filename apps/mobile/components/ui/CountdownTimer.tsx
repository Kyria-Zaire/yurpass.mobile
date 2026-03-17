import { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated'
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../../constants/theme'

const FLIP_DURATION = 300

interface FlipDigitProps {
  value: number
  label: string
}

function FlipDigit({ value, label }: FlipDigitProps): React.JSX.Element {
  const [displayValue, setDisplayValue] = useState(value)
  const rotation = useSharedValue(0)

  useEffect(() => {
    if (value === displayValue) return
    rotation.value = withTiming(
      -90,
      { duration: FLIP_DURATION / 2 },
      (finished) => {
        if (finished) {
          runOnJS(setDisplayValue)(value)
          rotation.value = withTiming(0, { duration: FLIP_DURATION / 2 })
        }
      },
    )
  }, [value, displayValue, rotation])

  const frontStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 500 },
      { rotateX: `${rotation.value}deg` },
    ],
  }))

  const backStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 500 },
      { rotateX: `${rotation.value + 90}deg` },
    ],
  }))

  return (
    <View style={styles.unit}>
      <View style={styles.digitContainer}>
        <View style={styles.digitWrapper}>
          <Animated.View style={[styles.digitFace, frontStyle]} pointerEvents="none">
            <Text style={styles.digitText}>{String(displayValue).padStart(2, '0')}</Text>
          </Animated.View>
          <Animated.View
            style={[styles.digitFace, styles.digitFaceBack, backStyle]}
            pointerEvents="none"
          >
            <Text style={styles.digitText}>{String(value).padStart(2, '0')}</Text>
          </Animated.View>
        </View>
      </View>
      <Text style={styles.unitLabel}>{label}</Text>
    </View>
  )
}

export interface CountdownTimerProps {
  /** Target date — countdown runs until this time */
  targetDate: Date
  /** Optional label above the timer */
  label?: string
  /** Callback when countdown reaches zero */
  onReachZero?: () => void
}

export function CountdownTimer({
  targetDate,
  label,
  onReachZero,
}: CountdownTimerProps): React.JSX.Element | null {
  const [diff, setDiff] = useState(() => getTimeDiff(targetDate))

  useEffect(() => {
    const interval = setInterval(() => {
      const d = getTimeDiff(targetDate)
      setDiff(d)
      if (d.totalMs <= 0 && onReachZero) {
        onReachZero()
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [targetDate, onReachZero])

  if (diff.totalMs <= 0) {
    return null
  }

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row}>
        <FlipDigit value={diff.days} label="j" />
        <FlipDigit value={diff.hours} label="h" />
        <FlipDigit value={diff.minutes} label="m" />
        <FlipDigit value={diff.seconds} label="s" />
      </View>
    </View>
  )
}

function getTimeDiff(target: Date): {
  days: number
  hours: number
  minutes: number
  seconds: number
  totalMs: number
} {
  const now = Date.now()
  const totalMs = target.getTime() - now
  if (totalMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0 }
  }
  const s = Math.floor((totalMs / 1000) % 60)
  const m = Math.floor((totalMs / (1000 * 60)) % 60)
  const h = Math.floor((totalMs / (1000 * 60 * 60)) % 24)
  const d = Math.floor(totalMs / (1000 * 60 * 60 * 24))
  return { days: d, hours: h, minutes: m, seconds: s, totalMs }
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  label: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: SPACING.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACING.sm,
  },
  unit: {
    alignItems: 'center',
    minWidth: 44,
  },
  digitContainer: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  digitFace: {
    position: 'absolute',
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    minWidth: 40,
    alignItems: 'center',
    backfaceVisibility: 'hidden',
  },
  digitFaceBack: {},
  digitWrapper: {
    width: 40,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digitText: {
    fontFamily: FONTS.heading,
    fontSize: 24,
    color: COLORS.accentGold,
    fontWeight: '600',
  },
  unitLabel: {
    fontFamily: FONTS.body,
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 4,
  },
})
