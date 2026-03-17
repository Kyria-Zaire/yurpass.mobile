import { Schema, model, type Document } from 'mongoose'
import { nanoid } from 'nanoid'

export type SamMissionStatus = 'assigned' | 'confirmed' | 'active' | 'completed' | 'cancelled'
export type TripStatus = 'in-progress' | 'completed'
export type IncidentLevel = 'info' | 'warning' | 'urgent'

export interface ISamTrip {
  guestId: string
  guestName: string
  destination: string
  departureTime: Date
  arrivalConfirmedAt?: Date
  status: TripStatus
}

export interface ISamIncident {
  description: string
  level: IncidentLevel
  reportedAt: Date
  resolvedAt?: Date
}

interface ISamMissionDocument extends Document {
  publicId: string
  eventId: string
  samId: string
  hostId: string
  status: SamMissionStatus
  confirmedAt?: Date
  startedAt?: Date
  completedAt?: Date
  trips: ISamTrip[]
  incidents: ISamIncident[]
  notes?: string
  createdAt: Date
  updatedAt: Date
}

const samTripSchema = new Schema<ISamTrip>(
  {
    guestId: { type: String, required: true },
    guestName: { type: String, required: true },
    destination: { type: String, required: true, maxlength: 200 },
    departureTime: { type: Date, required: true },
    arrivalConfirmedAt: Date,
    status: {
      type: String,
      enum: ['in-progress', 'completed'],
      default: 'in-progress',
    },
  },
  { _id: false },
)

const samIncidentSchema = new Schema<ISamIncident>(
  {
    description: { type: String, required: true, maxlength: 500 },
    level: {
      type: String,
      enum: ['info', 'warning', 'urgent'],
      required: true,
    },
    reportedAt: { type: Date, required: true },
    resolvedAt: Date,
  },
  { _id: false },
)

const samMissionSchema = new Schema<ISamMissionDocument>(
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
    samId: {
      type: String,
      required: true,
    },
    hostId: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['assigned', 'confirmed', 'active', 'completed', 'cancelled'],
      default: 'assigned',
      required: true,
    },
    confirmedAt: Date,
    startedAt: Date,
    completedAt: Date,
    trips: [samTripSchema],
    incidents: [samIncidentSchema],
    notes: {
      type: String,
      maxlength: 1000,
      trim: true,
    },
  },
  {
    timestamps: true,
    strict: true,
  },
)

samMissionSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    const obj = ret as unknown as Record<string, unknown>
    delete obj._id
    delete obj.__v
    return obj
  },
})

samMissionSchema.index({ publicId: 1 }, { unique: true })
samMissionSchema.index({ eventId: 1 })
samMissionSchema.index({ samId: 1, status: 1 })

export const SamMission = model<ISamMissionDocument>('SamMission', samMissionSchema)
