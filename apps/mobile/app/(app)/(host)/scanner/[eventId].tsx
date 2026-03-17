import { useState, useEffect, useRef, useCallback } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { CameraView, useCameraPermissions } from 'expo-camera'
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, FONTS, BORDER_RADIUS, SPACING } from '../../../../constants/theme'
import * as EventApi from '../../../../services/event.service'
import type { ScanResultResponse } from '@yurpass/types'

// ─── Feedback colors (scanner-specific) ─────────────────
const SCAN_COLORS = {
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
} as const

type ScanState = 'ready' | 'scanning' | 'success' | 'error' | 'warning'

interface ScanResult {
  state: ScanState
  message: string
  guestName?: string
}

const RESET_DELAY_MS = 3000

export default function ScannerScreen(): React.JSX.Element {
  const { eventId } = useLocalSearchParams<{ eventId: string }>()
  const router = useRouter()
  const [permission, requestPermission] = useCameraPermissions()
  const [torch, setTorch] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult>({ state: 'ready', message: '' })
  const isProcessing = useRef(false)
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Overlay animation
  const overlayOpacity = useSharedValue(0)
  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }))

  // ─── Permission handling ────────────────────────────────

  useEffect(() => {
    if (!permission?.granted && !permission?.canAskAgain) return
    if (!permission?.granted) {
      void requestPermission()
    }
  }, [permission, requestPermission])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current)
    }
  }, [])

  // ─── Scan handler ───────────────────────────────────────

  const handleBarCodeScanned = useCallback(
    async ({ data }: { data: string }) => {
      // Prevent double-scan while processing or showing result
      if (isProcessing.current || scanResult.state !== 'ready') return
      isProcessing.current = true

      setScanResult({ state: 'scanning', message: 'Vérification...' })

      try {
        const response = await EventApi.scanAccessCode(eventId, data)
        const guest: ScanResultResponse = response.data

        // SUCCESS
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
        setScanResult({
          state: 'success',
          message: 'Accès autorisé',
          guestName: guest.guestDisplayName,
        })
        overlayOpacity.value = withSequence(
          withTiming(1, { duration: 200 }),
          withTiming(0.85, { duration: 2800 }),
        )
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erreur de scan'

        // Distinguish warning (rate limit, too early) from hard error (invalid code)
        const isWarning =
          message.includes('trop tôt') ||
          message.includes('Trop de tentatives') ||
          message.includes('Réessayez')

        if (isWarning) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          setScanResult({ state: 'warning', message })
        } else {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
          setScanResult({ state: 'error', message })
        }

        overlayOpacity.value = withSequence(
          withTiming(1, { duration: 200 }),
          withTiming(0.85, { duration: 2800 }),
        )
      } finally {
        // Auto-reset after 3 seconds
        resetTimer.current = setTimeout(() => {
          setScanResult({ state: 'ready', message: '' })
          overlayOpacity.value = withTiming(0, { duration: 300 })
          isProcessing.current = false
        }, RESET_DELAY_MS)
      }
    },
    [eventId, scanResult.state, overlayOpacity],
  )

  // ─── Permission denied state ────────────────────────────

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Chargement de la caméra...</Text>
      </View>
    )
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Animated.View entering={FadeIn.duration(300)} style={styles.permissionBox}>
          <Ionicons name="camera-outline" size={64} color={COLORS.textMuted} />
          <Text style={styles.permissionTitle}>Caméra requise</Text>
          <Text style={styles.permissionText}>
            L&apos;accès à la caméra est nécessaire pour scanner les codes QR des invités.
          </Text>
          {permission.canAskAgain ? (
            <Pressable style={styles.permissionButton} onPress={requestPermission}>
              <Text style={styles.permissionButtonText}>Autoriser la caméra</Text>
            </Pressable>
          ) : (
            <Text style={styles.permissionHint}>
              Activez la caméra dans Réglages &gt; Yurpass &gt; Caméra
            </Text>
          )}
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Retour</Text>
          </Pressable>
        </Animated.View>
      </View>
    )
  }

  // ─── Overlay color based on state ──────────────────────

  const overlayColor =
    scanResult.state === 'success'
      ? SCAN_COLORS.success
      : scanResult.state === 'error'
        ? SCAN_COLORS.error
        : scanResult.state === 'warning'
          ? SCAN_COLORS.warning
          : 'transparent'

  const overlayIcon: 'checkmark-circle' | 'close-circle' | 'warning' =
    scanResult.state === 'success'
      ? 'checkmark-circle'
      : scanResult.state === 'error'
        ? 'close-circle'
        : 'warning'

  // ─── Render ─────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Camera */}
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanResult.state === 'ready' ? handleBarCodeScanned : undefined}
      />

      {/* Scan frame overlay */}
      <View style={styles.frameOverlay}>
        <View style={styles.frameCornerTL} />
        <View style={styles.frameCornerTR} />
        <View style={styles.frameCornerBL} />
        <View style={styles.frameCornerBR} />
      </View>

      {/* Top bar: back + torch */}
      <View style={styles.topBar}>
        <Pressable style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color="#FFFFFF" />
        </Pressable>

        <Text style={styles.topTitle}>Scanner</Text>

        <Pressable
          style={[styles.iconButton, torch && styles.iconButtonActive]}
          onPress={() => setTorch((t) => !t)}
        >
          <Ionicons
            name={torch ? 'flash' : 'flash-outline'}
            size={28}
            color={torch ? SCAN_COLORS.warning : '#FFFFFF'}
          />
        </Pressable>
      </View>

      {/* Ready indicator */}
      {scanResult.state === 'ready' && (
        <View style={styles.readyBar}>
          <View style={styles.readyDot} />
          <Text style={styles.readyText}>Prêt à scanner</Text>
        </View>
      )}

      {/* Scanning indicator */}
      {scanResult.state === 'scanning' && (
        <View style={styles.readyBar}>
          <Text style={styles.readyText}>Vérification...</Text>
        </View>
      )}

      {/* Result overlay (full screen tint) */}
      {(scanResult.state === 'success' || scanResult.state === 'error' || scanResult.state === 'warning') && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(300)}
          style={[
            styles.resultOverlay,
            { backgroundColor: overlayColor },
            overlayAnimatedStyle,
          ]}
        >
          <Ionicons name={overlayIcon} size={80} color="#FFFFFF" />

          {scanResult.guestName && (
            <Text style={styles.guestName}>{scanResult.guestName}</Text>
          )}

          <Text style={styles.resultMessage}>{scanResult.message}</Text>
        </Animated.View>
      )}
    </View>
  )
}

