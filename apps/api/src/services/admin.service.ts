import { User } from '../models/user.model.js'
import { Event } from '../models/event.model.js'
import { AuditLog } from '../models/audit-log.model.js'
import { Media } from '../models/media.model.js'
import { SamMission } from '../models/sam-mission.model.js'
import { logger } from '../lib/logger.js'
import {
  UserRole,
  EventStatus,
  AuditAction,
  AuditResult,
} from '@yurpass/types'
import { NotFoundError, AppError } from '../middlewares/error-handler.js'

// ─── Types ────────────────────────────────────────────────

interface AdminStats {
  users: {
    total: number
    byRole: Record<string, number>
    banned: number
    suspended: number
  }
  events: {
    total: number
    byStatus: Record<string, number>
  }
  media: {
    pendingModeration: number
  }
  incidents: {
    unresolvedUrgent: number
  }
}

interface CursorPage<T> {
  items: T[]
  nextCursor: string | null
}

// ─── Service ──────────────────────────────────────────────

export class AdminService {
  // ─── Dashboard stats ──────────────────────────────────────

  static async getStats(): Promise<AdminStats> {
    const [
      totalUsers,
      bannedCount,
      suspendedUsers,
      guestCount,
      hostCount,
      samCount,
      modelCount,
      adminCount,
      totalEvents,
      draftEvents,
      publishedEvents,
      fullEvents,
      ongoingEvents,
      completedEvents,
      cancelledEvents,
      pendingMedia,
      unresolvedUrgent,
    ] = await Promise.all([
      User.countDocuments({ deletedAt: null }),
      User.countDocuments({ deletedAt: { $ne: null } }),
      User.countDocuments({ deletedAt: null, 'security.lockedUntil': { $gt: new Date() } }),
      User.countDocuments({ deletedAt: null, roles: UserRole.GUEST }),
      User.countDocuments({ deletedAt: null, roles: UserRole.HOST }),
      User.countDocuments({ deletedAt: null, roles: UserRole.SAM }),
      User.countDocuments({ deletedAt: null, roles: UserRole.MODEL }),
      User.countDocuments({ deletedAt: null, roles: UserRole.ADMIN }),
      Event.countDocuments({ deletedAt: null }),
      Event.countDocuments({ deletedAt: null, status: EventStatus.DRAFT }),
      Event.countDocuments({ deletedAt: null, status: EventStatus.PUBLISHED }),
      Event.countDocuments({ deletedAt: null, status: EventStatus.FULL }),
      Event.countDocuments({ deletedAt: null, status: EventStatus.ONGOING }),
      Event.countDocuments({ deletedAt: null, status: EventStatus.COMPLETED }),
      Event.countDocuments({ deletedAt: null, status: EventStatus.CANCELLED }),
      Media.countDocuments({ status: 'pending', deletedAt: null }),
      SamMission.countDocuments({ 'incidents.level': 'urgent', 'incidents.resolvedAt': null }),
    ])

    return {
      users: {
        total: totalUsers,
        byRole: {
          guest: guestCount,
          host: hostCount,
          sam: samCount,
          model: modelCount,
          admin: adminCount,
        },
        banned: bannedCount,
        suspended: suspendedUsers,
      },
      events: {
        total: totalEvents,
        byStatus: {
          draft: draftEvents,
          published: publishedEvents,
          full: fullEvents,
          ongoing: ongoingEvents,
          completed: completedEvents,
          cancelled: cancelledEvents,
        },
      },
      media: {
        pendingModeration: pendingMedia,
      },
      incidents: {
        unresolvedUrgent: unresolvedUrgent,
      },
    }
  }

  // ─── Get users (cursor-based pagination + filters) ────────

