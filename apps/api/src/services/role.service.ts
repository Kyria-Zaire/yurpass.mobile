import { User } from '../models/user.model.js'
import { AuditLog } from '../models/audit-log.model.js'
import { logger } from '../lib/logger.js'
import { AppError } from '../middlewares/error-handler.js'
import { AuditAction, AuditResult, UserRole } from '@yurpass/types'

export class RoleService {
  static async requestRole(
    publicId: string,
    role: string,
  ): Promise<{ granted: boolean; message: string }> {
    if (role === UserRole.ADMIN) {
      throw new AppError(
        'Le rôle admin ne peut pas être demandé via cette route',
        403,
        'FORBIDDEN',
      )
    }

    const user = await User.findOne({ publicId, deletedAt: null })
    if (!user) {
      throw new AppError('Utilisateur introuvable', 404, 'NOT_FOUND')
    }

    if (user.roles.includes(role as UserRole)) {
      throw new AppError('Vous avez déjà ce rôle', 400, 'ROLE_ALREADY_ASSIGNED')
    }

    // HOST requires 2FA
    if (role === UserRole.HOST) {
      if (!user.security.twoFactorEnabled) {
        throw new AppError(
          '2FA requis pour devenir hôte. Activez la double authentification.',
          403,
          '2FA_REQUIRED_FOR_HOST',
        )
      }

      await User.updateOne(
        { _id: user._id },
        { $addToSet: { roles: UserRole.HOST } },
      )

      await AuditLog.create({
        action: AuditAction.ROLE_GRANTED,
        userId: publicId,
        metadata: { role: UserRole.HOST, method: 'self_request' },
        result: AuditResult.SUCCESS,
      })

      logger.info({ publicId, role: UserRole.HOST }, 'Role granted')
      return { granted: true, message: 'Rôle hôte attribué avec succès' }
    }

    // MODEL is auto-granted
    if (role === UserRole.MODEL) {
      await User.updateOne(
        { _id: user._id },
        { $addToSet: { roles: UserRole.MODEL } },
      )

      await AuditLog.create({
        action: AuditAction.ROLE_GRANTED,
        userId: publicId,
        metadata: { role: UserRole.MODEL, method: 'self_request' },
        result: AuditResult.SUCCESS,
      })

      logger.info({ publicId, role: UserRole.MODEL }, 'Role granted')
      return { granted: true, message: 'Rôle ambassadeur attribué avec succès' }
    }

    // SAM requires admin validation
    if (role === UserRole.SAM) {
      await AuditLog.create({
        action: AuditAction.ROLE_REQUESTED,
        userId: publicId,
        metadata: { role: UserRole.SAM, status: 'pending' },
        result: AuditResult.SUCCESS,
      })

      logger.info({ publicId, role: UserRole.SAM }, 'SAM role requested, pending admin validation')
      return { granted: false, message: 'Demande en attente de validation par l\'équipe Yurpass' }
    }

    throw new AppError('Rôle non reconnu', 400, 'INVALID_ROLE')
  }

  static async grantRole(
    userId: string,
    role: UserRole,
    grantedBy: string,
  ): Promise<void> {
    const user = await User.findOne({ publicId: userId, deletedAt: null })
    if (!user) {
      throw new AppError('Utilisateur introuvable', 404, 'NOT_FOUND')
    }

    if (user.roles.includes(role)) {
      throw new AppError('L\'utilisateur a déjà ce rôle', 400, 'ROLE_ALREADY_ASSIGNED')
    }

    if (role === UserRole.HOST && !user.security.twoFactorEnabled) {
      throw new AppError(
        'L\'utilisateur doit activer le 2FA avant de devenir hôte',
        403,
        '2FA_REQUIRED_FOR_HOST',
      )
    }

    await User.updateOne(
      { _id: user._id },
      { $addToSet: { roles: role } },
    )

    await AuditLog.create({
      action: AuditAction.ROLE_GRANTED,
      userId,
      metadata: { role, grantedBy, method: 'admin_grant' },
      result: AuditResult.SUCCESS,
    })

    logger.info({ userId, role, grantedBy }, 'Role granted by admin')
  }

  static async revokeRole(
    userId: string,
    role: UserRole,
    revokedBy: string,
  ): Promise<void> {
    const user = await User.findOne({ publicId: userId, deletedAt: null })
    if (!user) {
      throw new AppError('Utilisateur introuvable', 404, 'NOT_FOUND')
    }

    if (!user.roles.includes(role)) {
      throw new AppError('L\'utilisateur n\'a pas ce rôle', 400, 'ROLE_NOT_ASSIGNED')
    }

    await User.updateOne(
      { _id: user._id },
      { $pull: { roles: role } },
    )

    await AuditLog.create({
      action: AuditAction.ROLE_REVOKED,
      userId,
      metadata: { role, revokedBy },
      result: AuditResult.SUCCESS,
    })

    logger.info({ userId, role, revokedBy }, 'Role revoked')
  }

  static checkRoleConflict(
    userRoles: UserRole[],
    requestedRole: UserRole,
    eventHostId?: string,
    userId?: string,
  ): { conflict: boolean; reason?: string } {
    // RB-006: HOST cannot be SAM on same event
    if (requestedRole === UserRole.SAM && eventHostId === userId) {
      return {
        conflict: true,
        reason: 'Un hôte ne peut pas être SAM de son propre événement',
      }
    }

    if (requestedRole === UserRole.HOST && userRoles.includes(UserRole.SAM)) {
      // Allowed — they can have both roles, just not on the same event
    }

    return { conflict: false }
  }

  static async getMyRoles(publicId: string): Promise<{
    roles: UserRole[]
    twoFactorEnabled: boolean
  }> {
    const user = await User.findOne(
      { publicId, deletedAt: null },
      { roles: 1, 'security.twoFactorEnabled': 1 },
    )

    if (!user) {
      throw new AppError('Utilisateur introuvable', 404, 'NOT_FOUND')
    }

    return {
      roles: user.roles as UserRole[],
      twoFactorEnabled: user.security.twoFactorEnabled,
    }
  }
}
