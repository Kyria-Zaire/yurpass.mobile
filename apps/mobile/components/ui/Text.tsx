import { Text as RNText, StyleSheet, type TextProps as RNTextProps } from 'react-native'
import { COLORS, FONTS } from '../../constants/theme'

type TextVariant = 'h1' | 'h2' | 'h3' | 'body' | 'caption' | 'label'

interface TextProps extends RNTextProps {
  variant?: TextVariant
  color?: string
}

interface VariantConfig {
  fontSize: number
  fontFamily: string
  fontWeight: 'bold' | '600' | '500' | 'normal'
  letterSpacing: number
}

const VARIANT_CONFIG: Record<TextVariant, VariantConfig> = {
  h1: {
    fontSize: 32,
    fontFamily: FONTS.heading,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  h2: {
    fontSize: 24,
    fontFamily: FONTS.heading,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  h3: {
    fontSize: 20,
    fontFamily: FONTS.body,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  body: {
    fontSize: 16,
    fontFamily: FONTS.body,
    fontWeight: 'normal',
    letterSpacing: 0.2,
  },
  caption: {
    fontSize: 12,
    fontFamily: FONTS.body,
    fontWeight: 'normal',
    letterSpacing: 0.4,
  },
  label: {
    fontSize: 14,
    fontFamily: FONTS.body,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
}

export function YText({
  variant = 'body',
  color,
  style,
  children,
  ...props
}: TextProps): React.JSX.Element {
  const config = VARIANT_CONFIG[variant]

  return (
    <RNText
      style={[
        styles.base,
        {
          fontSize: config.fontSize,
          fontFamily: config.fontFamily,
          fontWeight: config.fontWeight,
          letterSpacing: config.letterSpacing,
          color: color ?? COLORS.text,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </RNText>
  )
}

const styles = StyleSheet.create({
  base: {
    color: COLORS.text,
  },
})
