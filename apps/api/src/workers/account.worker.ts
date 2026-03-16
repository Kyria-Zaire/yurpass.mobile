import { Worker } from 'bullmq'
import { createHash } from 'node:crypto'
import { User } from '../models/user.model.js'
import { AuditLog } from '../models/audit-log.model.js'
import { logger } from '../lib/logger.js'
import { AuditAction, AuditResult } from '@yurpass/types'
interface AnonymizeAccountJob {
  publicId: string
}

export function createAccountWorker(connection: unknown): Worker {
  // BullMQ bundles its own ioredis types — cast needed for compatibility
  const worker = new Worker<AnonymizeAccountJob>(
    'account',
    async (job) => {
      if (job.name === 'anonymize-account') {
        await anonymizeAccount(job.data.publicId)
      }
    },
    { connection: connection as never },
  )

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, jobName: job.name }, 'Account job completed')
  })

  worker.on('failed', (job, error) => {
    logger.error(
      { jobId: job?.id, jobName: job?.name, error },
      'Account job failed',
    )
  })

  return worker
}

async function anonymizeAccount(publicId: string): Promise<void> {
  const user = await User.findOne({ publicId })
  if (!user) {
    logger.warn({ publicId }, 'User not found for anonymization')
    return
  }

  if (!user.deletedAt) {
    logger.warn({ publicId }, 'User not soft-deleted, skipping anonymization')
    return
  }

  const anonymousEmail = `deleted-${createHash('sha256').update(user.email).digest('hex').slice(0, 12)}@anonymous.yurpass.com`

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        email: anonymousEmail,
        passwordHash: 'ANONYMIZED',
        'profile.displayName': 'Utilisateur supprimé',
        'profile.avatarUrl': undefined,
        'profile.bio': undefined,
        'profile.city': 'Anonyme',
        'security.twoFactorSecret': undefined,
        'security.twoFactorEnabled': false,
      },
    },
  )

  await AuditLog.create({
    action: AuditAction.ACCOUNT_ANONYMIZED,
    userId: publicId,
    metadata: {},
    result: AuditResult.SUCCESS,
  })

  logger.info({ publicId }, 'Account anonymized successfully')
}
