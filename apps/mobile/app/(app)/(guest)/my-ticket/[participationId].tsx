import { useEffect, useState, useCallback, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ScrollView,
  Platform,
  Linking,
  Alert,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Animated, { FadeInDown } from 'react-native-reanimated'
import * as ScreenCapture from 'expo-screen-capture'
import * as Brightness from 'expo-brightness'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import QRCode from 'qrcode'
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../../../../constants/theme'
import { Button } from '../../../../components/ui/Button'
import { CountdownTimer } from '../../../../components/ui/CountdownTimer'
import { useMyTicket, useEventAddress } from '../../../../hooks/useGuestQueries'

const TICKET_SCREEN_CAPTURE_KEY = 'yurpass-my-ticket'
const QR_REVEAL_HOURS_BEFORE_DOORS = 2
const ADDRESS_REVEAL_HOURS_BEFORE = 24

export default function MyTicketScreen(): React.JSX.Element {
  const { participationId } = useLocalSearchParams<{ participationId: string }>()
  const router = useRouter()
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const originalBrightnessRef = useRef<number | null>(null)

  const { data, isLoading, error } = useMyTicket(participationId ?? '')

  const event = data?.event
  const participation = data?.participation
  const startDate = event?.schedule?.startDate
    ? new Date(event.schedule.startDate)
    : null
  const doorsOpenAt =
    event?.schedule && 'doorsOpenAt' in event.schedule && event.schedule.doorsOpenAt
      ? new Date(event.schedule.doorsOpenAt)
      : startDate

  const qrRevealAt =
    doorsOpenAt &&
    new Date(doorsOpenAt.getTime() - QR_REVEAL_HOURS_BEFORE_DOORS * 60 * 60 * 1000)
  const now = Date.now()
  const showQr = qrRevealAt && now >= qrRevealAt.getTime() && participation?.accessCode

  const addressRevealAt =
    startDate &&
    new Date(
      startDate.getTime() - ADDRESS_REVEAL_HOURS_BEFORE * 60 * 60 * 1000,
    )
  const showAddress = addressRevealAt && now >= addressRevealAt.getTime()

  const { data: addressData } = useEventAddress(
    participation?.eventId ?? '',
    { enabled: !!showAddress && !!participation?.eventId },
  )

  // ─── expo-screen-capture — blocage captures d'écran ─────

  useEffect(() => {
    void ScreenCapture.preventScreenCaptureAsync(TICKET_SCREEN_CAPTURE_KEY)
    return () => {
      void ScreenCapture.allowScreenCaptureAsync(TICKET_SCREEN_CAPTURE_KEY)
    }
  }, [])

  // ─── Luminosité max au montage, restauration au démontage ─

  useEffect(() => {
    void Brightness.getBrightnessAsync().then((b) => {
      originalBrightnessRef.current = b
      return Brightness.setBrightnessAsync(1)
    })
    return () => {
      const original = originalBrightnessRef.current
      if (typeof original === 'number') {
        void Brightness.setBrightnessAsync(original)
      } else if (Platform.OS === 'android') {
        void Brightness.restoreSystemBrightnessAsync()
      }
    }
  }, [])

  // ─── Haptic on open ────────────────────────────────────

  useEffect(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
  }, [])

  // ─── QR data URL from access code ──────────────────────

  useEffect(() => {
    if (!participation?.accessCode) return
    QRCode.toDataURL(participation.accessCode, {
      width: 256,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null))
  }, [participation?.accessCode])

  const handleOpenInMaps = useCallback((): void => {
    const address = addressData?.address
    const coords = addressData?.coordinates
    if (coords?.lat != null && coords?.lng != null) {
      const url =
        Platform.OS === 'ios'
          ? `https://maps.apple.com/?ll=${coords.lat},${coords.lng}&q=${encodeURIComponent(address ?? '')}`
          : `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`
      void Linking.openURL(url)
    } else if (address) {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
      void Linking.openURL(url)
    } else {
      Alert.alert('Erreur', 'Adresse non disponible')
    }
  }, [addressData])

  if (isLoading || !participationId) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    )
  }

  if (error || !data) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>
          {error instanceof Error ? error.message : 'Ticket introuvable'}
        </Text>
        <Button variant="ghost" size="md" onPress={() => router.back()}>
          Retour
        </Button>
      </View>
    )
  }

  if (!event || !participation) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Données invalides</Text>
        <Button variant="ghost" size="md" onPress={() => router.back()}>
          Retour
        </Button>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Mon billet
        </Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          entering={FadeInDown.springify()}
          style={[styles.card, styles.goldBorder]}
        >
          <Text style={styles.eventTitle}>{event.title}</Text>
          <Text style={styles.themeText}>
            {event.theme?.name ?? ''}
            {event.theme?.dresscode ? ` · ${event.theme.dresscode}` : ''}
          </Text>
          <Text style={styles.venueCity}>{event.venue?.city}</Text>

          {/* QR or countdown to QR reveal */}
          <View style={styles.qrSection}>
            {showQr && qrDataUrl ? (
              <View style={styles.qrWrapper}>
                <Image
                  source={{ uri: qrDataUrl }}
                  style={styles.qrImage}
                  resizeMode="contain"
                />
                <Text style={styles.qrHint}>
                  Présentez ce code à l&apos;entrée
                </Text>
              </View>
            ) : qrRevealAt ? (
              <View style={styles.countdownSection}>
                <Text style={styles.countdownLabel}>
                  Code d&apos;accès disponible dans
                </Text>
                <CountdownTimer targetDate={qrRevealAt} />
              </View>
            ) : (
              <Text style={styles.qrUnavailable}>
                Code d&apos;accès non disponible
              </Text>
            )}
          </View>

          {/* Address reveal */}
          <View style={styles.addressSection}>
            {showAddress ? (
              addressData ? (
                <View style={styles.addressBlock}>
                  <Text style={styles.addressLabel}>Adresse</Text>
                  <Text style={styles.addressText}>{addressData.address}</Text>
                  <Pressable
                    style={styles.mapsButton}
                    onPress={handleOpenInMaps}
                  >
                    <Ionicons name="map" size={18} color={COLORS.accent} />
                    <Text style={styles.openMapsText}>Ouvrir dans Maps</Text>
                  </Pressable>
                </View>
              ) : (
                <Text style={styles.textMuted}>Chargement de l&apos;adresse...</Text>
              )
            ) : (
              addressRevealAt && (
                <View style={styles.countdownSection}>
                  <Text style={styles.countdownLabel}>
                    Adresse révélée dans
                  </Text>
                  <CountdownTimer targetDate={addressRevealAt} />
                </View>
              )
            )}
          </View>

          {participation.status === 'attended' && (
            <View style={styles.badgeRow}>
              <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
              <Text style={styles.badgeText}>Présent·e</Text>
            </View>
          )}
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
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  loadingText: {
    fontFamily: FONTS.body,
    fontSize: 16,
    color: COLORS.textMuted,
  },
  errorText: {
    fontFamily: FONTS.body,
    fontSize: 16,
    color: COLORS.error,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontFamily: FONTS.heading,
    fontSize: 18,
    color: COLORS.text,
    flex: 1,
    textAlign: 'center',
  },
  headerPlaceholder: {
    width: 24,
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
    borderWidth: 2,
  },
  goldBorder: {
    borderColor: COLORS.accentGold,
  },
  eventTitle: {
    fontFamily: FONTS.heading,
    fontSize: 22,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  themeText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  venueCity: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.accentGold,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  qrSection: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  qrWrapper: {
    alignItems: 'center',
  },
  qrImage: {
    width: 200,
    height: 200,
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.sm,
  },
  qrHint: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: SPACING.sm,
  },
  countdownSection: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  countdownLabel: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: SPACING.sm,
  },
  qrUnavailable: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textMuted,
  },
  addressSection: {
    marginTop: SPACING.sm,
  },
  addressBlock: {
    gap: SPACING.sm,
  },
  addressLabel: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  addressText: {
    fontFamily: FONTS.body,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  mapsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  openMapsText: {
    fontFamily: FONTS.body,
    fontSize: 16,
    color: COLORS.accent,
  },
  textMuted: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textMuted,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
  },
  badgeText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.success,
    fontWeight: '600',
  },
})
