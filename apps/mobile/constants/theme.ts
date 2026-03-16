export const COLORS = {
  bg: '#0A0A0A',
  surface: '#111111',
  surfaceElevated: '#1A1A1A',
  accent: '#8B5CF6',
  accentGold: '#C9A84C',
  text: '#F5F5F5',
  textMuted: '#6B6B6B',
  border: '#2A2A2A',
  error: '#EF4444',
  success: '#10B981',
} as const

export const FONTS = {
  heading: 'PlayfairDisplay',
  body: 'Inter',
  accent: 'CormorantGaramond',
} as const

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const

export const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  lg: {
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
} as const
