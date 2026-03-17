import { SamMission } from '../models/sam-mission.model.js'
import type { ISamTrip, ISamIncident, SamMissionStatus } from '../models/sam-mission.model.js'
import { Event } from '../models/event.model.js'
import { Participation } from '../models/participation.model.js'
import { User } from '../models/user.model.js'
import { AuditLog } from '../models/audit-log.model.js'
import { logger } from '../lib/logger.js'
import {
  EventStatus,
  ParticipationStatus,
  AuditAction,
  AuditResult,
  UserRole,
} from '@yurpass/types'
import { AppError, NotFoundError, ForbiddenError } from '../middlewares/error-handler.js'
import { NotificationService } from './notification.service.js'

// ─── Helpers ─────────────────────────────────────────────────

async function findMissionOrThrow(missionId: string) {
  const mission = await SamMission.findOne({ publicId: missionId })
  if (!mission) {
    throw new NotFoundError('Mission SAM introuvable')
  }
  return mission
}

function assertSamOwnership(mission: { samId: string }, samId: string): void {
  if (mission.samId !== samId) {
    throw new ForbiddenError('Vous n\'êtes pas le SAM assigné à cette mission')
  }
}

// ─── Service ─────────────────────────────────────────────────

export class SamService {
  // ─── Get missions ──────────────────────────────────────────

  static async getMissions(
    samId: string,
    options: { status?: SamMissionStatus; cursor?: string; limit: number },
  ) {
    const filter: Record<string, unknown> = { samId }

    if (options.status) {
      filter.status = options.status
    }

    if (options.cursor) {
      filter._id = { $lt: options.cursor }
    }

    const [missions, total] = await Promise.all([
      SamMission.find(filter)
        .sort({ createdAt: -1 })
        .limit(options.limit + 1)
        .lean(),
      SamMission.countDocuments({ samId, ...(options.status ? { status: options.status } : {}) }),
    ])

    const hasMore = missions.length > options.limit
    if (hasMore) missions.pop()

    // Batch fetch event details
    const eventIds = [...new Set(missions.map((m) => m.eventId))]
    const events = await Event.find(
      { publicId: { $in: eventIds }, deletedAt: null },
      { publicId: 1, title: 1, 'schedule.startDate': 1, 'schedule.endDate': 1, 'venue.city': 1, hostId: 1 },
    ).lean()

    const eventMap = new Map(events.map((e) => [e.publicId, e]))

    const items = missions.map((m) => {
      const event = eventMap.get(m.eventId)
      return {
        publicId: m.publicId,
        eventId: m.eventId,
        eventTitle: event?.title ?? 'Événement inconnu',
        eventDate: (event?.schedule as { startDate?: Date })?.startDate,
        eventCity: (event?.venue as { city?: string })?.city,
        hostId: m.hostId,
        status: m.status,
        tripsCount: m.trips.length,
        incidentsCount: m.incidents.length,
        confirmedAt: m.confirmedAt,
        startedAt: m.startedAt,
        completedAt: m.completedAt,
        createdAt: m.createdAt,
      }
    })

    const nextCursor = hasMore && missions.length > 0
      ? String((missions[missions.length - 1] as Record<string, unknown>)._id)
      : undefined

    return { missions: items, nextCursor, total }
  }

  // ─── Confirm mission ──────────────────────────────────────

  static async confirmMission(missionId: string, samId: string): Promise<void> {
    const mission = await findMissionOrThrow(missionId)
    assertSamOwnership(mission, samId)

    if (mission.status !== 'assigned') {
      throw new AppError(
        'Seules les missions assignées peuvent être confirmées',
        422,
        'INVALID_STATUS',
      )
    }

    await SamMission.updateOne(
      { _id: mission._id },
      { $set: { status: 'confirmed', confirmedAt: new Date() } },
    )

    await AuditLog.create({
      action: AuditAction.SAM_MISSION_CONFIRMED,
      userId: samId,
      eventId: mission.eventId,
      targetId: missionId,
      metadata: { previousStatus: mission.status },
      result: AuditResult.SUCCESS,
    })

    logger.info({ missionId, samId, eventId: mission.eventId }, 'SAM mission confirmed')

    // Notify host
    const event = await Event.findOne(
      { publicId: mission.eventId },
      { title: 1 },
    ).lean()

    NotificationService.notifySamMissionConfirmed(
      mission.hostId,
      event?.title ?? 'Événement',
      mission.eventId,
    )
  }

  // ─── Start mission ────────────────────────────────────────

