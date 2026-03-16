import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UserRole, AuditAction } from '@yurpass/types'

// ─── Mocks ──────────────────────────────────────────────

const mockUser = {
  findOne: vi.fn(),
  updateOne: vi.fn(),
}

const mockAuditLog = {
  create: vi.fn(),
}

vi.mock('../../models/user.model.js', () => ({
  User: {
    findOne: (...args: unknown[]) => mockUser.findOne(...args),
    updateOne: (...args: unknown[]) => mockUser.updateOne(...args),
  },
}))

vi.mock('../../models/audit-log.model.js', () => ({
  AuditLog: {
    create: (...args: unknown[]) => mockAuditLog.create(...args),
  },
}))

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const { RoleService } = await import('../role.service.js')

// ─── Tests ──────────────────────────────────────────────

describe('RoleService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('requestRole', () => {
    it('should reject admin role request', async () => {
      await expect(
        RoleService.requestRole('user123', UserRole.ADMIN),
      ).rejects.toThrow('Le rôle admin ne peut pas être demandé via cette route')
    })

    it('should auto-grant model role', async () => {
      mockUser.findOne.mockResolvedValue({
        _id: 'id',
        publicId: 'user123',
        roles: [UserRole.GUEST],
        security: { twoFactorEnabled: false },
      })
      mockUser.updateOne.mockResolvedValue({})

      const result = await RoleService.requestRole('user123', UserRole.MODEL)

      expect(result.granted).toBe(true)
      expect(mockUser.updateOne).toHaveBeenCalledWith(
        expect.anything(),
        { $addToSet: { roles: UserRole.MODEL } },
      )
      expect(mockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.ROLE_GRANTED,
          metadata: expect.objectContaining({ role: UserRole.MODEL }),
        }),
      )
    })

    it('should require 2FA for host role', async () => {
      mockUser.findOne.mockResolvedValue({
        _id: 'id',
        publicId: 'user123',
        roles: [UserRole.GUEST],
        security: { twoFactorEnabled: false },
      })

      await expect(
        RoleService.requestRole('user123', UserRole.HOST),
      ).rejects.toThrow('2FA requis pour devenir hôte')
    })

    it('should auto-grant host role when 2FA is enabled', async () => {
      mockUser.findOne.mockResolvedValue({
        _id: 'id',
        publicId: 'user123',
        roles: [UserRole.GUEST],
        security: { twoFactorEnabled: true },
      })
      mockUser.updateOne.mockResolvedValue({})

      const result = await RoleService.requestRole('user123', UserRole.HOST)

      expect(result.granted).toBe(true)
    })

    it('should set SAM role as pending (requires admin)', async () => {
      mockUser.findOne.mockResolvedValue({
        _id: 'id',
        publicId: 'user123',
        roles: [UserRole.GUEST],
        security: { twoFactorEnabled: false },
      })

      const result = await RoleService.requestRole('user123', UserRole.SAM)

      expect(result.granted).toBe(false)
      expect(result.message).toContain('attente de validation')
      expect(mockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.ROLE_REQUESTED,
          metadata: expect.objectContaining({ role: UserRole.SAM, status: 'pending' }),
        }),
      )
    })

    it('should reject if user already has the role', async () => {
      mockUser.findOne.mockResolvedValue({
        _id: 'id',
        publicId: 'user123',
        roles: [UserRole.GUEST, UserRole.MODEL],
        security: { twoFactorEnabled: false },
      })

      await expect(
        RoleService.requestRole('user123', UserRole.MODEL),
      ).rejects.toThrow('Vous avez déjà ce rôle')
    })
  })

  describe('checkRoleConflict', () => {
    it('should detect HOST/SAM conflict on same event', () => {
      const result = RoleService.checkRoleConflict(
        [UserRole.GUEST, UserRole.HOST],
        UserRole.SAM,
        'host123',
        'host123',
      )

      expect(result.conflict).toBe(true)
      expect(result.reason).toContain('hôte ne peut pas être SAM')
    })

    it('should allow HOST/SAM on different events', () => {
      const result = RoleService.checkRoleConflict(
        [UserRole.GUEST, UserRole.HOST],
        UserRole.SAM,
        'otherHost',
        'user123',
      )

      expect(result.conflict).toBe(false)
    })
  })

  describe('grantRole (admin)', () => {
    it('should throw if user not found', async () => {
      mockUser.findOne.mockResolvedValue(null)

      await expect(
        RoleService.grantRole('unknownUser', UserRole.SAM, 'admin1'),
      ).rejects.toThrow('Utilisateur introuvable')
    })

    it('should throw if user already has role', async () => {
      mockUser.findOne.mockResolvedValue({
        _id: 'id',
        publicId: 'user123',
        roles: [UserRole.GUEST, UserRole.SAM],
        security: { twoFactorEnabled: false },
      })

      await expect(
        RoleService.grantRole('user123', UserRole.SAM, 'admin1'),
      ).rejects.toThrow('L\'utilisateur a déjà ce rôle')
    })

    it('should grant role and create audit log', async () => {
      mockUser.findOne.mockResolvedValue({
        _id: 'id',
        publicId: 'user123',
        roles: [UserRole.GUEST],
        security: { twoFactorEnabled: false },
      })
      mockUser.updateOne.mockResolvedValue({})

      await RoleService.grantRole('user123', UserRole.SAM, 'admin1')

      expect(mockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.ROLE_GRANTED,
          metadata: expect.objectContaining({
            role: UserRole.SAM,
            grantedBy: 'admin1',
            method: 'admin_grant',
          }),
        }),
      )
    })
  })
})
