import { Schema, model, type Document } from 'mongoose'
import { AuditAction, AuditResult } from '@yurpass/types'

interface IAuditLogDocument extends Document {
  action: AuditAction
  userId?: string
  targetId?: string
  eventId?: string
  metadata: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  result: AuditResult
  createdAt: Date
}

const auditLogSchema = new Schema<IAuditLogDocument>(
  {
    action: {
      type: String,
      enum: Object.values(AuditAction),
      required: true,
    },
    userId: String,
    targetId: String,
    eventId: String,
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    ipAddress: String,
    userAgent: String,
    result: {
      type: String,
      enum: Object.values(AuditResult),
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    strict: true,
  },
)

auditLogSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    const obj = ret as unknown as Record<string, unknown>
    delete obj._id
    delete obj.__v
    return obj
  },
})

auditLogSchema.index({ action: 1, createdAt: -1 })
auditLogSchema.index({ userId: 1, createdAt: -1 })
auditLogSchema.index({ eventId: 1 })
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 63072000 })

export const AuditLog = model<IAuditLogDocument>('AuditLog', auditLogSchema)
