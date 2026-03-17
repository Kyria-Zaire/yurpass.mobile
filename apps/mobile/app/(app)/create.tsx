import { useEffect } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, FONTS, SPACING } from '../../constants/theme'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../stores/auth.store'

export default function CreateScreen(): React.JSX.Element {
  const router = useRouter()
  const { isHost } = useAuth()

  // Auto-redirect host to creation wizard
  useEffect(() => {
    if (isHost) {
      router.push('/(app)/(host)/create-event' as never)
    }
  }, [isHost, router])

  if (isHost) {
    return <View style={styles.container} />
  }

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeInDown.springify()} style={styles.content}>
        <Ionicons name="sparkles-outline" size={64} color={COLORS.accentGold} />
        <Text style={styles.title}>Organisez vos événements</Text>
        <Text style={styles.subtitle}>
          Devenez host pour créer et gérer vos événements exclusifs sur Yurpass.
        </Text>
        <Button
          variant="primary"
          size="lg"
          onPress={() => router.push('/(app)/profile' as never)}
        >
          Devenir Host
        </Button>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  content: {
    alignItems: 'center',
    gap: SPACING.md,
  },
  title: {
    fontFamily: FONTS.heading,
    fontSize: 28,
    color: COLORS.text,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 16,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: SPACING.md,
  },
})
