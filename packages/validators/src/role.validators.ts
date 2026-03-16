import { z } from 'zod'

export const requestRoleSchema = z.object({
  role: z.enum(['host', 'model', 'sam'], {
    errorMap: () => ({ message: 'Rôle invalide. Valeurs acceptées : host, model, sam' }),
  }),
})

export type RequestRoleInput = z.infer<typeof requestRoleSchema>

export const grantRoleSchema = z.object({
  userId: z.string().min(1, 'userId requis'),
  role: z.enum(['guest', 'host', 'model', 'sam'], {
    errorMap: () => ({ message: 'Rôle invalide' }),
  }),
})

export type GrantRoleInput = z.infer<typeof grantRoleSchema>
