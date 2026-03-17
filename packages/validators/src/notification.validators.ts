import { z } from 'zod'

export const registerPushTokenSchema = z.object({
  token: z
    .string()
    .regex(
      /^ExponentPushToken\[.+\]$/,
      'Token must be a valid Expo push token (ExponentPushToken[...])',
    ),
  platform: z.enum(['ios', 'android']),
})

export const removePushTokenSchema = z.object({
  token: z
    .string()
    .regex(
      /^ExponentPushToken\[.+\]$/,
      'Token must be a valid Expo push token (ExponentPushToken[...])',
    ),
})
