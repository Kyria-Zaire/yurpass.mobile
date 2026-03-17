import { memo, useCallback } from 'react'
import { Pressable, StyleSheet } from 'react-native'
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SPACING } from '../../constants/theme'

export interface StarRatingProps {
  value: number
  onChange?: (value: number) => void
  size?: number
  readonly?: boolean
  allowHalf?: boolean
}

const STAR_COUNT = 5

function StarRatingBase({
  value,
  onChange,
  size = 24,
  readonly = false,
  allowHalf = false,
}: StarRatingProps): React.JSX.Element {
  const scale = useSharedValue(1)

  const handlePress = useCallback(
    (index: number) => {
      if (readonly || !onChange) return
      const newValue = index + 1
      onChange(newValue)
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      scale.value = 1.1
      scale.value = withSpring(1, { damping: 8, stiffness: 200 })
    },
    [onChange, readonly, scale],
  )

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const stars = []
  for (let i = 0; i < STAR_COUNT; i += 1) {
    const full = value >= i + 1
    const half = allowHalf && !full && value > i && value < i + 1
    const iconName = full ? 'star' : half ? 'star-half' : 'star-outline'
    const color = full || half ? COLORS.accentGold : COLORS.border

    const content = (
      <Animated.View key={i} style={[styles.starWrapper, animatedStyle]}>
        <Ionicons name={iconName as never} size={size} color={color} />
      </Animated.View>
    )

    if (readonly) {
      stars.push(content)
    } else {
      stars.push(
        <Pressable
          key={i}
          onPress={() => handlePress(i)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Note ${i + 1} sur 5`}
        >
          {content}
        </Pressable>,
      )
    }
  }

  return (
    <Animated.View
      entering={FadeInDown.springify()}
      style={styles.container}
      accessibilityRole="adjustable"
      accessibilityLabel={`Note ${value} sur 5`}
    >
      {stars}
    </Animated.View>
  )
}

export const StarRating = memo(StarRatingBase)

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  starWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
})