  static async startMission(missionId: string, samId: string): Promise<void> {
    const mission = await findMissionOrThrow(missionId)
    assertSamOwnership(mission, samId)

    if (mission.status !== 'confirmed') {
      throw new AppError(
        'Seules les missions confirmées peuvent être démarrées',
        422,
        'INVALID_STATUS',
      )
    }

    // Verify event is ongoing
    const event = await Event.findOne({ publicId: mission.eventId, deletedAt: null })
    if (!event || (event.status as string) !== EventStatus.ONGOING) {
      throw new AppError(
        'L\'événement doit être en cours pour démarrer la mission',
        422,
        'EVENT_NOT_ONGOING',
      )
    }

    await SamMission.updateOne(
      { _id: mission._id },
      { $set: { status: 'active', startedAt: new Date() } },
    )

    await AuditLog.create({
      action: AuditAction.SAM_MISSION_STARTED,
      userId: samId,
      eventId: mission.eventId,
      targetId: missionId,
      metadata: {},
      result: AuditResult.SUCCESS,
    })

    logger.info({ missionId, samId, eventId: mission.eventId }, 'SAM mission started')
  }

  // ─── Log trip ─────────────────────────────────────────────

  static async logTrip(
    missionId: string,
    samId: string,
    tripData: { guestId: string; destination: string; departureTime: Date },
  ): Promise<{ tripIndex: number }> {
    const mission = await findMissionOrThrow(missionId)
    assertSamOwnership(mission, samId)

    if (mission.status !== 'active') {
      throw new AppError(
        'La mission doit être active pour enregistrer un trajet',
        422,
        'MISSION_NOT_ACTIVE',
      )
    }

    // Verify guest is a confirmed participant of the event
    const participation = await Participation.findOne({
      userId: tripData.guestId,
      eventId: mission.eventId,
      status: { $in: [ParticipationStatus.APPROVED, ParticipationStatus.ATTENDED] },
    })

    if (!participation) {
      throw new AppError(
        'Cet invité n\'est pas un participant confirmé de l\'événement',
        422,
        'GUEST_NOT_PARTICIPANT',
      )
    }

    // Snapshot guest display name at trip time
    const guestUser = await User.findOne(
      { publicId: tripData.guestId, deletedAt: null },
      { 'profile.displayName': 1 },
    ).lean()

    const guestName = (guestUser?.profile as { displayName?: string })?.displayName ?? 'Invité inconnu'

    const trip: ISamTrip = {
      guestId: tripData.guestId,
      guestName,
      destination: tripData.destination,
      departureTime: tripData.departureTime,
      status: 'in-progress',
    }

    const result = await SamMission.findOneAndUpdate(
      { _id: mission._id },
      { $push: { trips: trip } },
      { new: true },
    )

    const tripIndex = result ? result.trips.length - 1 : 0

    await AuditLog.create({
      action: AuditAction.SAM_TRIP_LOGGED,
      userId: samId,
      eventId: mission.eventId,
      targetId: tripData.guestId,
      metadata: {
        missionId,
        destination: tripData.destination,
        departureTime: tripData.departureTime.toISOString(),
        tripIndex,
      },
      result: AuditResult.SUCCESS,
    })

    logger.info(
      { missionId, samId, guestId: tripData.guestId, tripIndex },
      'SAM trip logged',
    )

    return { tripIndex }
  }

  // ─── Confirm trip arrival ─────────────────────────────────

  static async confirmTripArrival(
    missionId: string,
    samId: string,
    tripIndex: number,
  ): Promise<void> {
    const mission = await findMissionOrThrow(missionId)
    assertSamOwnership(mission, samId)

    if (mission.status !== 'active') {
      throw new AppError(
        'La mission doit être active pour confirmer une arrivée',
        422,
        'MISSION_NOT_ACTIVE',
      )
    }

    if (tripIndex < 0 || tripIndex >= mission.trips.length) {
      throw new AppError('Index de trajet invalide', 422, 'INVALID_TRIP_INDEX')
    }

    const trip = mission.trips[tripIndex]
    if (!trip || trip.status === 'completed') {
      throw new AppError('Ce trajet est déjà terminé', 422, 'TRIP_ALREADY_COMPLETED')
    }

    const now = new Date()

    await SamMission.updateOne(
      { _id: mission._id },
      {
        $set: {
          [`trips.${tripIndex}.arrivalConfirmedAt`]: now,
          [`trips.${tripIndex}.status`]: 'completed',
        },
      },
    )

    await AuditLog.create({
      action: AuditAction.SAM_TRIP_COMPLETED,
      userId: samId,
      eventId: mission.eventId,
      targetId: trip.guestId,
      metadata: {
        missionId,
        tripIndex,
        destination: trip.destination,
        arrivalConfirmedAt: now.toISOString(),
      },
      result: AuditResult.SUCCESS,
    })

    logger.info(
      { missionId, samId, tripIndex, guestId: trip.guestId },
      'SAM trip arrival confirmed',
    )
  }

  // ─── Report incident ──────────────────────────────────────

