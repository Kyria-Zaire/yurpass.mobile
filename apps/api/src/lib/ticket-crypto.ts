import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto'

const ALGO = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

function getKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest()
}

export function encryptTicketCode(plain: string, secret: string): string {
  const key = getKey(secret)
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGO, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  const combined = Buffer.concat([iv, tag, enc])
  return combined.toString('base64url')
}

export function decryptTicketCode(encrypted: string, secret: string): string {
  const key = getKey(secret)
  const combined = Buffer.from(encrypted, 'base64url')
  if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Invalid encrypted payload')
  }
  const iv = combined.subarray(0, IV_LENGTH)
  const tag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const data = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH)
  const decipher = createDecipheriv(ALGO, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  decipher.setAuthTag(tag)
  return decipher.update(data).toString('utf8') + decipher.final('utf8')
}
