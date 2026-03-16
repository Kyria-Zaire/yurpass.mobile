---
description: Yurpass — Règles Mobile React Native (Expo)
globs: ["apps/mobile/**/*.ts", "apps/mobile/**/*.tsx"]
alwaysApply: false
---

# 📱 YURPASS — RÈGLES MOBILE (EXPO + REACT NATIVE)

## STACK MOBILE
- Expo SDK 51+ avec Expo Router (file-based routing)
- NativeWind pour le styling (Tailwind syntax)
- React Native Reanimated 3 pour les animations
- Zustand pour le state global
- TanStack Query pour le data fetching
- React Hook Form + Zod pour les formulaires
- Expo SecureStore pour les tokens (JAMAIS AsyncStorage pour les secrets)

## STRUCTURE MOBILE
```
apps/mobile/
├── app/                    → Routes Expo Router
│   ├── (auth)/             → Écrans non authentifiés
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── _layout.tsx
│   ├── (app)/              → Écrans authentifiés
│   │   ├── (guest)/        → Écrans invités
│   │   ├── (host)/         → Écrans hôtes
│   │   ├── (sam)/          → Écrans SAM
│   │   └── _layout.tsx     → Protection auth
│   └── _layout.tsx
├── components/
│   ├── ui/                 → Composants design system
│   ├── forms/              → Composants formulaires
│   └── events/             → Composants événements
├── stores/                 → Zustand stores
├── hooks/                  → Custom hooks
├── services/               → Appels API
├── utils/                  → Utilitaires
└── constants/              → Tokens design, config
```

## DESIGN SYSTEM — NE JAMAIS DÉVIER
```typescript
// constants/theme.ts
export const COLORS = {
  bg: '#0A0A0A',
  surface: '#111111',
  surfaceElevated: '#1A1A1A',
  accent: '#8B5CF6',        // Violet premium
  accentGold: '#C9A84C',    // Or discret
  text: '#F5F5F5',
  textMuted: '#6B6B6B',
  border: '#2A2A2A',
  error: '#EF4444',
  success: '#10B981',
} as const

export const FONTS = {
  heading: 'PlayfairDisplay',     // Prestige
  body: 'Inter',                   // Lisibilité
  accent: 'CormorantGaramond',    // Élégance
} as const
```

## PATTERN COMPOSANT OBLIGATOIRE
```tsx
// ✅ Structure attendue
import { View, Text } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import type { EventCardProps } from '@yurpass/types'

export function EventCard({ event, onPress }: EventCardProps) {
  // 1. Hooks en premier
  // 2. Handlers ensuite
  // 3. Rendu en dernier

  return (
    <Animated.View
      entering={FadeInDown.springify()}
      className="bg-[#111111] rounded-2xl border border-[#2A2A2A] overflow-hidden"
    >
      {/* Contenu */}
    </Animated.View>
  )
}

// ✅ Export nommé — pas de default export pour les composants
```

## ZUSTAND — RÈGLES STORES
```typescript
// ✅ Store typé et structuré
interface AuthStore {
  user: User | null
  isLoading: boolean
  // Actions séparées des données
  setUser: (user: User | null) => void
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isLoading: false,
  setUser: (user) => set({ user }),
  logout: async () => {
    await SecureStore.deleteItemAsync('accessToken')
    set({ user: null })
  },
}))

// ❌ INTERDIT: mutation directe
// store.user = newUser
```

## TANSTACK QUERY — RÈGLES
```typescript
// ✅ Query keys typés et centralisés
export const queryKeys = {
  events: {
    all: ['events'] as const,
    byId: (id: string) => ['events', id] as const,
    upcoming: ['events', 'upcoming'] as const,
  },
  user: {
    profile: ['user', 'profile'] as const,
  },
} as const

// ✅ Custom hook par feature
export function useUpcomingEvents() {
  return useQuery({
    queryKey: queryKeys.events.upcoming,
    queryFn: EventService.getUpcoming,
    staleTime: 1000 * 60 * 5, // 5min cache
  })
}
```

## SÉCURITÉ MOBILE
- **Expo SecureStore** pour access token + refresh token — jamais AsyncStorage
- **Certificate pinning** en production pour les appels API
- **Biométrie** optionnelle pour accès app (Face ID / empreinte)
- **Jailbreak detection** via expo-device
- **Screenshot prevention** sur les écrans sensibles (code d'accès)
- **Auto-logout** après 30 min d'inactivité

## RÈGLES UI/UX LUXE
- Animations **obligatoires** sur les transitions d'écran (Reanimated)
- Glassmorphism sur les cards événements (expo-blur)
- Haptic feedback sur les actions importantes
- Loading states élégants — jamais de spinner basique
- Skeleton screens plutôt que loaders
- Micro-animations sur les interactions (boutons, swipe)

## GESTION D'ERREURS MOBILE
```typescript
// ✅ Error boundary sur chaque screen
// ✅ Toast notifications pour les erreurs (pas d'alert natif)
// ✅ Retry automatique sur les erreurs réseau (TanStack Query)
// ✅ Offline state géré gracieusement
```

## PERFORMANCE
- Images optimisées via Cloudinary transforms
- Lazy loading des écrans (Expo Router automatique)
- Memo uniquement si profiling le justifie (pas de sur-optimisation)
- FlatList pour toutes les listes (jamais ScrollView + map)
- `useCallback` sur les handlers passés aux listes
