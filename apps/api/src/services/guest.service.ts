import bcrypt from 'bcryptjs'
import { nanoid } from 'nanoid'
import { Event } from '../models/event.model.js'
import { Participation } from '../models/participation.model.js'
import { User } from '../models/user.model.js'
import { AuditLog } from '../models/audit-log.model.js'
import { logger } from '../lib/logger.js'
import {
  ParticipationStatus,
  EventStatus,
  AccessType,
  AuditAction,
  AuditResult,
} from '@yurpass/types'
import type {
  GuestListItem,
  GuestListResponse,
  ApproveGuestResponse,
  ScanResultResponse,
  EventAddressResponse,
  MyTicketResponse,
  MyTicketParticipation,
} from '@yurpass/types'
import {
  AppError,
  NotFoundError,
  ForbiddenError,
} from '../middlewares/error-handler.js'
import { env } from '../lib/env.js'
import { encryptTicketCode, decryptTicketCode } from '../lib/ticket-crypto.js'
import { findEventOrThrow, assertHost } from './event.service.js'
import { EventService } from './event.service.js'
import { NotificationService } from './notification.service.js'

const ACCESS_CODE_BCRYPT_ROUNDS = 10
const ADDRESS_REVEAL_HOURS_BEFORE = 24

export class GuestService {
  // ─── Invite guest (host action) ─────────────────────────

  static async inviteGuest(
    hostId: string,
    eventId: string,
    guestUserId: string,
  ): Promise<{ participationId: string }> {
    const event = await findEventOrThrow(eventId)
    assertHost(event, hostId)

    const publishedStatuses = [EventStatus.PUBLISHED, EventStatus.FULL, EventStatus.ONGOING]
    if (!publishedStatuses.includes(event.status as EventStatus)) {
      throw new AppError(
        'Impossible d\'inviter sur un événement non publié',
        422,
        'INVALID_STATUS',
      )
    }

    const guestUser = await User.findOne({ publicId: guestUserId, deletedAt: null })
    if (!guestUser) {
      throw new NotFoundError('Utilisateur invité introuvable')
    }

    const existing = await Participation.findOne({ userId: guestUserId, eventId })
    if (existing) {
      throw new AppError('Cet utilisateur participe déjà à cet événement', 409, 'ALREADY_PARTICIPATING')
    }

    const participation = await Participation.create({
      userId: guestUserId,
      eventId,
      status: ParticipationStatus.PENDING,
      invitedBy: hostId,
    })

    await AuditLog.create({
      action: AuditAction.EVENT_GUEST_ADDED,
      userId: hostId,
      targetId: guestUserId,
      eventId,
      metadata: { invitedBy: hostId },
      result: AuditResult.SUCCESS,
    })

    logger.info({ eventId, guestUserId, hostId }, 'Guest invited')

    NotificationService.notifyGuestInvited(guestUserId, event.title, participation.publicId)

    return { participationId: participation.publicId }
  }

  // ─── Apply to event (guest action) ─────────────────────

  static async applyToEvent(
    userId: string,
    eventId: string,
  ): Promise<{ participationId: string }> {
    const event = await findEventOrThrow(eventId)

    if (event.status !== EventStatus.PUBLISHED) {
      throw new AppError(
        'Les candidatures ne sont acceptées que pour les événements publiés',
        422,
        'INVALID_STATUS',
      )
    }

    if (event.access.type !== AccessType.APPLICATION) {
      throw new ForbiddenError('Cet événement est sur invitation uniquement')
    }

    const existing = await Participation.findOne({ userId, eventId })
    if (existing) {
      throw new AppError('Vous participez déjà à cet événement', 409, 'ALREADY_PARTICIPATING')
    }

    const participation = await Participation.create({
      userId,
      eventId,
      status: ParticipationStatus.PENDING,
    })

    await AuditLog.create({
      action: AuditAction.EVENT_GUEST_ADDED,
      userId,
      eventId,
      metadata: { source: 'application' },
      result: AuditResult.SUCCESS,
    })

    logger.info({ eventId, userId }, 'Guest applied')
    return { participationId: participation.publicId }
  }

