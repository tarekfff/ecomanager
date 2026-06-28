'use client'

import {
  createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode,
} from 'react'
import { ToastContainer, ToastItem, ToastVariant } from '@/components/ui/Toast'

interface ToastApi {
  show:    (variant: ToastVariant, message: string, title?: string) => void
  success: (message: string, title?: string) => void
  error:   (message: string, title?: string) => void
  warning: (message: string, title?: string) => void
  info:    (message: string, title?: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const DURATION: Record<ToastVariant, number> = {
  success: 3500, info: 3500, warning: 5000, error: 6000,
}

/** Window event other code (e.g. lib/api-client) can dispatch to raise a toast
 *  from outside the React tree. */
const TOAST_EVENT = 'app:toast'

export interface ToastEventDetail {
  variant: ToastVariant
  message: string
  title?:  string
}

/** Raise a toast from anywhere (including non-React modules). No-op on server. */
export function emitToast(variant: ToastVariant, message: string, title?: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<ToastEventDetail>(TOAST_EVENT, {
    detail: { variant, message, title },
  }))
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const remove = useCallback((id: string) => {
    // Play the exit animation, then drop the toast from state.
    setToasts(prev => prev.map(t => (t.id === id ? { ...t, leaving: true } : t)))
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 220)
    const timer = timers.current[id]
    if (timer) { clearTimeout(timer); delete timers.current[id] }
  }, [])

  const show = useCallback((variant: ToastVariant, message: string, title?: string) => {
    if (!message) return
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setToasts(prev => [...prev, { id, variant, message, title }])
    timers.current[id] = setTimeout(() => remove(id), DURATION[variant])
  }, [remove])

  // Bridge: let non-React code raise toasts via a window event.
  useEffect(() => {
    function onEvent(e: Event) {
      const { variant, message, title } = (e as CustomEvent<ToastEventDetail>).detail ?? {}
      if (variant && message) show(variant, message, title)
    }
    window.addEventListener(TOAST_EVENT, onEvent)
    return () => window.removeEventListener(TOAST_EVENT, onEvent)
  }, [show])

  // Clear any pending timers on unmount.
  useEffect(() => () => { Object.values(timers.current).forEach(clearTimeout) }, [])

  const api: ToastApi = {
    show,
    success: (m, t) => show('success', m, t),
    error:   (m, t) => show('error',   m, t),
    warning: (m, t) => show('warning', m, t),
    info:    (m, t) => show('info',    m, t),
  }

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastContainer toasts={toasts} onClose={remove} />
    </ToastContext.Provider>
  )
}

/** Access the toast API: const toast = useToast(); toast.success('Enregistré'). */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a <ToastProvider>')
  return ctx
}
