import { useStore } from '@nanostores/react'
import { computed } from 'nanostores'
import type { Toast } from './toast'
import {
  toastStore,
  $toastState,
} from './toast'

// Computed selector for toasts array
const $toasts = computed($toastState, (state) => state.toasts)

// React hook that matches the original ToastContext API
export function useToast() {
  const toasts = useStore($toasts)

  return {
    toasts,
    showToast: toastStore.showToast,
    hideToast: toastStore.hideToast,
    success: toastStore.success,
    error: toastStore.error,
    info: toastStore.info,
    warning: toastStore.warning,
  }
}
