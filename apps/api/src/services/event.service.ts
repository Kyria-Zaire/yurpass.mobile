import { nanoid } from 'nanoid'
import { Event } from '../models/event.model.js'
import { Participation } from '../models/participation.model.js'
import { User } from '../models/user.model.js'
import { AuditLog } from '../models/audit-log.model.js'
import { logger } from '../lib/logger.js'
import {
  EventStatus,
  UserRole,
  AuditAction,
  AuditResult,
} from '@yurpass/types'
import type {
  CreateEventInput,
  UpdateEventInput,
  EventForHost,
  EventForGuest,
} from '@yurpass/types'
import {
  AppError,
  NotFoundError,
  ForbiddenError,
} from '../middlewares/error-handler.js'
import { NotificationService } from './notification.service.js'

const SAM_REQUIRED_THRESHOLD = 20

export class EventService {
  // ─── Create ─────────────────────────────────────────────

  static async createEvent(
    hostId: string,
    input: CreateEventInput,
  ): Promise<{ publicId: string }> {
    const samRequired = input.capacity.max > SAM_REQUIRED_THRESHOLD

    const publicId = nanoid(10)
    await Event.create({
      publicId,
      hostId,
      title: input.title,
      description: input.description,
      theme: input.theme,
      schedule: {
        startDate: new Date(input.schedule.startDate),
        endDate: new Date(input.schedule.endDate),
        doorsOpenAt: new Date(input.schedule.doorsOpenAt),
      },
      venue: input.venue,
      capacity: {
        max: input.capacity.max,
        confirmed: 0,
        waitlist: 0,
      },
      access: input.access,
      status: EventStatus.DRAFT,
      samRequired,
      isPrivate: input.isPrivate ?? true,
      mediaUrls: [],
    })

    await AuditLog.create({
      action: AuditAction.EVENT_CREATED,
      userId: hostId,
      eventId: publicId,
      metadata: { title: input.title, capacity: input.capacity.max, samRequired },
      result: AuditResult.SUCCESS,
    })

    logger.info({ publicId, hostId }, 'Event created')
    return { publicId }
  }

  // ─── Publish ────────────────────────────────────────────

  static async publishEvent(
    eventId: string,
    hostId: string,
  ): Promise<void> {
    const event = await findEventOrThrow(eventId)
    assertHost(event, hostId)

    if (event.status !== EventStatus.DRAFT) {
      throw new AppError(
        'Seul un événement en brouillon peut être publié',
        422,
        'INVALID_STATUS',
      )
    }

    if (event.samRequired && !event.samId) {
      throw new AppError(
        'Un SAM doit être assigné avant de publier (capacité > 20)',
        422,
        'SAM_REQUIRED',
      )
    }

    await Event.updateOne(
      { _id: event._id },
      { $set: { status: EventStatus.PUBLISHED } },
    )

    await AuditLog.create({
      action: AuditAction.EVENT_PUBLISHED,
      userId: hostId,
      eventId,
      metadata: {},
      result: AuditResult.SUCCESS,
    })

    logger.info({ eventId, hostId }, 'Event published')
  }

  // ─── Update ─────────────────────────────────────────────

