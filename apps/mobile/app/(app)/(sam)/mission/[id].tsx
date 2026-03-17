import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  TextInput,
  FlatList,
  Alert,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Animated, { FadeInDown } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../../../../constants/theme'
import { useSamMission, useLogTripMutation, useConfirmArrivalMutation, useReportIncidentMutation, useCompleteMissionMutation, useStartMissionMutation } from '../../../../hooks/useSamQueries'
import { useEvent, useGuests } from '../../../../hooks/useEventQueries'
import { TripCard } from '../../../../components/sam/TripCard'
import { IncidentBadge } from '../../../../components/sam/IncidentBadge'
import { Button } from '../../../../components/ui/Button'
import type { GuestListItem } from '@yurpass/types'

type TabKey = 'info' | 'trips' | 'incidents'

export default function SamMissionDetailScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()

  const { data: mission, isLoading, error } = useSamMission(id ?? '')
  const eventId = mission?.eventId ?? ''

  const { data: event } = useEvent(eventId)
  const { data: guestsData } = useGuests(eventId, 'approved')

  const [activeTab, setActiveTab] = useState<TabKey>('info')
  const [newTripModalVisible, setNewTripModalVisible] = useState(false)
  const [incidentModalVisible, setIncidentModalVisible] = useState(false)
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null)
  const [destination, setDestination] = useState('')
  const [incidentDescription, setIncidentDescription] = useState('')
  const [incidentLevel, setIncidentLevel] = useState<'info' | 'warning' | 'urgent'>('info')

  const logTripMutation = useLogTripMutation(id ?? '')
  const confirmArrivalMutation = useConfirmArrivalMutation(id ?? '')
  const reportIncidentMutation = useReportIncidentMutation(id ?? '')
  const completeMissionMutation = useCompleteMissionMutation(id ?? '')
  const startMissionMutation = useStartMissionMutation()

  if (!id || isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Chargement de la mission...</Text>
      </View>
    )
  }

  if (error || !mission) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>
          {error instanceof Error ? error.message : 'Mission introuvable'}
        </Text>
        <Button variant="ghost" size="md" onPress={() => router.back()}>
          Retour
        </Button>
      </View>
    )
  }

  const allTripsCompleted = mission.trips.length > 0 && mission.trips.every((t) => t.status === 'completed')

  const handleStartMission = async (): Promise<void> => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    try {
      await startMissionMutation.mutateAsync(mission.publicId)
    } catch {
      // error handled by toast layer when added
    }
  }

  const handleOpenNewTripModal = (): void => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setNewTripModalVisible(true)
  }

  const handleSubmitNewTrip = async (): Promise<void> => {
    if (!selectedGuestId || !destination.trim()) return
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    try {
      await logTripMutation.mutateAsync({
        guestId: selectedGuestId,
        destination: destination.trim(),
        departureTime: new Date(),
      })
      setDestination('')
      setSelectedGuestId(null)
      setNewTripModalVisible(false)
    } catch {
      // handled upstream
    }
  }

  const handleConfirmArrival = async (tripIndex: number): Promise<void> => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    try {
      await confirmArrivalMutation.mutateAsync(tripIndex)
    } catch {
      // handled upstream
    }
  }

  const handleOpenIncidentModal = (): void => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setIncidentModalVisible(true)
  }

  const handleSubmitIncident = async (): Promise<void> => {
    if (!incidentDescription.trim()) return

    const submit = async (): Promise<void> => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      try {
        await reportIncidentMutation.mutateAsync({
          description: incidentDescription.trim(),
          level: incidentLevel,
        })
        setIncidentDescription('')
        setIncidentLevel('info')
        setIncidentModalVisible(false)
      } catch {
        // handled upstream
      }
    }

    if (incidentLevel === 'urgent') {
      Alert.alert(
        'Confirmer incident URGENT',
        'Cet incident sera signalé comme prioritaire aux équipes Yurpass.',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Confirmer',
            style: 'destructive',
            onPress: () => {
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
              void submit()
            },
          },
        ],
      )
    } else {
      void submit()
    }
  }

  const handleCompleteMission = async (): Promise<void> => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    try {
      await completeMissionMutation.mutateAsync(undefined)
      router.back()
    } catch {
      // handled upstream
    }
  }

  const guests = guestsData?.guests ?? []

  const renderTabButton = (key: TabKey, label: string): React.JSX.Element => (
    <Pressable
      key={key}
      style={[styles.tabButton, activeTab === key && styles.tabButtonActive]}
      onPress={() => setActiveTab(key)}
    >
      <Text
        style={[
          styles.tabLabel,
          activeTab === key && styles.tabLabelActive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  )

  const renderInfoSection = (): React.JSX.Element => (
    <Animated.View entering={FadeInDown.springify()} style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>Informations</Text>
      <Text style={styles.infoTitle}>{event?.title ?? 'Événement'}</Text>
      <Text style={styles.infoText}>{event?.venue.city}</Text>
      <Text style={styles.infoText}>
        {event?.schedule.startDate
          ? new Date(event.schedule.startDate).toLocaleString('fr-FR', {
              weekday: 'short',
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })
          : ''}
      </Text>
      <View style={styles.infoHostRow}>
        <Ionicons name="shield-checkmark" size={18} color={COLORS.accentGold} />
        <Text style={styles.infoHostText}>Hôte : {event?.hostId ?? mission.hostId}</Text>
      </View>
    </Animated.View>
  )

  const renderTripsSection = (): React.JSX.Element => (
    <Animated.View entering={FadeInDown.springify()} style={styles.sectionCard}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Trajets</Text>
        <Text style={styles.sectionCount}>{mission.trips.length} trajets</Text>
      </View>

      {mission.trips.map((trip, index) => (
        <TripCard
          key={`${trip.guestId}-${index}`}
          trip={trip}
          index={index}
          onConfirmArrival={
            trip.status === 'in-progress'
              ? () => {
                  void handleConfirmArrival(index)
                }
              : undefined
          }
        />
      ))}

      <Pressable
        style={styles.newTripButton}
        onPress={handleOpenNewTripModal}
      >
        <Text style={styles.newTripText}>NOUVEAU TRAJET</Text>
      </Pressable>
    </Animated.View>
  )

  const renderIncidentsSection = (): React.JSX.Element => (
    <Animated.View entering={FadeInDown.springify()} style={styles.sectionCard}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Incidents</Text>
        <Text style={styles.sectionCount}>{mission.incidents.length} incidents</Text>
      </View>

      {mission.incidents.map((incident, index) => (
        <View key={`${incident.reportedAt}-${index}`} style={styles.incidentRow}>
          <IncidentBadge incident={incident} />
          <Text style={styles.incidentDescription}>{incident.description}</Text>
        </View>
      ))}

      <Pressable
        style={styles.incidentButton}
        onPress={handleOpenIncidentModal}
      >
        <Text style={styles.incidentButtonText}>SIGNALER UN INCIDENT</Text>
      </Pressable>
    </Animated.View>
  )

  const showStartButton = mission.status === 'confirmed' || mission.status === 'assigned'

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Mission SAM
        </Text>
        <Text style={styles.headerStatus}>{mission.status.toUpperCase()}</Text>
      </View>

      <View style={styles.tabsRow}>
        {renderTabButton('info', 'Info')}
        {renderTabButton('trips', 'Trajets')}
        {renderTabButton('incidents', 'Incidents')}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'info' && renderInfoSection()}
        {activeTab === 'trips' && renderTripsSection()}
        {activeTab === 'incidents' && renderIncidentsSection()}
      </ScrollView>

      <View style={styles.bottomActions}>
        {showStartButton && (
          <Button
            variant="primary"
            size="lg"
            onPress={handleStartMission}
            disabled={startMissionMutation.isPending}
            loading={startMissionMutation.isPending}
          >
            Démarrer la mission
          </Button>
        )}

        {allTripsCompleted && mission.status === 'active' && (
          <Button
            variant="secondary"
            size="lg"
            onPress={handleCompleteMission}
            disabled={completeMissionMutation.isPending}
            loading={completeMissionMutation.isPending}
          >
            Clôturer la mission
          </Button>
        )}

        <Pressable
          style={styles.urgentButton}
          onPress={handleOpenIncidentModal}
        >
          <Text style={styles.urgentText}>INCIDENT URGENT</Text>
        </Pressable>
      </View>

      {/* New Trip Modal */}
      <Modal
        visible={newTripModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setNewTripModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nouveau trajet</Text>

            <Text style={styles.modalLabel}>Invité</Text>
            <FlatList
              data={guests}
              keyExtractor={(item) => item.userId}
              style={styles.guestList}
              renderItem={({ item }: { item: GuestListItem }) => (
                <Pressable
                  style={[
                    styles.guestItem,
                    selectedGuestId === item.userId && styles.guestItemSelected,
                  ]}
                  onPress={() => setSelectedGuestId(item.userId)}
                >
                  <Text style={styles.guestName}>{item.displayName}</Text>
                </Pressable>
              )}
            />

            <Text style={styles.modalLabel}>Destination</Text>
            <TextInput
              style={styles.input}
              placeholder="Adresse ou zone de dépose"
              placeholderTextColor={COLORS.textMuted}
              value={destination}
              onChangeText={setDestination}
            />

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancel}
                onPress={() => setNewTripModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Annuler</Text>
              </Pressable>
              <Pressable
                style={styles.modalConfirm}
                onPress={() => void handleSubmitNewTrip()}
              >
                <Text style={styles.modalConfirmText}>Confirmer</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Incident Modal */}
      <Modal
        visible={incidentModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIncidentModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Signaler un incident</Text>

            <Text style={styles.modalLabel}>Niveau</Text>
            <View style={styles.levelRow}>
              {(['info', 'warning', 'urgent'] as const).map((level) => (
                <Pressable
                  key={level}
                  style={[
                    styles.levelChip,
                    incidentLevel === level && styles.levelChipActive,
                  ]}
                  onPress={() => setIncidentLevel(level)}
                >
                  <Text
                    style={[
                      styles.levelText,
                      incidentLevel === level && styles.levelTextActive,
                    ]}
                  >
                    {level === 'info'
                      ? 'Info'
                      : level === 'warning'
                        ? 'Avertissement'
                        : 'URGENT'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.modalLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="Décrivez clairement la situation..."
              placeholderTextColor={COLORS.textMuted}
              value={incidentDescription}
              onChangeText={setIncidentDescription}
              multiline
              maxLength={500}
            />

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancel}
                onPress={() => setIncidentModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Annuler</Text>
              </Pressable>
              <Pressable
                style={styles.modalConfirm}
                onPress={() => void handleSubmitIncident()}
              >
                <Text style={styles.modalConfirmText}>Envoyer</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    fontSize: 20,
    color: COLORS.text,
    flex: 1,
    marginLeft: SPACING.md,
  },
  headerStatus: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: COLORS.accent,
  },
  tabLabel: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textMuted,
  },
  tabLabelActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl + 120,
  },
  sectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: SPACING.md,
  },
  sectionTitle: {
    fontFamily: FONTS.heading,
    fontSize: 18,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sectionCount: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  infoTitle: {
    fontFamily: FONTS.heading,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 2,
  },
  infoText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textMuted,
  },
  infoHostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  infoHostText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.text,
  },
  incidentRow: {
    marginBottom: SPACING.sm,
    gap: SPACING.xs,
  },
  incidentDescription: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.text,
  },
  newTripButton: {
    marginTop: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
  },
  newTripText: {
    fontFamily: FONTS.body,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  incidentButton: {
    marginTop: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  incidentButtonText: {
    fontFamily: FONTS.body,
    fontSize: 16,
    color: COLORS.text,
  },
  bottomActions: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
    backgroundColor: COLORS.bg,
    gap: SPACING.sm,
  },
  urgentButton: {
    marginTop: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
  },
  urgentText: {
    fontFamily: FONTS.body,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalCard: {
    width: '100%',
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    maxHeight: '80%',
  },
  modalTitle: {
    fontFamily: FONTS.heading,
    fontSize: 18,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  modalLabel: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.text,
    marginTop: SPACING.sm,
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
    minHeight: 100,
    textAlignVertical: 'top',
  },
  guestList: {
    maxHeight: 160,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  guestItem: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
  },
  guestItemSelected: {
    backgroundColor: COLORS.surfaceElevated,
  },
  guestName: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.text,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  modalCancel: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
  },
  modalCancelText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textMuted,
  },
  modalConfirm: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.accent,
  },
  modalConfirmText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  levelRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  levelChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelChipActive: {
    borderColor: '#EF4444',
    backgroundColor: '#EF444433',
  },
  levelText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  levelTextActive: {
    color: '#EF4444',
    fontWeight: '600',
  },
})

