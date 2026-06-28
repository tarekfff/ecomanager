'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { getStoredToken } from '@/lib/client-auth'

interface PermissionsContextValue {
  /** Raw permissions object from the user's merged roles.
   *  {"*": true} means Super Admin — all permissions granted. */
  permissions: Record<string, boolean>
  /** Returns true if the user has the given permission key, or is Super Admin. */
  can: (key: string) => boolean
  /** Returns true if the user has ANY permission whose key starts with prefix.
   *  E.g. canAny('orders') matches 'orders.en_confirmation.view'.
   *  Also accepts an array — true if the user matches at least one entry. */
  canAny: (prefixOrKeys: string | string[]) => boolean
  /** True once the first /api/auth/me response has been received. */
  ready: boolean
}

const PermissionsContext = createContext<PermissionsContextValue>({
  permissions: {},
  can:    () => false,
  canAny: () => false,
  ready:  false,
})

export function usePermissions() {
  return useContext(PermissionsContext)
}

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const [permissions, setPermissions] = useState<Record<string, boolean>>({})
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const token = getStoredToken()
    if (!token) { setReady(true); return }

    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((d: { permissions?: Record<string, boolean> }) => {
        if (d.permissions) setPermissions(d.permissions)
      })
      .catch(() => {})
      .finally(() => setReady(true))
  }, [])

  function can(key: string): boolean {
    return permissions['*'] === true || permissions[key] === true
  }

  function canAny(prefixOrKeys: string | string[]): boolean {
    if (permissions['*'] === true) return true
    const keys = Array.isArray(prefixOrKeys) ? prefixOrKeys : [prefixOrKeys]
    return keys.some(k => {
      // Prefix match: 'orders' → any key starting with 'orders.'
      return Object.entries(permissions).some(
        ([pk, pv]) => pv === true && (pk === k || pk.startsWith(k + '.')),
      )
    })
  }

  return (
    <PermissionsContext.Provider value={{ permissions, can, canAny, ready }}>
      {children}
    </PermissionsContext.Provider>
  )
}
