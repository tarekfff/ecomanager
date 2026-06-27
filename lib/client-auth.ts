// Client-side auth helpers. The JWT lives in localStorage so the session
// survives a browser close; these helpers validate its expiry so we never
// keep a user "logged in" on a token that's already expired.

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token')
}

/** True only if the token exists and its `exp` is still in the future. */
export function isTokenValid(token: string | null): boolean {
  if (!token) return false
  try {
    const payload = JSON.parse(atob(token.split('.')[1] ?? ''))
    return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now()
  } catch {
    return false
  }
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
