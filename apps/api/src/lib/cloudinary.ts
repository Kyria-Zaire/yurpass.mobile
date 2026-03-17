import { v2 as cloudinary } from 'cloudinary'
import { env } from './env.js'

let configured = false

function ensureConfigured(): void {
  if (configured) return
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  })
  configured = true
}

export interface CloudinaryUploadResult {
  publicId: string
  secureUrl: string
}

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

// JPEG: FF D8 FF, PNG: 89 50 4E 47, WebP: 52 49 46 46 ... 57 45 42 50
const MAGIC_BYTES: Array<{ mime: string; bytes: number[]; offset?: number }> = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] },
]

export function validateImageBuffer(buffer: ArrayBuffer, mimeType: string): boolean {
  if (!ALLOWED_MIME_TYPES.has(mimeType)) return false

  const bytes = new Uint8Array(buffer)
  if (bytes.length < 12) return false

  // Verify magic bytes match declared MIME
  const matchingMagic = MAGIC_BYTES.find((m) => m.mime === mimeType)
  if (!matchingMagic) return false

  const offset = matchingMagic.offset ?? 0
  return matchingMagic.bytes.every((b, i) => bytes[offset + i] === b)
}

export async function uploadAvatar(
  buffer: ArrayBuffer,
  userId: string,
): Promise<CloudinaryUploadResult> {
  ensureConfigured()

  const base64 = Buffer.from(buffer).toString('base64')
  const dataUri = `data:image/webp;base64,${base64}`

  const result = await cloudinary.uploader.upload(dataUri, {
    folder: `yurpass/avatars/${userId}`,
    public_id: 'avatar',
    overwrite: true,
    transformation: [
      { width: 400, height: 400, crop: 'fill', gravity: 'face' },
      { format: 'webp', quality: 85 },
    ],
    resource_type: 'image',
  })

  return {
    publicId: result.public_id,
    secureUrl: result.secure_url,
  }
}

export async function deleteCloudinaryAsset(publicId: string): Promise<void> {
  ensureConfigured()

  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' })
  } catch {
    // Non-critical — old image may already be gone
  }
}
