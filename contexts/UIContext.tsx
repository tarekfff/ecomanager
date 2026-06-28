'use client'

import {
  createContext, useContext, useState, useEffect, useCallback, ReactNode,
} from 'react'

interface UIState {
  /** True on medium/small screens (< 1200px) where the sidebar is off-canvas. */
  isMobile:    boolean
  /** Whether the off-canvas sidebar drawer is open (only relevant when isMobile). */
  sidebarOpen: boolean
  openSidebar:   () => void
  closeSidebar:  () => void
  toggleSidebar: () => void
}

const UIContext = createContext<UIState | null>(null)

const BREAKPOINT = '(max-width: 1199px)'

export function UIProvider({ children }: { children: ReactNode }) {
  const [isMobile,    setIsMobile]    = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Track viewport via matchMedia (the design system uses inline styles, so we
  // branch the layout in JS rather than relying on CSS that can't beat them).
  useEffect(() => {
    const mq = window.matchMedia(BREAKPOINT)
    const apply = () => {
      setIsMobile(mq.matches)
      if (!mq.matches) setSidebarOpen(false) // back to desktop → close drawer
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  const openSidebar   = useCallback(() => setSidebarOpen(true), [])
  const closeSidebar  = useCallback(() => setSidebarOpen(false), [])
  const toggleSidebar = useCallback(() => setSidebarOpen(v => !v), [])

  return (
    <UIContext.Provider value={{ isMobile, sidebarOpen, openSidebar, closeSidebar, toggleSidebar }}>
      {children}
    </UIContext.Provider>
  )
}

export function useUI(): UIState {
  const ctx = useContext(UIContext)
  if (!ctx) throw new Error('useUI must be used within a <UIProvider>')
  return ctx
}