  static async updateEvent(
    eventId: string,
    hostId: string,
    input: UpdateEventInput,
  ): Promise<void> {
    const event = await findEventOrThrow(eventId)
    assertHost(event, hostId)

    const nonEditable: EventStatus[] = [
      EventStatus.COMPLETED,
      EventStatus.CANCELLED,
    ]
    if (nonEditable.includes(event.status as EventStatus)) {
      throw new AppError(
        'Impossible de modifier un événement terminé ou annulé',
        422,
        'INVALID_STATUS',
      )
    }

    const updateData: Record<string, unknown> = {}

    if (input.title !== undefined) updateData.title = input.title
    if (input.description !== undefined) updateData.description = input.description
    if (input.theme !== undefined) updateData.theme = input.theme
    if (input.isPrivate !== undefined) updateData.isPrivate = input.isPrivate
    if (input.access !== undefined) updateData.access = input.access

    if (input.schedule !== undefined) {
      updateData.schedule = {
        startDate: new Date(input.schedule.startDate),
        endDate: new Date(input.schedule.endDate),
        doorsOpenAt: new Date(input.schedule.doorsOpenAt),
      }
    }

    if (input.venue !== undefined) {
      updateData.venue = input.venue
    }

    if (input.capacity !== undefined) {
      updateData['capacity.max'] = input.capacity.max
      const samRequired = input.capacity.max > SAM_REQUIRED_THRESHOLD
      updateData.samRequired = samRequired
    }

    await Event.updateOne({ _id: event._id }, { $set: updateData })

    await AuditLog.create({
      action: AuditAction.EVENT_UPDATED,
      userId: hostId,
      eventId,
      metadata: { fields: Object.keys(updateData) },
      result: AuditResult.SUCCESS,
    })

    logger.info({ eventId, hostId }, 'Event updated')
  }

  // ─── Cancel ─────────────────────────────────────────────

  static async cancelEvent(
    eventId: string,
    hostId: string,
  ): Promise<void> {
    const event = await findEventOrThrow(eventId)
    assertHost(event, hostId)

    const nonCancellable: EventStatus[] = [
      EventStatus.COMPLETED,
      EventStatus.CANCELLED,
    ]
    if (nonCancellable.includes(event.status as EventStatus)) {
      throw new AppError(
        'Impossible d\'annuler un événement déjà terminé ou annulé',
        422,
        'INVALID_STATUS',
      )
    }

    await Event.updateOne(
      { _id: event._id },
      { $set: { status: EventStatus.CANCELLED } },
    )

    await AuditLog.create({
      action: AuditAction.EVENT_CANCELLED,
      userId: hostId,
      eventId,
      metadata: {},
      result: AuditResult.SUCCESS,
    })

    logger.info({ eventId, hostId }, 'Event cancelled')

    // Notify all approved/attended guests
    const participations = await Participation.find({
      eventId,
      status: { $in: ['approved', 'attended'] },
    })
      .select('userId')
      .lean()

    if (participations.length > 0) {
      const userIds = participations.map((p) => p.userId)
      NotificationService.notifyEventCancelled(userIds, event.title)
    }
  }

  // ─── Assign SAM ────────────────────────────────────────

  static async assignSam(
    eventId: string,
    hostId: string,
    samId: string,
  ): Promise<void> {
    const event = await findEventOrThrow(eventId)
    assertHost(event, hostId)

    if (samId === hostId) {
      throw new ForbiddenError('Le host ne peut pas être son propre SAM')
    }

    const samUser = await User.findOne({
      publicId: samId,
      deletedAt: null,
    })

    if (!samUser) {
      throw new NotFoundError('Utilisateur SAM introuvable')
    }

    const hasSamRole = (samUser.roles as string[]).includes(UserRole.SAM)
    if (!hasSamRole) {
      throw new AppError(
        'Cet utilisateur n\'a pas le rôle SAM',
        422,
        'INVALID_ROLE',
      )
    }

    await Event.updateOne(
      { _id: event._id },
      { $set: { samId } },
    )

    await AuditLog.create({
      action: AuditAction.SAM_ASSIGNED,
      userId: hostId,
      targetId: samId,
      eventId,
      metadata: {},
      result: AuditResult.SUCCESS,
    })

    logger.info({ eventId, hostId, samId }, 'SAM assigned to event')
  }

  // ─── Get event for host ─────────────────────────────────

  static async getEventForHost(
    eventId: string,
    hostId: string,
  ): Promise<EventForHost> {
    const event = await findEventOrThrow(eventId)
    assertHost(event, hostId)

    const [totalParticipants, pendingApprovals, checkedIn] = await Promise.all([
      Participation.countDocuments({ eventId, status: { $in: ['approved', 'attended'] } }),
      Participation.countDocuments({ eventId, status: 'pending' }),
      Participation.countDocuments({ eventId, checkedInAt: { $ne: null } }),
    ])

    const eventObj = event.toJSON() as unknown as EventForHost
    eventObj.stats = { totalParticipants, pendingApprovals, checkedIn }
    return eventObj
  }