// ─── Styles ─────────────────────────────────────────────

const FRAME_SIZE = 260
const CORNER_SIZE = 32
const CORNER_WIDTH = 4

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },

  // Top bar
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  topTitle: {
    fontFamily: FONTS.heading,
    fontSize: 20,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonActive: {
    backgroundColor: 'rgba(245,158,11,0.25)',
  },

  // Scan frame
  frameOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    marginTop: -FRAME_SIZE / 2,
    marginLeft: -FRAME_SIZE / 2,
  },
  frameCornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderTopWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderColor: '#FFFFFF',
    borderTopLeftRadius: BORDER_RADIUS.sm,
  },
  frameCornerTR: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderTopWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderColor: '#FFFFFF',
    borderTopRightRadius: BORDER_RADIUS.sm,
  },
  frameCornerBL: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderBottomWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderColor: '#FFFFFF',
    borderBottomLeftRadius: BORDER_RADIUS.sm,
  },
  frameCornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderBottomWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderColor: '#FFFFFF',
    borderBottomRightRadius: BORDER_RADIUS.sm,
  },

  // Ready bar
  readyBar: {
    position: 'absolute',
    bottom: 120,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
  },
  readyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: SCAN_COLORS.success,
  },
  readyText: {
    fontFamily: FONTS.body,
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Result overlay (full screen tint)
  resultOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  guestName: {
    fontFamily: FONTS.heading,
    fontSize: 32,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  resultMessage: {
    fontFamily: FONTS.body,
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '600',
    paddingHorizontal: SPACING.xl,
  },

  // Permission screens
  permissionBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.md,
  },
  permissionTitle: {
    fontFamily: FONTS.heading,
    fontSize: 24,
    color: COLORS.text,
    textAlign: 'center',
  },
  permissionText: {
    fontFamily: FONTS.body,
    fontSize: 16,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 24,
  },
  permissionHint: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: SPACING.sm,
  },
  permissionButton: {
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.md,
  },
  permissionButtonText: {
    fontFamily: FONTS.body,
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  backButton: {
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  backButtonText: {
    fontFamily: FONTS.body,
    fontSize: 16,
    color: COLORS.textMuted,
  },
})
