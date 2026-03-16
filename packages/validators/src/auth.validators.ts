import { z } from 'zod'
import { emailSchema, passwordSchema } from './base.js'

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z
    .string()
    .min(2, 'Le nom doit contenir au moins 2 caractères')
    .max(50, 'Le nom ne doit pas dépasser 50 caractères')
    .trim(),
  city: z
    .string()
    .min(2, 'La ville doit contenir au moins 2 caractères')
    .max(100, 'La ville ne doit pas dépasser 100 caractères')
    .trim(),
})

export type RegisterSchemaInput = z.infer<typeof registerSchema>

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Le mot de passe est requis'),
})

export type LoginSchemaInput = z.infer<typeof loginSchema>

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token requis'),
})

export const verify2FASchema = z.object({
  code: z
    .string()
    .length(6, 'Le code doit contenir exactement 6 chiffres')
    .regex(/^\d{6}$/, 'Le code doit être numérique'),
})

export const login2FASchema = z.object({
  tempToken: z.string().min(1, 'Token temporaire requis'),
  code: z
    .string()
    .length(6, 'Le code doit contenir exactement 6 chiffres')
    .regex(/^\d{6}$/, 'Le code doit être numérique'),
})

export const forgotPasswordSchema = z.object({
  email: emailSchema,
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token requis'),
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
})

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
