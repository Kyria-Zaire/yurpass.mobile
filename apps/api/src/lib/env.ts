import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  MONGODB_URI: z
    .string()
    .min(1, 'MONGODB_URI is required')
    .refine(
      (uri) => uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://'),
      'MONGODB_URI must start with mongodb:// or mongodb+srv://',
    ),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters'),
  BETTER_AUTH_URL: z.string().url(),
  CLOUDINARY_CLOUD_NAME: z.string().optional().default(''),
  CLOUDINARY_API_KEY: z.string().optional().default(''),
  CLOUDINARY_API_SECRET: z.string().optional().default(''),
  RESEND_API_KEY: z.string().optional().default(''),
  /** Optional 32+ char key to encrypt ticket codes for guest display (QR). When set, code is stored encrypted and returned on GET my ticket. */
  TICKET_CODE_ENCRYPTION_KEY: z.string().min(32).optional(),
  /** Optional Expo access token for authenticated push API calls */
  EXPO_ACCESS_TOKEN: z.string().optional(),
})

export type Env = z.infer<typeof envSchema>

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    const formatted = result.error.format()
    const missing = Object.entries(formatted)
      .filter(([key]) => key !== '_errors')
      .map(([key, value]) => {
        const errors = value as { _errors: string[] }
        return `  ${key}: ${errors._errors.join(', ')}`
      })
      .join('\n')

    process.stderr.write(`\nFATAL: Invalid environment variables:\n${missing}\n\n`)
    process.exit(1)
  }

  return result.data
}

export const env: Env = loadEnv()