  // ─── Approve guest (host action) — returns code ONCE ───

  static async approveGuest(
    hostId: string,
    eventId: string,
    participationId: string,
    hostNote?: string,
  ): Promise<ApproveGuestResponse> {
    const event = await findEventOrThrow(eventId)
    assertHost(event, hostId)

    const participation = await Participation.findOne({
      publicId: participationId,
      eventId,
    })
    if (!participation) {
      throw new NotFoundError('Participation introuvable')
    }

    if (participation.status !== ParticipationStatus.PENDING) {
      throw new AppError(
        'Seules les participations en attente peuvent être approuvées',
        422,
        'INVALID_STATUS',
      )
    }

    // Atomic capacity check — prevents race condition
    const capacityUpdate = await Event.findOneAndUpdate(
      {
        _id: event._id,
        'capacity.confirmed': { $lt: event.capacity.max },
      },
      { $inc: { 'capacity.confirmed': 1 } },
      { new: true },
    )

    if (!capacityUpdate) {
      throw new AppError('Capacité maximale atteinte', 422, 'EVENT_FULL')
    }

    // Auto-set FULL status if confirmed now equals max
    if (capacityUpdate.capacity.confirmed >= capacityUpdate.capacity.max) {
      await Event.updateOne(
        { _id: event._id, status: EventStatus.PUBLISHED },
        { $set: { status: EventStatus.FULL } },
      )
    }

    // Generate access code — plain text returned ONCE, hash stored; optionally encrypt for guest ticket
    const plainCode = nanoid(12)
    const codeHash = await bcrypt.hash(plainCode, ACCESS_CODE_BCRYPT_ROUNDS)
    const plainEncrypted =
      env.TICKET_CODE_ENCRYPTION_KEY != null
        ? encryptTicketCode(plainCode, env.TICKET_CODE_ENCRYPTION_KEY)
        : undefined

    await Participation.updateOne(
      { _id: participation._id },
      {
        $set: {
          status: ParticipationStatus.APPROVED,
          'accessCode.codeHash': codeHash,
          'accessCode.generatedAt': new Date(),
          'accessCode.invalidated': false,
          ...(plainEncrypted != null ? { 'accessCode.plainEncrypted': plainEncrypted } : {}),
          ...(hostNote ? { hostNote } : {}),
        },
      },
    )

    await AuditLog.create({
      action: AuditAction.EVENT_GUEST_ADDED,
      userId: hostId,
      targetId: participation.userId,
      eventId,
      metadata: { participationId, approved: true },
      result: AuditResult.SUCCESS,
    })

    logger.info({ eventId, participationId, hostId }, 'Guest approved')

    NotificationService.notifyGuestApproved(participation.userId, event.title, participation.publicId)

    return {
      participationId: participation.publicId,
      accessCode: plainCode,
      status: ParticipationStatus.APPROVED,
    }
  }

  // ─── Reject guest (host action) ─────────────────────────

  static async rejectGuest(
    hostId: string,
    eventId: string,
    participationId: string,
  ): Promise<void> {
    const event = await findEventOrThrow(eventId)
    assertHost(event, hostId)

    const participation = await Participation.findOne({
      publicId: participationId,
      eventId,
    })
    if (!participation) {
      throw new NotFoundError('Participation introuvable')
    }

    const rejectableStatuses = [ParticipationStatus.PENDING, ParticipationStatus.WAITLIST]
    if (!rejectableStatuses.includes(participation.status as ParticipationStatus)) {
      throw new AppError(
        'Seules les participations en attente ou en liste d\'attente peuvent être rejetées',
        422,
        'INVALID_STATUS',
      )
    }

    await Participation.updateOne(
      { _id: participation._id },
      { $set: { status: ParticipationStatus.REJECTED } },
    )

    await AuditLog.create({
      action: AuditAction.EVENT_GUEST_REMOVED,
      userId: hostId,
      targetId: participation.userId,
      eventId,
      metadata: { participationId },
      result: AuditResult.SUCCESS,
    })

    logger.info({ eventId, participationId, hostId }, 'Guest rejected')

    NotificationService.notifyGuestRejected(participation.userId, event.title)
  }

