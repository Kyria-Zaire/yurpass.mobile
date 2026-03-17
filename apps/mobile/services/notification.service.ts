import { apiFetch } from './auth.service'

export async function registerPushToken(
  token: string,
  platform: 'ios' | 'android',
): Promise<void> {
  await apiFetch('/me/push-token', {
    method: 'PUT',
    body: JSON.stringify({ token, platform }),
  })
}

export async function unregisterPushToken(token: string): Promise<void> {
  await apiFetch('/me/push-token', {
    method: 'DELETE',
    body: JSON.stringify({ token }),
  })
}
