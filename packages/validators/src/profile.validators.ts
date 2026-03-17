import { z } from 'zod'

export const updateProfileSchema = z
  .object({
    displayName: z
      .string()
      .min(2, 'Le nom doit contenir au moins 2 caractères')
      .max(50, 'Le nom ne doit pas dépasser 50 caractères')
      .trim()
      .optional(),
    bio: z
      .string()
      .max(500, 'La bio ne doit pas dépasser 500 caractères')
      .optional(),
    city: z
      .string()
      .min(2, 'La ville doit contenir au moins 2 caractères')
      .max(100, 'La ville ne doit pas dépasser 100 caractères')
      .trim()
      .optional(),
  })
  .refine(
    (data) =>
      data.displayName !== undefined ||
      data.bio !== undefined ||
      data.city !== undefined,
    {
      message: 'Aucun champ à mettre à jour',
    },
  )
