import { View, Text, StyleSheet, Pressable, ScrollView, Image, TextInput } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { BlurView } from 'expo-blur'
import * as ImagePicker from 'expo-image-picker'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../../../constants/theme'
import { useAuthStore } from '../../../stores/auth.store'
import { Button } from '../../../components/ui/Button'

export default function MeProfileScreen(): React.JSX.Element {
  const { user } = useAuthStore()

  const handlePickAvatar = async (): Promise<void> => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    })
    // Upload Cloudinary + mise à jour profil seront branchés sur YP dédié
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Chargement du profil...</Text>
      </View>
    )
  }

  const { displayName, city, bio, avatarUrl } = user.profile

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.springify()}>
          <BlurView intensity={40} tint="dark" style={styles.card}>
          <View style={styles.avatarRow}>
            <Pressable onPress={() => void handlePickAvatar()} style={styles.avatarWrapper}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitial}>
                    {displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={16} color={COLORS.bg} />
              </View>
            </Pressable>
            <View style={styles.identity}>
              <Text style={styles.name}>{displayName}</Text>
              {city ? <Text style={styles.city}>{city}</Text> : null}
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.label}>Nom affiché</Text>
            <TextInput
              style={styles.input}
              defaultValue={displayName}
              placeholderTextColor={COLORS.textMuted}
            />
          </View>

          <View style={styles.formSection}>
            <Text style={styles.label}>Ville</Text>
            <TextInput
              style={styles.input}
              defaultValue={city}
              placeholderTextColor={COLORS.textMuted}
            />
          </View>

          <View style={styles.formSection}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              defaultValue={bio}
              placeholder="Parlez de votre univers, vos soirées, votre style..."
              placeholderTextColor={COLORS.textMuted}
              multiline
            />
          </View>

          <View style={styles.actions}>
            <Button variant="primary" size="lg">
              Enregistrer les modifications
            </Button>
            <Button variant="secondary" size="md">
              Demander un rôle
            </Button>
          </View>
        </BlurView>
        </Animated.View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  loadingText: {
    fontFamily: FONTS.body,
    fontSize: 16,
    color: COLORS.textMuted,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.lg,
  },
  avatarWrapper: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 2,
    borderColor: COLORS.accentGold,
    padding: 2,
    backgroundColor: COLORS.surfaceElevated,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: BORDER_RADIUS.full,
  },
  avatarFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surface,
  },
  avatarInitial: {
    fontFamily: FONTS.heading,
    fontSize: 28,
    color: COLORS.text,
  },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.accentGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: {
    flex: 1,
  },
  name: {
    fontFamily: FONTS.heading,
    fontSize: 22,
    color: COLORS.text,
  },
  city: {
    marginTop: 4,
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textMuted,
  },
  formSection: {
    marginTop: SPACING.lg,
  },
  label: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  input: {
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: COLORS.surfaceElevated,
  },
  textarea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  actions: {
    marginTop: SPACING.xl,
    gap: SPACING.sm,
  },
})

