import { Schema, model, type Document } from 'mongoose'
import { nanoid } from 'nanoid'
import { ParticipationStatus } from '@yurpass/types'

interface IParticipationDocument extends Document {
  publicId: string
  userId: string
  eventId: string
  status: ParticipationStatus
  contribution?: {
    type: string
    validated: boolean
    validatedBy?: string
  }
  accessCode?: {
    code: string
    generatedAt: Date
    usedAt?: Date
    invalidated: boolean
  }
  invitedBy?: string
  hostNote?: string
  checkedInAt?: Date
  createdAt: Date
  updatedAt: Date
}

const participationSchema = new Schema<IParticipationDocument>(
  {
    publicId: {
      type: String,
      default: () => nanoid(10),
      unique: true,
    },
    userId: {
      type: String,
      required: true,
    },
    eventId: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(ParticipationStatus),
      default: ParticipationStatus.PENDING,
    },
    contribution: {
      type: { type: String },
      validated: { type: Boolean, default: false },
      validatedBy: String,
    },
    accessCode: {
      code: String,
      generatedAt: Date,
      usedAt: Date,
      invalidated: { type: Boolean, default: false },
    },
    invitedBy: String,
    hostNote: { type: String, maxlength: 500 },
    checkedInAt: Date,
  },
  {
    timestamps: true,
    strict: true,
  },
)

participationSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    const obj = ret as unknown as Record<string, unknown>
    delete obj._id
    delete obj.__v
    delete obj.accessCode
    delete obj.hostNote
    return obj
  },
})

participationSchema.index({ publicId: 1 }, { unique: true })
participationSchema.index({ userId: 1, eventId: 1 }, { unique: true })
participationSchema.index({ eventId: 1, status: 1 })
participationSchema.index({ userId: 1, status: 1 })

export const Participation = model<IParticipationDocument>('Participation', participationSchema)
