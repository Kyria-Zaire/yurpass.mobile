import mongoose from 'mongoose'
import { logger } from './logger.js'

const MAX_RETRIES = 5
const BASE_DELAY_MS = 1000

export async function connectDB(uri: string): Promise<void> {
  mongoose.set('strict', true)

  let attempt = 0

  while (attempt < MAX_RETRIES) {
    try {
      attempt++
      logger.info({ attempt }, 'Connecting to MongoDB...')

      await mongoose.connect(uri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      })

      logger.info('MongoDB connected successfully')
      return
    } catch (error: unknown) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1)

      if (attempt >= MAX_RETRIES) {
        logger.fatal({ attempt, error }, 'Failed to connect to MongoDB after max retries')
        throw error
      }

      logger.warn({ attempt, delay, error }, 'MongoDB connection failed, retrying...')
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
}

export function setupGracefulShutdown(): void {
  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Graceful shutdown initiated')

    try {
      await mongoose.disconnect()
      logger.info('MongoDB disconnected')
    } catch (error: unknown) {
      logger.error({ error }, 'Error during MongoDB disconnect')
    }

    process.exit(0)
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
}
