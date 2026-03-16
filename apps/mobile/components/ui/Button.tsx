import { Pressable, Text, ActivityIndicator, StyleSheet, type ViewStyle, type TextStyle } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { COLORS, FONTS, BORDER_RADIUS } from '../../constants/theme'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps {
  children: string
  variant?: ButtonVariant
  size?: ButtonSize
  onPress?: () => void
  disabled?: boolean
  loading?: boolean
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

const SIZE_STYLES: Record<ButtonSize, { container: ViewStyle; text: TextStyle }> = {
  sm: {
    container: { paddingVertical: 8, paddingHorizontal: 16 },
    text: { fontSize: 14 },
  },
  md: {
    container: { paddingVertical: 12, paddingHorizontal: 24 },
    text: { fontSize: 16 },
  },
  lg: {
    container: { paddingVertical: 16, paddingHorizontal: 32 },
    text: { fontSize: 18 },
  },
}

const VARIANT_STYLES: Record<ButtonVariant, { container: ViewStyle; text: TextStyle }> = {
  primary: {
    container: { backgroundColor: COLORS.accent },
    text: { color: '#FFFFFF' },
  },
  secondary: {
    container: { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.accent },
    text: { color: COLORS.accent },
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    text: { color: COLORS.text },
  },
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  onPress,
  disabled = false,
  loading = false,
}: ButtonProps): React.JSX.Element {
  const scale = useSharedValue(1)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const handlePressIn = (): void => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 300 })
  }

  const handlePressOut = (): void => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 })
  }

  const handlePress = (): void => {
    if (disabled || loading) return
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onPress?.()
  }

  const variantStyle = VARIANT_STYLES[variant]
  const sizeStyle = SIZE_STYLES[size]

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      style={[
        styles.base,
        variantStyle.container,
        sizeStyle.container,
        disabled && styles.disabled,
        animatedStyle,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? '#FFFFFF' : COLORS.accent}
          size="small"
        />
      ) : (
        <Text style={[styles.text, variantStyle.text, sizeStyle.text]}>
          {children}
        </Text>
      )}
    </AnimatedPressable>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  text: {
    fontFamily: FONTS.body,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  disabled: {
    opacity: 0.5,
  },
})
