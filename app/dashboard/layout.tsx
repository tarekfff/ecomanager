'use client'
import { useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { BoutiqueProvider } from '@/contexts/BoutiqueContext'
import { PermissionsProvider } from '@/contexts/PermissionsContext'
import Topbar from '@/components/layout/Topbar'
import Sidebar from '@/components/layout/Sidebar'
import StatusBar from '@/components/layout/StatusBar'
import { getStoredToken, isTokenValid, clearAuth } from '@/lib/client-auth'
import { colors } from '@/lib/tokens'

function Shell({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Topbar />
      <StatusBar />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <Sidebar />
        <main style={{ flex: 1, overflowY: 'auto', background: colors.bg }}>
          {children}
        </main>
      </div>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const token = getStoredToken()
    if (!isTokenValid(token)) {
      clearAuth()
      router.replace('/login')
      return
    }
    setReady(true)
  }, [router])

  if (!ready) return null

  return (
    <BoutiqueProvider>
      <PermissionsProvider>
        <Shell>{children}</Shell>
      </PermissionsProvider>
    </BoutiqueProvider>
  )
}
