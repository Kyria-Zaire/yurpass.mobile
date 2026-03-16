import { Hono } from 'hono'
import { authMiddleware } from '../middlewares/auth.middleware.js'
import { authRateLimit } from '../middlewares/rate-limit.js'
import { validate } from '../middlewares/validate.js'
import { AuthService } from '../services/auth.service.js'
import { handleApiError } from '../middlewares/error-handler.js'
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verify2FASchema,
  login2FASchema,
} from '@yurpass/validators'
import { z } from 'zod'

const refreshTokenSchema = z.object({ refreshToken: z.string().min(1) })

const authRoutes = new Hono()

// ─── POST /auth/register ─────────────────────────────────
authRoutes.post('/register', authRateLimit, validate(registerSchema), async (c) => {
  try {
    const body = c.get('validatedBody' as never) as z.infer<typeof registerSchema>
    await AuthService.register(body)
    return c.json({ success: true, message: 'Email de vérification envoyé' }, 201)
  } catch (error: unknown) {
    return handleApiError(c, error)
  }
})

// ─── POST /auth/login ────────────────────────────────────
authRoutes.post('/login', authRateLimit, validate(loginSchema), async (c) => {
  try {
    const body = c.get('validatedBody' as never) as z.infer<typeof loginSchema>
    const ipAddress = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip')
    const userAgent = c.req.header('user-agent')

    const result = await AuthService.login({
      ...body,
      ipAddress,
      userAgent,
    })

    return c.json(result)
  } catch (error: unknown) {
    return handleApiError(c, error)
  }
})

// ─── POST /auth/verify-email ─────────────────────────────
authRoutes.post('/verify-email', validate(verifyEmailSchema), async (c) => {
  try {
    const { token } = c.get('validatedBody' as never) as z.infer<typeof verifyEmailSchema>
    await AuthService.verifyEmail(token)
    return c.json({ success: true, message: 'Email vérifié avec succès' })
  } catch (error: unknown) {
    return handleApiError(c, error)
  }
})

// ─── POST /auth/refresh ──────────────────────────────────
authRoutes.post('/refresh', validate(refreshTokenSchema), async (c) => {
  try {
    const { refreshToken } = c.get('validatedBody' as never) as z.infer<typeof refreshTokenSchema>
    const tokens = await AuthService.refreshToken(refreshToken)
    return c.json({ success: true, ...tokens })
  } catch (error: unknown) {
    return handleApiError(c, error)
  }
})

// ─── POST /auth/logout ───────────────────────────────────
authRoutes.post('/logout', authMiddleware, async (c) => {
  try {
    const user = c.get('user')
    const token = c.get('accessToken')
    await AuthService.logout(user.publicId, token)
    return c.json({ success: true, message: 'Déconnexion réussie' })
  } catch (error: unknown) {
    return handleApiError(c, error)
  }
})

// ─── POST /auth/2fa/setup ────────────────────────────────
authRoutes.post('/2fa/setup', authMiddleware, async (c) => {
  try {
    const user = c.get('user')
    const { TwoFactorService } = await import('../services/two-factor.service.js')
    const result = await TwoFactorService.setup(user.publicId)
    return c.json({ success: true, ...result })
  } catch (error: unknown) {
    return handleApiError(c, error)
  }
})

// ─── POST /auth/2fa/verify ───────────────────────────────
authRoutes.post('/2fa/verify', authMiddleware, validate(verify2FASchema), async (c) => {
  try {
    const user = c.get('user')
    const { code } = c.get('validatedBody' as never) as z.infer<typeof verify2FASchema>
    const { TwoFactorService } = await import('../services/two-factor.service.js')
    await TwoFactorService.verify(user.publicId, code)
    return c.json({ success: true, message: '2FA activé avec succès' })
  } catch (error: unknown) {
    return handleApiError(c, error)
  }
})

// ─── POST /auth/2fa/login ────────────────────────────────
authRoutes.post('/2fa/login', authRateLimit, validate(login2FASchema), async (c) => {
  try {
    const { tempToken, code } = c.get('validatedBody' as never) as z.infer<typeof login2FASchema>
    const ipAddress = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip')
    const userAgent = c.req.header('user-agent')

    const { TwoFactorService } = await import('../services/two-factor.service.js')
    const result = await TwoFactorService.loginWith2FA(tempToken, code, ipAddress, userAgent)
    return c.json({ success: true, ...result })
  } catch (error: unknown) {
    return handleApiError(c, error)
  }
})

// ─── POST /auth/forgot-password ──────────────────────────
authRoutes.post('/forgot-password', authRateLimit, validate(forgotPasswordSchema), async (c) => {
  try {
    const { email } = c.get('validatedBody' as never) as z.infer<typeof forgotPasswordSchema>
    await AuthService.forgotPassword(email)
    return c.json({
      success: true,
      message: 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.',
    })
  } catch (error: unknown) {
    return handleApiError(c, error)
  }
})

// ─── POST /auth/reset-password ───────────────────────────
authRoutes.post('/reset-password', authRateLimit, validate(resetPasswordSchema), async (c) => {
  try {
    const { token, password } = c.get('validatedBody' as never) as z.infer<typeof resetPasswordSchema>
    await AuthService.resetPassword(token, password)
    return c.json({ success: true, message: 'Mot de passe réinitialisé avec succès' })
  } catch (error: unknown) {
    return handleApiError(c, error)
  }
})

// ─── DELETE /auth/account ────────────────────────────────
authRoutes.delete('/account', authMiddleware, async (c) => {
  try {
    const user = c.get('user')
    await AuthService.deleteAccount(user.publicId)
    return c.json({ success: true, message: 'Compte supprimé. Anonymisation dans 30 jours.' })
  } catch (error: unknown) {
    return handleApiError(c, error)
  }
})

// ─── GET /auth/me ────────────────────────────────────────
authRoutes.get('/me', authMiddleware, async (c) => {
  try {
    const user = c.get('user')
    const profile = await AuthService.getMe(user.publicId)
    return c.json({ success: true, data: profile })
  } catch (error: unknown) {
    return handleApiError(c, error)
  }
})

export { authRoutes }
