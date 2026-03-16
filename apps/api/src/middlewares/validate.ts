import type { MiddlewareHandler } from 'hono'
import type { ZodSchema } from 'zod'
import { AppError } from './error-handler.js'

export function validate(schema: ZodSchema, target: 'json' | 'query' = 'json'): MiddlewareHandler {
  return async (c, next) => {
    const data = target === 'json' ? await c.req.json() : c.req.query()
    const result = schema.safeParse(data)

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }))

      throw new AppError(
        errors[0]?.message ?? 'Données invalides',
        422,
        'VALIDATION_ERROR',
      )
    }

    c.set('validatedBody' as never, result.data as never)
    await next()
  }
}
