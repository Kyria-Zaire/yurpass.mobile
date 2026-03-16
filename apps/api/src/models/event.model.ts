import { Schema, model, type Document } from 'mongoose'
import { nanoid } from 'nanoid'
import { EventStatus, AccessType } from '@yurpass/types'

interface IEventDocument extends Document {
  publicId: string
  hostId: string
  title: string
  description: string
  theme: {
    id: string
    name: string
    dresscode: string
  }
  schedule: {
    startDate: Date
    endDate: Date
    doorsOpenAt: Date
  }
  venue: {
    city: string
    address?: string
    coordinates?: {
      lat: number
      lng: number
    }
  }
  capacity: {
    max: number
    confirmed: number
    waitlist: number
  }
  access: {
    type: AccessType
    requiresContribution: boolean
    contributionDetails?: string
  }
  status: EventStatus
  samRequired: boolean
  samId?: string
  mediaUrls: string[]
  isPrivate: boolean
  deletedAt?: Date
  createdAt: Date
  updatedAt: Date
}

const eventSchema = new Schema<IEventDocument>(
  {
    publicId: {
      type: String,
      default: () => nanoid(10),
      unique: true,
    },
    hostId: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 100,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    theme: {
      id: { type: String, required: true },
      name: { type: String, required: true },
      dresscode: { type: String, required: true },
    },
    schedule: {
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
      doorsOpenAt: { type: Date, required: true },
    },
    venue: {
      city: { type: String, required: true },
      address: String,
      coordinates: {
        lat: Number,
        lng: Number,
      },
    },
    capacity: {
      max: { type: Number, required: true, min: 2, max: 500 },
      confirmed: { type: Number, default: 0 },
      waitlist: { type: Number, default: 0 },
    },
    access: {
      type: {
        type: String,
        enum: Object.values(AccessType),
        default: AccessType.INVITE_ONLY,
      },
      requiresContribution: { type: Boolean, default: false },
      contributionDetails: String,
    },
    status: {
      type: String,
      enum: Object.values(EventStatus),
      default: EventStatus.DRAFT,
    },
    samRequired: {
      type: Boolean,
      default: false,
    },
    samId: String,
    mediaUrls: [String],
    isPrivate: {
      type: Boolean,
      default: true,
    },
    deletedAt: Date,
  },
  {
    timestamps: true,
    strict: true,
  },
)

eventSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    const obj = ret as unknown as Record<string, unknown>
    delete obj._id
    delete obj.__v
    return obj
  },
})

eventSchema.index({ publicId: 1 }, { unique: true })
eventSchema.index({ hostId: 1 })
eventSchema.index({ status: 1, 'schedule.startDate': 1 })
eventSchema.index({ 'venue.city': 1, status: 1 })
eventSchema.index({ deletedAt: 1 })

export const Event = model<IEventDocument>('Event', eventSchema)
