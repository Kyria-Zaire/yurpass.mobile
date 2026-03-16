import { Resend } from 'resend'
import { env } from './env.js'
import { logger } from './logger.js'

let resend: Resend | null = null

function getResendClient(): Resend | null {
  if (!env.RESEND_API_KEY) {
    return null
  }
  if (!resend) {
    resend = new Resend(env.RESEND_API_KEY)
  }
  return resend
}

const FROM_EMAIL = 'Yurpass <noreply@yurpass.com>'

interface SendEmailOptions {
  to: string
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<boolean> {
  const client = getResendClient()
  if (!client) {
    logger.warn({ subject }, 'Email not sent — RESEND_API_KEY not configured')
    return false
  }

  try {
    const { error } = await client.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    })

    if (error) {
      logger.error({ errorCode: error.name }, 'Failed to send email')
      return false
    }

    logger.info({ subject }, 'Email sent successfully')
    return true
  } catch (error: unknown) {
    logger.error({ error }, 'Email service error')
    return false
  }
}