  static async reportIncident(
    missionId: string,
    samId: string,
    incidentData: { description: string; level: 'info' | 'warning' | 'urgent' },
  ): Promise<void> {
    const mission = await findMissionOrThrow(missionId)
    assertSamOwnership(mission, samId)

    if (mission.status !== 'active') {
      throw new AppError(
        'La mission doit être active pour signaler un incident',
        422,
        'MISSION_NOT_ACTIVE',
      )
    }

    const incident: ISamIncident = {
      description: incidentData.description,
      level: incidentData.level,
      reportedAt: new Date(),
    }

    await SamMission.updateOne(
      { _id: mission._id },
      { $push: { incidents: incident } },
    )

    await AuditLog.create({
      action: AuditAction.SAM_INCIDENT_REPORTED,
      userId: samId,
      eventId: mission.eventId,
      targetId: missionId,
      metadata: {
        level: incidentData.level,
        descriptionLength: incidentData.description.length,
      },
      result: AuditResult.SUCCESS,
    })

    logger.warn(
      { missionId, samId, eventId: mission.eventId, level: incidentData.level },
      'SAM incident reported',
    )

    // URGENT → notify all admins immediately
    if (incidentData.level === 'urgent') {
      const admins = await User.find(
        { roles: UserRole.ADMIN, deletedAt: null },
        { publicId: 1 },
      ).lean()

      const adminIds = admins.map((a) => a.publicId)

      if (adminIds.length > 0) {
        const event = await Event.findOne(
          { publicId: mission.eventId },
          { title: 1 },
        ).lean()

        NotificationService.notifySamUrgentIncident(
          adminIds,
          event?.title ?? 'Événement',
          mission.eventId,
          missionId,
        )
      }

      logger.error(
        { missionId, samId, eventId: mission.eventId, adminNotified: adminIds.length },
        'URGENT SAM incident — admins notified',
      )
    }
  }

  // ─── Complete mission ─────────────────────────────────────

  static async completeMission(
    missionId: string,
    samId: string,
    notes?: string,
  ): Promise<void> {
    const mission = await findMissionOrThrow(missionId)
    assertSamOwnership(mission, samId)

    if (mission.status !== 'active') {
      throw new AppError(
        'Seules les missions actives peuvent être terminées',
        422,
        'INVALID_STATUS',
      )
    }

    // Check for in-progress trips (warn but allow manual completion)
    const pendingTrips = mission.trips.filter((t) => t.status === 'in-progress')
    if (pendingTrips.length > 0) {
      logger.warn(
        { missionId, samId, pendingTripsCount: pendingTrips.length },
        'Mission completed with pending trips',
      )
    }

    const now = new Date()
    const updateFields: Record<string, unknown> = {
      status: 'completed',
      completedAt: now,
    }
    if (notes) {
      updateFields.notes = notes
    }

    await SamMission.updateOne(
      { _id: mission._id },
      { $set: updateFields },
    )

    await AuditLog.create({
      action: AuditAction.SAM_MISSION_COMPLETED,
      userId: samId,
      eventId: mission.eventId,
      targetId: missionId,
      metadata: {
        totalTrips: mission.trips.length,
        completedTrips: mission.trips.filter((t) => t.status === 'completed').length,
        pendingTrips: pendingTrips.length,
        incidentsCount: mission.incidents.length,
        hasNotes: !!notes,
      },
      result: AuditResult.SUCCESS,
    })

    logger.info(
      { missionId, samId, eventId: mission.eventId, totalTrips: mission.trips.length },
      'SAM mission completed',
    )

    // Notify host
    const event = await Event.findOne(
      { publicId: mission.eventId },
      { title: 1 },
    ).lean()

    NotificationService.notifySamMissionCompleted(
      mission.hostId,
      event?.title ?? 'Événement',
      mission.eventId,
      missionId,
    )
  }

  // ─── Get mission report ───────────────────────────────────

  static async getMissionReport(
    missionId: string,
    requesterId: string,
  ) {
    const mission = await findMissionOrThrow(missionId)

    // Access control: SAM, host, or admin
    const requester = await User.findOne(
      { publicId: requesterId, deletedAt: null },
      { roles: 1 },
    ).lean()

    if (!requester) {
      throw new ForbiddenError('Accès refusé')
    }

    const isAdmin = (requester.roles as string[]).includes(UserRole.ADMIN)
    const isSam = mission.samId === requesterId
    const isHost = mission.hostId === requesterId

    if (!isAdmin && !isSam && !isHost) {
      throw new ForbiddenError('Seul le SAM, l\'hôte ou un admin peut consulter ce rapport')
    }

    // Fetch event details
    const event = await Event.findOne(
      { publicId: mission.eventId, deletedAt: null },
      { publicId: 1, title: 1, schedule: 1, 'venue.city': 1, hostId: 1 },
    ).lean()

    const missionData = mission.toJSON()

    return {
      ...(missionData as Record<string, unknown>),
      event: event
        ? {
            publicId: event.publicId,
            title: event.title,
            schedule: event.schedule,
            city: (event.venue as { city?: string })?.city,
          }
        : null,
    }
  }
}