  // ─── Get event for guest (address hidden) ───────────────

  static async getEventForGuest(eventId: string): Promise<EventForGuest> {
    const event = await Event.findOne({
      publicId: eventId,
      deletedAt: null,
      status: { $in: [EventStatus.PUBLISHED, EventStatus.FULL, EventStatus.ONGOING] },
    })

    if (!event) {
      throw new NotFoundError('Événement introuvable')
    }

    return {
      publicId: event.publicId,
      hostId: event.hostId,
      title: event.title,
      description: event.description,
      theme: event.theme,
      schedule: event.schedule,
      venue: {
        city: event.venue.city,
        // address intentionally omitted — revealed only after approved + 2h before event
      },
      capacity: {
        max: event.capacity.max,
        confirmed: event.capacity.confirmed,
      },
      access: event.access,
      status: event.status as EventStatus,
      mediaUrls: event.mediaUrls,
      createdAt: event.createdAt,
    }
  }

  // ─── List host events ──────────────────────────────────

  static async listHostEvents(
    hostId: string,
    options: { status?: EventStatus; cursor?: string; limit: number },
  ): Promise<{ events: EventForHost[]; nextCursor?: string }> {
    const filter: Record<string, unknown> = {
      hostId,
      deletedAt: null,
    }

    if (options.status) {
      filter.status = options.status
    }

    if (options.cursor) {
      filter._id = { $gt: options.cursor }
    }

    const events = await Event.find(filter)
      .sort({ 'schedule.startDate': -1 })
      .limit(options.limit + 1)
      .lean()

    const hasMore = events.length > options.limit
    if (hasMore) events.pop()

    const result: EventForHost[] = await Promise.all(
      events.map(async (event) => {
        const [totalParticipants, pendingApprovals, checkedIn] = await Promise.all([
          Participation.countDocuments({ eventId: event.publicId, status: { $in: ['approved', 'attended'] } }),
          Participation.countDocuments({ eventId: event.publicId, status: 'pending' }),
          Participation.countDocuments({ eventId: event.publicId, checkedInAt: { $ne: null } }),
        ])

        const { _id, __v, ...rest } = event as Record<string, unknown>
        return {
          ...rest,
          stats: { totalParticipants, pendingApprovals, checkedIn },
        } as EventForHost
      }),
    )

    const nextCursor = hasMore && events.length > 0
      ? String((events[events.length - 1] as Record<string, unknown>)._id)
      : undefined

    return { events: result, nextCursor }
  }
}

// ─── Helpers ─────────────────────────────────────────────

export interface EventDocument {
  _id: unknown
  publicId: string
  hostId: string
  status: string
  samRequired: boolean
  samId?: string
  venue: {
    city: string
    address?: string
    coordinates?: { lat: number; lng: number }
  }
  capacity: {
    max: number
    confirmed: number
    waitlist: number
  }
  access: {
    type: string
    requiresContribution: boolean
    contributionDetails?: string
  }
  title: string
  description: string
  theme: { id: string; name: string; dresscode: string }
  schedule: { startDate: Date; endDate: Date; doorsOpenAt: Date }
  mediaUrls: string[]
  isPrivate: boolean
  deletedAt?: Date
  createdAt: Date
  updatedAt: Date
  toJSON(): unknown
}

export async function findEventOrThrow(eventId: string): Promise<EventDocument> {
  const event = await Event.findOne({ publicId: eventId, deletedAt: null })
  if (!event) {
    throw new NotFoundError('Événement introuvable')
  }
  return event as unknown as EventDocument
}

export function assertHost(event: EventDocument, hostId: string): void {
  if (event.hostId !== hostId) {
    throw new ForbiddenError('Vous n\'êtes pas le host de cet événement')
  }
}
