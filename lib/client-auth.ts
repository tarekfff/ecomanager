// Client-side auth helpers. The JWT lives in localStorage so the session
// survives a browser close; these helpers validate its expiry so we never
// keep a user "logged in" on a token that's already expired.

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token')
}

/** Decode a JWT payload. JWTs use base64url (-, _, no padding), which atob()
 *  doesn't handle directly — convert to standard base64 first. */
function decodeJwtPayload(token: string): { exp?: number } | null {
  try {
    const part = token.split('.')[1] ?? ''
    const b64  = part.replace(/-/g, '+').replace(/_/g, '/')
    const pad  = b64.length % 4 ? b64 + '='.repeat(4 - (b64.length % 4)) : b64
    return JSON.parse(atob(pad))
  } catch {
    return null
  }
}

/** True only if the token exists and its `exp` is still in the future. */
export function isTokenValid(token: string | null): boolean {
  if (!token) return false
  const payload = decodeJwtPayload(token)
  return !!payload && typeof payload.exp === 'number' && payload.exp * 1000 > Date.now()
}

export function isLoggedIn(): boolean {
  return isTokenValid(getStoredToken())
}

/** Clear all auth state — used on logout and on an expired/invalid session. */
export function clearAuth(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem('token')
  localStorage.removeItem('boutiqueId')
  localStorage.removeItem('boutiqueName')
}