  static async getUsers(options: {
    cursor?: string
    limit: number
    role?: string
    search?: string
    status?: 'active' | 'banned' | 'suspended'
  }): Promise<CursorPage<Record<string, unknown>>> {
    const { cursor, limit, role, search, status } = options

    const filter: Record<string, unknown> = {}

    // Status filter
    if (status === 'banned') {
      filter.deletedAt = { $ne: null }
    } else if (status === 'suspended') {
      filter.deletedAt = null
      filter['security.lockedUntil'] = { $gt: new Date() }
    } else if (status === 'active') {
      filter.deletedAt = null
      filter.$or = [
        { 'security.lockedUntil': null },
        { 'security.lockedUntil': { $lte: new Date() } },
      ]
    }

    // Role filter
    if (role) {
      filter.roles = role
    }

    // Search by displayName or email (partial, case-insensitive)
    if (search) {
      const regex = { $regex: search, $options: 'i' }
      if (filter.$or) {
        // status=active already uses $or, combine with $and
        filter.$and = [
          { $or: filter.$or as Record<string, unknown>[] },
          { $or: [{ 'profile.displayName': regex }, { email: regex }] },
        ]
        delete filter.$or
      } else {
        filter.$or = [{ 'profile.displayName': regex }, { email: regex }]
      }
    }

    // Cursor-based pagination (using publicId as cursor)
    if (cursor) {
      const cursorUser = await User.findOne({ publicId: cursor }, { _id: 1 }).lean()
      if (cursorUser) {
        filter._id = { $gt: cursorUser._id }
      }
    }

    const users = await User.find(filter)
      .sort({ _id: 1 })
      .limit(limit + 1)
      .select('publicId email roles profile.displayName profile.city profile.avatarUrl reputation security.lockedUntil deletedAt createdAt')
      .lean()

    const hasMore = users.length > limit
    const items = hasMore ? users.slice(0, limit) : users

    return {
      items: items.map((u) => ({
        publicId: u.publicId,
        email: u.email,
        roles: u.roles,
        displayName: u.profile.displayName,
        city: u.profile.city,
        avatarUrl: u.profile.avatarUrl,
        reputation: u.reputation,
        suspended: u.security?.lockedUntil ? new Date(u.security.lockedUntil) > new Date() : false,
        banned: u.deletedAt != null,
        createdAt: u.createdAt,
      })),
      nextCursor: hasMore ? items[items.length - 1].publicId : null,
    }
  }

  // ─── Ban user (soft delete) ───────────────────────────────

  static async banUser(
    targetId: string,
    adminId: string,
    reason: string,
  ): Promise<void> {
    const user = await User.findOne({ publicId: targetId })
    if (!user) {
      throw new NotFoundError('Utilisateur introuvable')
    }

    if (user.deletedAt) {
      throw new AppError('Cet utilisateur est déjà banni', 422, 'ALREADY_BANNED')
    }

    // Prevent banning other admins
    if (user.roles.includes(UserRole.ADMIN)) {
      throw new AppError('Impossible de bannir un administrateur', 403, 'CANNOT_BAN_ADMIN')
    }

    // Soft delete (ban)
    await User.updateOne(
      { _id: user._id },
      { $set: { deletedAt: new Date() } },
    )

    await AuditLog.create({
      action: AuditAction.USER_BANNED,
      userId: adminId,
      targetId,
      metadata: { reason },
      result: AuditResult.SUCCESS,
    })

    logger.info({ targetId, adminId }, 'User banned')
  }

  // ─── Suspend user (temporary lock) ────────────────────────

  static async suspendUser(
    targetId: string,
    adminId: string,
    reason: string,
    until: string,
  ): Promise<void> {
    const user = await User.findOne({ publicId: targetId, deletedAt: null })
    if (!user) {
      throw new NotFoundError('Utilisateur introuvable')
    }

    if (user.roles.includes(UserRole.ADMIN)) {
      throw new AppError('Impossible de suspendre un administrateur', 403, 'CANNOT_SUSPEND_ADMIN')
    }

    const untilDate = new Date(until)
    if (untilDate <= new Date()) {
      throw new AppError('La date de fin doit être dans le futur', 422, 'INVALID_DATE')
    }

    await User.updateOne(
      { _id: user._id },
      { $set: { 'security.lockedUntil': untilDate } },
    )

    await AuditLog.create({
      action: AuditAction.USER_SUSPENDED,
      userId: adminId,
      targetId,
      metadata: { reason, until: untilDate.toISOString() },
      result: AuditResult.SUCCESS,
    })

    logger.info({ targetId, adminId, until }, 'User suspended')
  }

  // ─── Restore user (unban / unsuspend) ─────────────────────

  static async restoreUser(
    targetId: string,
    adminId: string,
    reason: string,
  ): Promise<void> {
    const user = await User.findOne({ publicId: targetId })
    if (!user) {
      throw new NotFoundError('Utilisateur introuvable')
    }

    const isBanned = user.deletedAt != null
    const isSuspended = user.security?.lockedUntil && new Date(user.security.lockedUntil) > new Date()

    if (!isBanned && !isSuspended) {
      throw new AppError('Cet utilisateur n\'est ni banni ni suspendu', 422, 'NOT_RESTRICTED')
    }

    const update: Record<string, unknown> = {}
    if (isBanned) {
      update.deletedAt = null
    }
    if (isSuspended) {
      update['security.lockedUntil'] = null
    }

    await User.updateOne({ _id: user._id }, { $set: update })

    await AuditLog.create({
      action: AuditAction.USER_RESTORED,
      userId: adminId,
      targetId,
      metadata: { reason, wasBanned: isBanned, wasSuspended: !!isSuspended },
      result: AuditResult.SUCCESS,
    })

    logger.info({ targetId, adminId }, 'User restored')
  }

