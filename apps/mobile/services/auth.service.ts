import * as SecureStore from 'expo-secure-store'
import type { AuthTokens, SessionUser, LoginResponse, TwoFactorSetupResponse } from '@yurpass/types'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

const TOKEN_KEYS = {
  access: 'yurpass_access_token',
  refresh: 'yurpass_refresh_token',
} as const

// ─── Token Management ────────────────────────────────────

export async function saveTokens(tokens: AuthTokens): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEYS.access, tokens.accessToken)
  await SecureStore.setItemAsync(TOKEN_KEYS.refresh, tokens.refreshToken)
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEYS.access)
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEYS.refresh)
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEYS.access)
  await SecureStore.deleteItemAsync(TOKEN_KEYS.refresh)
}

// ─── API Helpers ─────────────────────────────────────────

interface ApiResponse<T> {
  success: boolean
  message?: string
  data?: T
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getAccessToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers as Record<string, string>) },
  })

  const body = await response.json() as T

  if (!response.ok) {
    if (response.status === 401) {
      const refreshed = await tryRefreshToken()
      if (refreshed) {
        return apiFetch<T>(path, options)
      }
      await clearTokens()
    }
    const errorBody = body as ApiResponse<unknown>
    throw new Error(errorBody.message ?? `Erreur ${response.status}`)
  }

  return body
}

async function tryRefreshToken(): Promise<boolean> {
  const refresh = await getRefreshToken()
  if (!refresh) return false

  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    })

    if (!response.ok) return false

    const data = await response.json() as AuthTokens & { success: boolean }
    if (data.success) {
      await saveTokens({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresIn: data.expiresIn,
      })
      return true
    }
    return false
  } catch {
    return false
  }
}

// ─── Auth API ────────────────────────────────────────────

interface RegisterInput {
  email: string
  password: string
  displayName: string
  city: string
}

export async function register(data: RegisterInput): Promise<{ success: boolean; message: string }> {
  return apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function login(data: { email: string; password: string }): Promise<LoginResponse> {
  const result = await apiFetch<LoginResponse & { tokens?: AuthTokens }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  })

  if (result.tokens) {
    await saveTokens(result.tokens)
  }

  return result
}

export async function verifyEmail(token: string): Promise<void> {
  await apiFetch('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
}

export async function logout(): Promise<void> {
  try {
    await apiFetch('/auth/logout', { method: 'POST' })
  } finally {
    await clearTokens()
  }
}

export async function setup2FA(): Promise<TwoFactorSetupResponse> {
  const result = await apiFetch<{ success: boolean } & TwoFactorSetupResponse>('/auth/2fa/setup', {
    method: 'POST',
  })
  return { totpURI: result.totpURI, secret: result.secret, backupCodes: result.backupCodes }
}

export async function verify2FA(code: string): Promise<void> {
  await apiFetch('/auth/2fa/verify', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
}

export async function login2FA(tempToken: string, code: string): Promise<AuthTokens> {
  const result = await apiFetch<AuthTokens & { success: boolean }>('/auth/2fa/login', {
    method: 'POST',
    body: JSON.stringify({ tempToken, code }),
  })
  await saveTokens(result)
  return result
}

export async function getMe(): Promise<SessionUser> {
  const result = await apiFetch<ApiResponse<SessionUser>>('/auth/me')
  return result.data as SessionUser
}

export async function forgotPassword(email: string): Promise<void> {
  await apiFetch('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function deleteAccount(): Promise<void> {
  await apiFetch('/auth/account', { method: 'DELETE' })
  await clearTokens()
}
