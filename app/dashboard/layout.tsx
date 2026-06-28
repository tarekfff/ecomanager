'use client'
import { useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { BoutiqueProvider } from '@/contexts/BoutiqueContext'
import { PermissionsProvider } from '@/contexts/PermissionsContext'
import { ToastProvider } from '@/contexts/ToastContext'
import { UIProvider, useUI } from '@/contexts/UIContext'
import Topbar from '@/components/layout/Topbar'
import Sidebar from '@/components/layout/Sidebar'
import StatusBar from '@/components/layout/StatusBar'
import RouteGuard from '@/components/RouteGuard'
import { getStoredToken, isTokenValid, clearAuth } from '@/lib/client-auth'
import { colors } from '@/lib/tokens'

function Shell({ children }: { children: ReactNode }) {
  const { isMobile, sidebarOpen, closeSidebar } = useUI()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Topbar />
      <StatusBar />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {/* On desktop the sidebar is a static flex child; on mobile it becomes
            an off-canvas drawer (positioned/animated inside the component). */}
        <Sidebar />
        {isMobile && sidebarOpen && (
          <div className="sidebar-overlay" onClick={closeSidebar} />
        )}
        <main style={{ flex: 1, overflowY: 'auto', background: colors.bg }}>
          <RouteGuard>{children}</RouteGuard>
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
    <ToastProvider>
      <UIProvider>
        <BoutiqueProvider>
          <PermissionsProvider>
            <Shell>{children}</Shell>
          </PermissionsProvider>
        </BoutiqueProvider>
      </UIProvider>
    </ToastProvider>
  )
}
