import { View, Text, StyleSheet } from 'react-native'
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated'
import { COLORS, FONTS } from '../../constants/theme'

interface PasswordStrengthProps {
  password: string
}

interface StrengthLevel {
  label: string
  color: string
  score: number
}

const LEVELS: StrengthLevel[] = [
  { label: 'Faible', color: COLORS.error, score: 1 },
  { label: 'Moyen', color: '#F59E0B', score: 2 },
  { label: 'Fort', color: COLORS.success, score: 3 },
  { label: 'Très fort', color: COLORS.accent, score: 4 },
]

function calculateStrength(password: string): number {
  let score = 0
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  return score
}

export function PasswordStrength({ password }: PasswordStrengthProps): React.JSX.Element | null {
  if (!password) return null

  const strength = calculateStrength(password)
  const level = LEVELS[Math.max(0, strength - 1)] ?? LEVELS[0]

  return (
    <View style={styles.container}>
      <View style={styles.bars}>
        {LEVELS.map((l, index) => (
          <StrengthBar
            key={l.label}
            active={index < strength}
            color={level?.color ?? COLORS.error}
          />
        ))}
      </View>
      <Text style={[styles.label, { color: level?.color }]}>{level?.label}</Text>
    </View>
  )
}

function StrengthBar({ active, color }: { active: boolean; color: string }): React.JSX.Element {
  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: withTiming(active ? color : COLORS.border, { duration: 300 }),
    transform: [{ scaleY: withTiming(active ? 1 : 0.6, { duration: 300 }) }],
  }))

  return <Animated.View style={[styles.bar, animatedStyle]} />
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  bars: {
    flexDirection: 'row',
    gap: 4,
    flex: 1,
  },
  bar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
  },
  label: {
    fontFamily: FONTS.body,
    fontSize: 12,
    fontWeight: '500',
  },
})
