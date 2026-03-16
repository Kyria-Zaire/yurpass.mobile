import { Resend } from 'resend'
import { env } from './env.js'
import { logger } from './logger.js'

const resend = new Resend(env.RESEND_API_KEY)

const FROM_EMAIL = 'Yurpass <noreply@yurpass.com>'

interface SendEmailOptions {
  to: string
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<boolean> {
  try {
    const { error } = await resend.emails.send({
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
