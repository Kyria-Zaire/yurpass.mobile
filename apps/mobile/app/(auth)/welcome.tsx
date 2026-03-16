import { View, Text, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated'
import { BlurView } from 'expo-blur'
import { Button } from '../../components/ui/Button'
import { COLORS, FONTS } from '../../constants/theme'

export default function WelcomeScreen(): React.JSX.Element {
  const router = useRouter()

  return (
    <View style={styles.container}>
      <BlurView intensity={20} style={styles.blurOverlay} tint="dark" />

      <View style={styles.content}>
        <Animated.View entering={FadeInUp.springify().delay(200)}>
          <Text style={styles.logo}>YURPASS</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.springify().delay(400)}>
          <Text style={styles.tagline}>Sois libre. Sois léger. Sois select.</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.springify().delay(600)} style={styles.buttons}>
          <Button
            variant="primary"
            size="lg"
            onPress={() => router.push('/(auth)/register' as never)}
          >
            Rejoindre
          </Button>

          <Button
            variant="secondary"
            size="lg"
            onPress={() => router.push('/(auth)/login' as never)}
          >
            Se connecter
          </Button>
        </Animated.View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  blurOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 24,
  },
  logo: {
    fontFamily: FONTS.heading,
    fontSize: 48,
    color: COLORS.text,
    letterSpacing: 12,
    textAlign: 'center',
  },
  tagline: {
    fontFamily: FONTS.accent,
    fontSize: 18,
    color: COLORS.textMuted,
    textAlign: 'center',
    letterSpacing: 2,
  },
  buttons: {
    width: '100%',
    gap: 16,
    marginTop: 48,
  },
})