  // ─── Get pending content (photos + reported users) ────────

  static async getPendingContent(): Promise<{
    photos: Record<string, unknown>[]
    total: number
  }> {
    const photos = await Media.find({
      status: 'pending',
      deletedAt: null,
    })
      .sort({ createdAt: 1 })
      .limit(50)
      .lean()

    return {
      photos: photos.map((p) => ({
        publicId: p.publicId,
        eventId: p.eventId,
        uploadedBy: p.uploadedBy,
        url: p.url,
        width: p.width,
        height: p.height,
        status: p.status,
        createdAt: p.createdAt,
      })),
      total: photos.length,
    }
  }

  // ─── Certify SAM ─────────────────────────────────────────

  static async certifySAM(
    targetId: string,
    adminId: string,
  ): Promise<void> {
    const user = await User.findOne({ publicId: targetId, deletedAt: null })
    if (!user) {
      throw new NotFoundError('Utilisateur introuvable')
    }

    if (!user.roles.includes(UserRole.SAM)) {
      throw new AppError('Cet utilisateur n\'a pas le rôle SAM', 422, 'NOT_SAM')
    }

    if (user.profile.verifiedAt) {
      throw new AppError('Ce SAM est déjà certifié', 422, 'ALREADY_CERTIFIED')
    }

    await User.updateOne(
      { _id: user._id },
      { $set: { 'profile.verifiedAt': new Date() } },
    )

    await AuditLog.create({
      action: AuditAction.SAM_CERTIFIED,
      userId: adminId,
      targetId,
      metadata: {},
      result: AuditResult.SUCCESS,
    })

    logger.info({ targetId, adminId }, 'SAM certified')
  }

  // ─── Audit logs (cursor-based pagination) ─────────────────

  static async getAuditLogs(options: {
    cursor?: string
    limit: number
    action?: string
    userId?: string
  }): Promise<CursorPage<Record<string, unknown>>> {
    const { cursor, limit, action, userId } = options

    const filter: Record<string, unknown> = {}

    if (action) {
      filter.action = action
    }
    if (userId) {
      filter.userId = userId
    }

    if (cursor) {
      const cursorLog = await AuditLog.findOne({ _id: cursor }).lean()
      if (cursorLog) {
        filter._id = { $lt: cursorLog._id }
      }
    }

    const logs = await AuditLog.find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean()

    const hasMore = logs.length > limit
    const items = hasMore ? logs.slice(0, limit) : logs

    return {
      items: items.map((l) => ({
        id: (l._id as { toString(): string }).toString(),
        action: l.action,
        userId: l.userId,
        targetId: l.targetId,
        eventId: l.eventId,
        metadata: l.metadata,
        result: l.result,
        createdAt: l.createdAt,
      })),
      nextCursor: hasMore ? (items[items.length - 1]._id as { toString(): string }).toString() : null,
    }
  }

  // ─── Get incidents ────────────────────────────────────────

  static async getIncidents(options: {
    cursor?: string
    limit: number
    level?: string
  }): Promise<CursorPage<Record<string, unknown>>> {
    const { cursor, limit, level } = options

    const filter: Record<string, unknown> = {
      'incidents.0': { $exists: true },
    }

    if (level) {
      filter['incidents.level'] = level
    }

    if (cursor) {
      const cursorMission = await SamMission.findOne({ publicId: cursor }, { _id: 1 }).lean()
      if (cursorMission) {
        filter._id = { $lt: cursorMission._id }
      }
    }

    const missions = await SamMission.find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean()

    const hasMore = missions.length > limit
    const items = hasMore ? missions.slice(0, limit) : missions

    return {
      items: items.map((m) => ({
        missionId: m.publicId,
        eventId: m.eventId,
        samId: m.samId,
        status: m.status,
        incidents: m.incidents,
        createdAt: m.createdAt,
      })),
      nextCursor: hasMore ? items[items.length - 1].publicId : null,
    }
  }
}
