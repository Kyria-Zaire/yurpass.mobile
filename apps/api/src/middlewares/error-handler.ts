import type { Context } from 'hono'
import { logger } from '../lib/logger.js'

export class AppError extends Error {
  constructor(
    public override message: string,
    public statusCode: number,
    public code: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Non autorisé') {
    super(message, 401, 'UNAUTHORIZED')
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Accès refusé') {
    super(message, 403, 'FORBIDDEN')
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Ressource introuvable') {
    super(message, 404, 'NOT_FOUND')
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Données invalides') {
    super(message, 422, 'VALIDATION_ERROR')
  }
}

interface ErrorResponse {
  success: false
  error: {
    code: string
    message: string
  }
}

export function handleApiError(c: Context, error: unknown): Response {
  if (error instanceof AppError) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
    }
    return c.json(response, error.statusCode as 400)
  }

  logger.error({ error }, 'Unhandled error')

  const response: ErrorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Une erreur interne est survenue',
    },
  }
  return c.json(response, 500)
}