  // ─── Scan access code (SAM/host at the door) ───────────

  static async scanAccessCode(
    scannerId: string,
    eventId: string,
    code: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<ScanResultResponse> {
    const event = await findEventOrThrow(eventId)

    // Check event is not cancelled
    if (event.status === EventStatus.CANCELLED) {
      throw new AppError('Événement annulé', 422, 'EVENT_CANCELLED')
    }

    // RB-003: Code expired after event.endDate
    if (new Date() > event.schedule.endDate) {
      await AuditLog.create({
        action: AuditAction.ACCESS_CODE_REFUSED,
        userId: scannerId,
        eventId,
        metadata: { reason: 'EVENT_ENDED' },
        ipAddress,
        userAgent,
        result: AuditResult.FAILURE,
      })
      throw new AppError('Code expiré — événement terminé', 410, 'EVENT_ENDED')
    }

    // Time window: 2h before startDate
    const windowStart = new Date(event.schedule.startDate.getTime() - 2 * 60 * 60 * 1000)
    if (new Date() < windowStart) {
      await AuditLog.create({
        action: AuditAction.ACCESS_CODE_REFUSED,
        userId: scannerId,
        eventId,
        metadata: { reason: 'SCAN_TOO_EARLY' },
        ipAddress,
        userAgent,
        result: AuditResult.FAILURE,
      })
      throw new AppError(
        'Scan non autorisé — trop tôt avant l\'événement',
        422,
        'SCAN_TOO_EARLY',
      )
    }

    // Fetch all approved participations with a code hash
    const participations = await Participation.find({
      eventId,
      status: { $in: [ParticipationStatus.APPROVED, ParticipationStatus.ATTENDED] },
      'accessCode.codeHash': { $exists: true },
    })

    // Bcrypt compare loop
    let matched: typeof participations[0] | null = null
    for (const p of participations) {
      if (p.accessCode?.codeHash && await bcrypt.compare(code, p.accessCode.codeHash)) {
        matched = p
        break
      }
    }

    if (!matched) {
      await AuditLog.create({
        action: AuditAction.ACCESS_CODE_REFUSED,
        userId: scannerId,
        eventId,
        metadata: { reason: 'NO_MATCH' },
        ipAddress,
        userAgent,
        result: AuditResult.FAILURE,
      })
      throw new AppError('Code d\'accès invalide', 403, 'INVALID_ACCESS_CODE')
    }

    // RB-002: Already used
    if (matched.accessCode?.usedAt) {
      await AuditLog.create({
        action: AuditAction.ACCESS_CODE_REFUSED,
        userId: scannerId,
        targetId: matched.userId,
        eventId,
        metadata: { participationId: matched.publicId, reason: 'ALREADY_USED' },
        ipAddress,
        userAgent,
        result: AuditResult.FAILURE,
      })
      throw new AppError('Code déjà utilisé', 403, 'CODE_ALREADY_USED')
    }

    // Invalidated code
    if (matched.accessCode?.invalidated) {
      await AuditLog.create({
        action: AuditAction.ACCESS_CODE_REFUSED,
        userId: scannerId,
        targetId: matched.userId,
        eventId,
        metadata: { participationId: matched.publicId, reason: 'INVALIDATED' },
        ipAddress,
        userAgent,
        result: AuditResult.FAILURE,
      })
      throw new AppError('Code invalidé', 403, 'CODE_INVALIDATED')
    }

    // Valid scan — update atomically
    const now = new Date()
    await Participation.updateOne(
      { _id: matched._id },
      {
        $set: {
          'accessCode.usedAt': now,
          'accessCode.invalidated': true,
          checkedInAt: now,
          status: ParticipationStatus.ATTENDED,
        },
      },
    )

    await AuditLog.create({
      action: AuditAction.ACCESS_CODE_SCAN,
      userId: scannerId,
      targetId: matched.userId,
      eventId,
      metadata: { participationId: matched.publicId },
      ipAddress,
      userAgent,
      result: AuditResult.SUCCESS,
    })

    // Fetch guest user info for response
    const guestUser = await User.findOne(
      { publicId: matched.userId, deletedAt: null },
      { 'profile.displayName': 1, 'profile.avatarUrl': 1 },
    )

    logger.info({ eventId, participationId: matched.publicId, scannerId }, 'Access code scanned successfully')

    return {
      participationId: matched.publicId,
      guestDisplayName: guestUser?.profile?.displayName ?? 'Invité',
      guestAvatarUrl: guestUser?.profile?.avatarUrl,
      checkedInAt: now,
    }
  }

  // ─── Cancel participation (guest action — RB-011) ──────────

  static async cancelParticipation(
    userId: string,
    participationId: string,
  ): Promise<void> {
    const participation = await Participation.findOne({
      publicId: participationId,
      userId,
    })

    if (!participation) {
      throw new NotFoundError('Participation introuvable')
    }

    // Only PENDING or APPROVED can be cancelled
    const cancellableStatuses = [ParticipationStatus.PENDING, ParticipationStatus.APPROVED]
    if (!cancellableStatuses.includes(participation.status as ParticipationStatus)) {
      throw new AppError(
        'Seules les participations en attente ou approuvées peuvent être annulées',
        422,
        'INVALID_STATUS',
      )
    }

    const event = await findEventOrThrow(participation.eventId)

    // RB-011: Cannot cancel less than 2h before event start
    const twoHoursBefore = new Date(event.schedule.startDate.getTime() - 2 * 60 * 60 * 1000)
    if (new Date() > twoHoursBefore) {
      throw new AppError(
        'Annulation impossible moins de 2h avant le début de l\'événement',
        422,
        'CANCELLATION_TOO_LATE',
      )
    }

    const wasApproved = participation.status === ParticipationStatus.APPROVED

    // Update status + invalidate access code
    await Participation.updateOne(
      { _id: participation._id },
      {
        $set: {
          status: ParticipationStatus.CANCELLED,
          ...(wasApproved ? { 'accessCode.invalidated': true } : {}),
        },
      },
    )

    // Decrement confirmed capacity if was approved
    if (wasApproved) {
      await Event.updateOne(
        { publicId: participation.eventId, 'capacity.confirmed': { $gt: 0 } },
        { $inc: { 'capacity.confirmed': -1 } },
      )

      // If event was FULL, revert to PUBLISHED
      await Event.updateOne(
        { publicId: participation.eventId, status: EventStatus.FULL },
        { $set: { status: EventStatus.PUBLISHED } },
      )
    }

    await AuditLog.create({
      action: AuditAction.PARTICIPATION_CANCELLED,
      userId,
      eventId: participation.eventId,
      metadata: { participationId, previousStatus: participation.status },
      result: AuditResult.SUCCESS,
    })

    logger.info({ participationId, userId, eventId: participation.eventId }, 'Participation cancelled')

    // Notify host
    const guestUser = await User.findOne(
      { publicId: userId, deletedAt: null },
      { 'profile.displayName': 1 },
    ).lean()

    const displayName = (guestUser?.profile as { displayName?: string })?.displayName ?? 'Un invité'

    NotificationService.notifyParticipationCancelled(
      event.hostId,
      event.title,
      displayName,
      event.publicId,
    )
  }

  // ─── Get my ticket (guest) — event + participation + optional access code ─

  static async getMyParticipation(
    userId: string,
    participationId: string,
  ): Promise<MyTicketResponse> {
    const participation = await Participation.findOne({
      publicId: participationId,
      userId,
    }).lean()

    if (!participation) {
      throw new NotFoundError('Participation introuvable')
    }

    const event = await EventService.getEventForGuest(participation.eventId)

    let accessCode: string | undefined
    if (
      participation.accessCode?.plainEncrypted &&
      env.TICKET_CODE_ENCRYPTION_KEY != null
    ) {
      try {
        accessCode = decryptTicketCode(
          participation.accessCode.plainEncrypted,
          env.TICKET_CODE_ENCRYPTION_KEY,
        )
      } catch {
        // Decryption failed (e.g. key rotated) — do not expose code
      }
    }

    const part: MyTicketParticipation = {
      publicId: participation.publicId,
      eventId: participation.eventId,
      status: participation.status as ParticipationStatus,
      ...(accessCode ? { accessCode } : {}),
      ...(participation.checkedInAt ? { checkedInAt: participation.checkedInAt } : {}),
    }

    return { event, participation: part }
  }

  // ─── Get event address (J-24h reveal) ──────────────────

  static async getEventAddress(
    userId: string,
    eventId: string,
  ): Promise<EventAddressResponse> {
    const event = await findEventOrThrow(eventId)

    // Check user has approved/attended participation
    const participation = await Participation.findOne({
      userId,
      eventId,
      status: { $in: [ParticipationStatus.APPROVED, ParticipationStatus.ATTENDED] },
    })

    if (!participation) {
      throw new ForbiddenError('Vous devez être approuvé pour voir l\'adresse')
    }

    // RB-004: Address not revealed before J-24h
    const revealTime = new Date(
      event.schedule.startDate.getTime() - ADDRESS_REVEAL_HOURS_BEFORE * 60 * 60 * 1000,
    )

    if (new Date() < revealTime) {
      throw new ForbiddenError('L\'adresse sera révélée 24h avant l\'événement')
    }

    if (!event.venue.address) {
      throw new NotFoundError('Adresse non renseignée pour cet événement')
    }

    await AuditLog.create({
      action: AuditAction.ADDRESS_REVEALED,
      userId,
      eventId,
      metadata: {},
      result: AuditResult.SUCCESS,
    })

    return {
      address: event.venue.address,
      coordinates: event.venue.coordinates,
    }
  }

  // ─── List guests (host view) ────────────────────────────

  static async listGuests(
    hostId: string,
    eventId: string,
    options: { status?: ParticipationStatus; cursor?: string; limit: number },
  ): Promise<GuestListResponse> {
    const event = await findEventOrThrow(eventId)
    assertHost(event, hostId)

    const filter: Record<string, unknown> = { eventId }

    if (options.status) {
      filter.status = options.status
    }

    if (options.cursor) {
      filter._id = { $gt: options.cursor }
    }

    const [participations, total] = await Promise.all([
      Participation.find(filter)
        .sort({ createdAt: -1 })
        .limit(options.limit + 1)
        .lean(),
      Participation.countDocuments({ eventId, ...(options.status ? { status: options.status } : {}) }),
    ])

    const hasMore = participations.length > options.limit
    if (hasMore) participations.pop()

    // Batch fetch user info
    const userIds = participations.map((p) => p.userId)
    const users = await User.find(
      { publicId: { $in: userIds }, deletedAt: null },
      { publicId: 1, 'profile.displayName': 1, 'profile.avatarUrl': 1 },
    ).lean()

    const userMap = new Map(
      users.map((u) => [u.publicId, u]),
    )

    const guests: GuestListItem[] = participations.map((p) => {
      const user = userMap.get(p.userId)
      return {
        publicId: p.publicId,
        userId: p.userId,
        displayName: (user?.profile as { displayName?: string })?.displayName ?? 'Inconnu',
        avatarUrl: (user?.profile as { avatarUrl?: string })?.avatarUrl,
        status: p.status as ParticipationStatus,
        invitedBy: p.invitedBy,
        hostNote: p.hostNote,
        checkedInAt: p.checkedInAt,
        createdAt: p.createdAt,
      }
    })

    const nextCursor = hasMore && participations.length > 0
      ? String((participations[participations.length - 1] as Record<string, unknown>)._id)
      : undefined

    return { guests, nextCursor, total }
  }
}
