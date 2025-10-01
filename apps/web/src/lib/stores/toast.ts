import { map } from 'nanostores'

// Types
export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  message: string
  title?: string
  type: ToastType
  duration?: number
}

export interface ToastState {
  toasts: Toast[]
}

// Singleton pattern: ensure one store instance across all islands/bundles
declare global {
  interface Window {
    __dutchToastStore?: ReturnType<typeof createToastStore>
  }
}

function createToastStore() {
  const $toastState = map<ToastState>({
    toasts: [],
  })

  // Track timers for auto-hide
  const timers = new Map<string, ReturnType<typeof setTimeout>>()

  function hideToast(id: string): void {
    // Clear timer if exists
    const timer = timers.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.delete(id)
    }

    // Remove toast from state
    const state = $toastState.get()
    $toastState.set({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    })
  }

  function showToast(toast: Omit<Toast, 'id'>): void {
    const id = Math.random().toString(36).substring(2, 9)
    const duration = toast.duration ?? 3000
    
    const newToast: Toast = {
      ...toast,
      id,
    }

    // Add toast to state
    const state = $toastState.get()
    $toastState.set({
      toasts: [...state.toasts, newToast],
    })

    // Auto-hide after duration (only in browser)
    if (typeof window !== 'undefined' && duration > 0) {
      const timer = setTimeout(() => {
        hideToast(id)
      }, duration)
      timers.set(id, timer)
    }
  }

  function success(message: string, title?: string, duration?: number): void {
    showToast({ message, title, type: 'success', duration })
  }

  function error(message: string, title?: string, duration?: number): void {
    showToast({ message, title, type: 'error', duration })
  }

  function info(message: string, title?: string, duration?: number): void {
    showToast({ message, title, type: 'info', duration })
  }

  function warning(message: string, title?: string, duration?: number): void {
    showToast({ message, title, type: 'warning', duration })
  }

  return {
    $toastState,
    showToast,
    hideToast,
    success,
    error,
    info,
    warning,
  }
}

// Get or create singleton instance
function getToastStore() {
  if (typeof window !== 'undefined') {
    if (!window.__dutchToastStore) {
      window.__dutchToastStore = createToastStore()
    }
    return window.__dutchToastStore
  }
  
  // SSR fallback: return a temporary instance (won't be used)
  return createToastStore()
}

// Export the singleton store
export const toastStore = getToastStore()

// Export everything from the store
export const { $toastState, showToast, hideToast, success, error, info, warning } = toastStore
