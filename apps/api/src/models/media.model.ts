import { Schema, model, type Document } from 'mongoose'
import { nanoid } from 'nanoid'

export type MediaStatus = 'pending' | 'approved' | 'rejected'

interface IMediaDocument extends Document {
  publicId: string
  eventId: string
  uploadedBy: string
  cloudinaryId: string
  url: string
  width: number
  height: number
  status: MediaStatus
  deletedAt?: Date
  createdAt: Date
  updatedAt: Date
}

const mediaSchema = new Schema<IMediaDocument>(
  {
    publicId: {
      type: String,
      default: () => nanoid(10),
      unique: true,
    },
    eventId: {
      type: String,
      required: true,
    },
    uploadedBy: {
      type: String,
      required: true,
    },
    cloudinaryId: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    width: {
      type: Number,
      required: true,
    },
    height: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      required: true,
    },
    deletedAt: Date,
  },
  {
    timestamps: true,
    strict: true,
  },
)

mediaSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    const obj = ret as unknown as Record<string, unknown>
    delete obj._id
    delete obj.__v
    delete obj.cloudinaryId
    return obj
  },
})

mediaSchema.index({ publicId: 1 }, { unique: true })
mediaSchema.index({ eventId: 1, status: 1 })
mediaSchema.index({ uploadedBy: 1 })

export const Media = model<IMediaDocument>('Media', mediaSchema)
