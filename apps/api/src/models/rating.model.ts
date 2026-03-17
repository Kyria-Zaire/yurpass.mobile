import { Schema, model, type Document } from 'mongoose'
import { nanoid } from 'nanoid'
import { RatingRole } from '@yurpass/types'

interface IRatingDocument extends Document {
  publicId: string
  fromUserId: string
  toUserId: string
  eventId: string
  role: RatingRole
  score: number
  comment?: string
  isVisible: boolean
  createdAt: Date
  updatedAt: Date
}

const ratingSchema = new Schema<IRatingDocument>(
  {
    publicId: {
      type: String,
      default: () => nanoid(10),
      unique: true,
    },
    fromUserId: {
      type: String,
      required: true,
    },
    toUserId: {
      type: String,
      required: true,
    },
    eventId: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: Object.values(RatingRole),
      required: true,
    },
    score: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      maxlength: 300,
      trim: true,
    },
    isVisible: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    strict: true,
  },
)

ratingSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    const obj = ret as unknown as Record<string, unknown>
    delete obj._id
    delete obj.__v
    return obj
  },
})

ratingSchema.index({ publicId: 1 }, { unique: true })
ratingSchema.index({ fromUserId: 1, eventId: 1, role: 1 }, { unique: true })
ratingSchema.index({ toUserId: 1, role: 1, createdAt: -1 })
ratingSchema.index({ eventId: 1 })

export const Rating = model<IRatingDocument>('Rating', ratingSchema)
