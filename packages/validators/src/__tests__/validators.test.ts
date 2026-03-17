import { describe, it, expect } from 'vitest'
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  verify2FASchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  requestRoleSchema,
  emailSchema,
  passwordSchema,
  registerPushTokenSchema,
  removePushTokenSchema,
} from '../index.js'

describe('Base Schemas', () => {
  describe('emailSchema', () => {
    it('should accept valid email and lowercase it', () => {
      const result = emailSchema.safeParse('User@Yurpass.COM')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe('user@yurpass.com')
      }
    })

    it('should reject invalid email', () => {
      expect(emailSchema.safeParse('not-an-email').success).toBe(false)
    })
  })

  describe('passwordSchema', () => {
    it('should accept strong password', () => {
      expect(passwordSchema.safeParse('MySecurePass1!').success).toBe(true)
    })

    it('should reject short password', () => {
      expect(passwordSchema.safeParse('Short1!').success).toBe(false)
    })

    it('should reject password without uppercase', () => {
      expect(passwordSchema.safeParse('mysecurepass1!').success).toBe(false)
    })

    it('should reject password without digit', () => {
      expect(passwordSchema.safeParse('MySecurePasss!').success).toBe(false)
    })

    it('should reject password without special char', () => {
      expect(passwordSchema.safeParse('MySecurePass12').success).toBe(false)
    })
  })
})

describe('Auth Validators', () => {
  describe('registerSchema', () => {
    it('should accept valid registration data', () => {
      const result = registerSchema.safeParse({
        email: 'user@yurpass.com',
        password: 'MySecurePass1!',
        displayName: 'John Doe',
        city: 'Paris',
      })
      expect(result.success).toBe(true)
    })

    it('should reject invalid email', () => {
      const result = registerSchema.safeParse({
        email: 'not-an-email',
        password: 'MySecurePass1!',
        displayName: 'John',
        city: 'Paris',
      })
      expect(result.success).toBe(false)
    })

    it('should reject short password', () => {
      const result = registerSchema.safeParse({
        email: 'user@yurpass.com',
        password: 'Short1!',
        displayName: 'John',
        city: 'Paris',
      })
      expect(result.success).toBe(false)
    })

    it('should reject empty displayName', () => {
      const result = registerSchema.safeParse({
        email: 'user@yurpass.com',
        password: 'MySecurePass1!',
        displayName: '',
        city: 'Paris',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('loginSchema', () => {
    it('should accept valid login', () => {
      expect(loginSchema.safeParse({ email: 'user@yurpass.com', password: 'any' }).success).toBe(true)
    })

    it('should reject missing email', () => {
      expect(loginSchema.safeParse({ password: 'any' }).success).toBe(false)
    })
  })

  describe('verifyEmailSchema', () => {
    it('should accept valid token', () => {
      expect(verifyEmailSchema.safeParse({ token: 'abc123' }).success).toBe(true)
    })

    it('should reject empty token', () => {
      expect(verifyEmailSchema.safeParse({ token: '' }).success).toBe(false)
    })
  })

  describe('verify2FASchema', () => {
    it('should accept 6-digit code', () => {
      expect(verify2FASchema.safeParse({ code: '123456' }).success).toBe(true)
    })

    it('should reject 5-digit code', () => {
      expect(verify2FASchema.safeParse({ code: '12345' }).success).toBe(false)
    })

    it('should reject non-numeric code', () => {
      expect(verify2FASchema.safeParse({ code: 'abcdef' }).success).toBe(false)
    })
  })

  describe('forgotPasswordSchema', () => {
    it('should accept valid email', () => {
      expect(forgotPasswordSchema.safeParse({ email: 'user@yurpass.com' }).success).toBe(true)
    })
  })

  describe('resetPasswordSchema', () => {
    it('should accept valid data with matching passwords', () => {
      const result = resetPasswordSchema.safeParse({
        token: 'valid-token',
        password: 'NewSecurePass1!',
        confirmPassword: 'NewSecurePass1!',
      })
      expect(result.success).toBe(true)
    })

    it('should reject mismatched passwords', () => {
      const result = resetPasswordSchema.safeParse({
        token: 'valid-token',
        password: 'NewSecurePass1!',
        confirmPassword: 'DifferentPass1!',
      })
      expect(result.success).toBe(false)
    })

    it('should reject weak password', () => {
      const result = resetPasswordSchema.safeParse({
        token: 'valid-token',
        password: 'weak',
        confirmPassword: 'weak',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('requestRoleSchema', () => {
    it('should accept host role', () => {
      expect(requestRoleSchema.safeParse({ role: 'host' }).success).toBe(true)
    })

    it('should accept model role', () => {
      expect(requestRoleSchema.safeParse({ role: 'model' }).success).toBe(true)
    })

    it('should accept sam role', () => {
      expect(requestRoleSchema.safeParse({ role: 'sam' }).success).toBe(true)
    })

    it('should reject invalid role', () => {
      expect(requestRoleSchema.safeParse({ role: 'superadmin' }).success).toBe(false)
    })
  })
})

describe('Notification Validators', () => {
  describe('registerPushTokenSchema', () => {
    it('should accept valid Expo push token', () => {
      const result = registerPushTokenSchema.safeParse({
        token: 'ExponentPushToken[abc123xyz]',
        platform: 'ios',
      })
      expect(result.success).toBe(true)
    })

    it('should reject invalid token format (missing prefix)', () => {
      const result = registerPushTokenSchema.safeParse({
        token: 'not-a-push-token',
        platform: 'android',
      })
      expect(result.success).toBe(false)
    })

    it('should reject empty brackets', () => {
      const result = registerPushTokenSchema.safeParse({
        token: 'ExponentPushToken[]',
        platform: 'ios',
      })
      expect(result.success).toBe(false)
    })

    it('should reject invalid platform', () => {
      const result = registerPushTokenSchema.safeParse({
        token: 'ExponentPushToken[abc]',
        platform: 'windows',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('removePushTokenSchema', () => {
    it('should accept valid token for removal', () => {
      const result = removePushTokenSchema.safeParse({
        token: 'ExponentPushToken[xyz789]',
      })
      expect(result.success).toBe(true)
    })

    it('should reject invalid token for removal', () => {
      const result = removePushTokenSchema.safeParse({
        token: 'invalid-format',
      })
      expect(result.success).toBe(false)
    })
  })
})
