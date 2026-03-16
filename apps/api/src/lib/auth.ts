import { betterAuth } from 'better-auth'
import { mongodbAdapter } from '@better-auth/mongo-adapter'
import { twoFactor } from 'better-auth/plugins'
import mongoose from 'mongoose'
import { env } from './env.js'

// Mongoose bundles its own mongodb types — cast needed for adapter compatibility
const db = mongoose.connection.getClient().db() as unknown as Parameters<typeof mongodbAdapter>[0]

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: mongodbAdapter(db),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
  },
  session: {
    expiresIn: 60 * 15,
    updateAge: 60 * 60 * 24,
  },
  trustedOrigins: [env.BETTER_AUTH_URL],
  plugins: [
    twoFactor({
      issuer: 'Yurpass',
      backupCodes: {
        length: 8,
      },
    }),
  ],
})

export type AuthInstance = typeof auth
