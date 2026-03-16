import { Schema, model, type Document } from 'mongoose'
import { nanoid } from 'nanoid'
import { UserRole, SubscriptionPlan } from '@yurpass/types'

interface IUserDocument extends Document {
  publicId: string
  email: string
  passwordHash: string
  roles: UserRole[]
  profile: {
    displayName: string
    avatarUrl?: string
    bio?: string
    city: string
    verifiedAt?: Date
  }
  reputation: {
    score: number
    totalRatings: number
    avgRating: number
  }
  security: {
    twoFactorEnabled: boolean
    twoFactorSecret?: string
    loginAttempts: number
    lockedUntil?: Date
    lastLoginAt?: Date
    lastLoginIp?: string
  }
  subscription: {
    plan: SubscriptionPlan
    expiresAt?: Date
  }
  deletedAt?: Date
  createdAt: Date
  updatedAt: Date
}

const userSchema = new Schema<IUserDocument>(
  {
    publicId: {
      type: String,
      default: () => nanoid(10),
      unique: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    roles: [
      {
        type: String,
        enum: Object.values(UserRole),
        required: true,
      },
    ],
    profile: {
      displayName: { type: String, required: true },
      avatarUrl: String,
      bio: { type: String, maxlength: 500 },
      city: { type: String, required: true },
      verifiedAt: Date,
    },
    reputation: {
      score: { type: Number, default: 0, min: 0, max: 100 },
      totalRatings: { type: Number, default: 0 },
      avgRating: { type: Number, default: 0, min: 0, max: 5 },
    },
    security: {
      twoFactorEnabled: { type: Boolean, default: false },
      twoFactorSecret: String,
      loginAttempts: { type: Number, default: 0 },
      lockedUntil: Date,
      lastLoginAt: Date,
      lastLoginIp: String,
    },
    subscription: {
      plan: {
        type: String,
        enum: Object.values(SubscriptionPlan),
        default: SubscriptionPlan.FREE,
      },
      expiresAt: Date,
    },
    deletedAt: Date,
  },
  {
    timestamps: true,
    strict: true,
  },
)

userSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    const obj = ret as unknown as Record<string, unknown>
    delete obj._id
    delete obj.__v
    delete obj.passwordHash
    delete obj.security
    return obj
  },
})

userSchema.index({ publicId: 1 }, { unique: true })
userSchema.index({ email: 1 }, { unique: true })
userSchema.index({ roles: 1 })
userSchema.index({ 'profile.city': 1 })
userSchema.index({ deletedAt: 1 })

export const User = model<IUserDocument>('User', userSchema)
