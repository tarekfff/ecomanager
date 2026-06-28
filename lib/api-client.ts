// Client-side fetch wrapper. Adds the Bearer token to every request and
// centralises session handling: a 401 means the JWT expired (7-day TTL) or is
// invalid, so we clear auth and bounce to /login. Network/401 failures raise a
// toast automatically; for other non-2xx responses an ApiError is thrown with
// the server's message so the calling page can toast it.

import { getStoredToken, clearAuth } from './client-auth'
import { emitToast } from '@/contexts/ToastContext'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// Guard so a burst of parallel 401s only triggers one redirect.
let redirecting = false
function handleUnauthorized() {
  if (redirecting) return
  redirecting = true
  clearAuth()
  emitToast('warning', 'Session expirée. Veuillez vous reconnecter.')
  if (typeof window !== 'undefined') window.location.href = '/login'
}

/** Low-level fetch with auth + 401 handling. Returns the raw Response. */
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getStoredToken()
  const headers = new Headers(options.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let res: Response
  try {
    res = await fetch(path, { ...options, headers })
  } catch {
    emitToast('error', 'Erreur réseau. Vérifiez votre connexion.')
    throw new ApiError('Erreur réseau', 0)
  }

  if (res.status === 401) {
    handleUnauthorized()
    throw new ApiError('Unauthorized', 401)
  }
  return res
}

/** Parse a Response as JSON, throwing ApiError(message) on a non-2xx status. */
async function parse<T>(res: Response): Promise<T> {
  const text = await res.text()
  const data = text ? safeJson(text) : null
  if (!res.ok) {
    const message = (data as { error?: string } | null)?.error || `Erreur ${res.status}`
    throw new ApiError(message, res.status)
  }
  return data as T
}

function safeJson(text: string): unknown {
  try { return JSON.parse(text) } catch { return text }
}

function jsonInit(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  return parse<T>(await apiFetch(path))
}
export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return parse<T>(await apiFetch(path, jsonInit('POST', body)))
}
export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return parse<T>(await apiFetch(path, jsonInit('PUT', body)))
}
export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return parse<T>(await apiFetch(path, jsonInit('PATCH', body)))
}
export async function apiDelete<T>(path: string): Promise<T> {
  return parse<T>(await apiFetch(path, jsonInit('DELETE')))
}

/** Extract a user-facing message from any thrown error. */
export function errorMessage(e: unknown, fallback = 'Une erreur est survenue'): string {
  return e instanceof Error && e.message ? e.message : fallback
}
