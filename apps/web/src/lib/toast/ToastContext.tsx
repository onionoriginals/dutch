import React, { createContext, useContext, useState, useCallback } from 'react'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  message: string
  title?: string
  type: ToastType
  duration?: number
}

interface ToastContextType {
  toasts: Toast[]
  showToast: (toast: Omit<Toast, 'id'>) => void
  hideToast: (id: string) => void
  success: (message: string, title?: string, duration?: number) => void
  error: (message: string, title?: string, duration?: number) => void
  info: (message: string, title?: string, duration?: number) => void
  warning: (message: string, title?: string, duration?: number) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

interface ToastProviderProps {
  children: React.ReactNode
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const hideToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = Math.random().toString(36).substring(2, 9)
      const duration = toast.duration ?? 3000
      
      const newToast: Toast = {
        ...toast,
        id,
      }

      setToasts((prev) => [...prev, newToast])

      if (duration > 0) {
        setTimeout(() => {
          hideToast(id)
        }, duration)
      }
    },
    [hideToast]
  )

  const success = useCallback(
    (message: string, title?: string, duration?: number) => {
      showToast({ message, title, type: 'success', duration })
    },
    [showToast]
  )

  const error = useCallback(
    (message: string, title?: string, duration?: number) => {
      showToast({ message, title, type: 'error', duration })
    },
    [showToast]
  )

  const info = useCallback(
    (message: string, title?: string, duration?: number) => {
      showToast({ message, title, type: 'info', duration })
    },
    [showToast]
  )

  const warning = useCallback(
    (message: string, title?: string, duration?: number) => {
      showToast({ message, title, type: 'warning', duration })
    },
    [showToast]
  )

  const value: ToastContextType = {
    toasts,
    showToast,
    hideToast,
    success,
    error,
    info,
    warning,
  }

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
}

export function useToast(): ToastContextType {
  const context = useContext(ToastContext)
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
