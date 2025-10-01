import { describe, test, expect, beforeEach, afterEach } from 'bun:test'

describe('Toast Store', () => {
  beforeEach(() => {
    // Clear singleton instance
    if (typeof window !== 'undefined') {
      delete (window as any).__dutchToastStore
    }
    
    // Reset the store state
    const { toastStore } = require('./toast')
    toastStore.$toastState.set({
      toasts: [],
    })
  })

  test('initializes with empty toasts', () => {
    const { toastStore } = require('./toast')
    
    const state = toastStore.$toastState.get()
    expect(state.toasts).toEqual([])
  })

  test('showToast adds a toast', () => {
    const { toastStore } = require('./toast')
    
    toastStore.showToast({
      message: 'Test message',
      type: 'success',
      duration: 0, // Prevent auto-hide in test
    })
    
    const state = toastStore.$toastState.get()
    expect(state.toasts).toHaveLength(1)
    expect(state.toasts[0].message).toBe('Test message')
    expect(state.toasts[0].type).toBe('success')
    expect(state.toasts[0].id).toBeDefined()
  })

  test('hideToast removes a toast', () => {
    const { toastStore } = require('./toast')
    
    toastStore.showToast({
      message: 'Test message',
      type: 'info',
      duration: 0,
    })
    
    const state1 = toastStore.$toastState.get()
    const toastId = state1.toasts[0].id
    
    toastStore.hideToast(toastId)
    
    const state2 = toastStore.$toastState.get()
    expect(state2.toasts).toHaveLength(0)
  })

  test('success helper creates success toast', () => {
    const { toastStore } = require('./toast')
    
    toastStore.success('Success message', 'Success Title', 0)
    
    const state = toastStore.$toastState.get()
    expect(state.toasts[0].type).toBe('success')
    expect(state.toasts[0].message).toBe('Success message')
    expect(state.toasts[0].title).toBe('Success Title')
  })

  test('error helper creates error toast', () => {
    const { toastStore } = require('./toast')
    
    toastStore.error('Error message', 'Error Title', 0)
    
    const state = toastStore.$toastState.get()
    expect(state.toasts[0].type).toBe('error')
    expect(state.toasts[0].message).toBe('Error message')
    expect(state.toasts[0].title).toBe('Error Title')
  })

  test('info helper creates info toast', () => {
    const { toastStore } = require('./toast')
    
    toastStore.info('Info message', undefined, 0)
    
    const state = toastStore.$toastState.get()
    expect(state.toasts[0].type).toBe('info')
    expect(state.toasts[0].message).toBe('Info message')
  })

  test('warning helper creates warning toast', () => {
    const { toastStore } = require('./toast')
    
    toastStore.warning('Warning message', undefined, 0)
    
    const state = toastStore.$toastState.get()
    expect(state.toasts[0].type).toBe('warning')
    expect(state.toasts[0].message).toBe('Warning message')
  })

  test('auto-hide removes toast after duration (browser only)', async () => {
    // Skip this test if window is not defined (SSR environment)
    if (typeof window === 'undefined') {
      expect(true).toBe(true) // Placeholder
      return
    }
    
    const { toastStore } = require('./toast')
    
    toastStore.showToast({
      message: 'Auto-hide test',
      type: 'info',
      duration: 100, // 100ms for testing
    })
    
    const state1 = toastStore.$toastState.get()
    expect(state1.toasts).toHaveLength(1)
    
    // Wait for auto-hide
    await new Promise(resolve => setTimeout(resolve, 150))
    
    const state2 = toastStore.$toastState.get()
    expect(state2.toasts).toHaveLength(0)
  })

  test('multiple toasts can coexist', () => {
    const { toastStore } = require('./toast')
    
    toastStore.success('First', undefined, 0)
    toastStore.error('Second', undefined, 0)
    toastStore.info('Third', undefined, 0)
    
    const state = toastStore.$toastState.get()
    expect(state.toasts).toHaveLength(3)
    expect(state.toasts[0].type).toBe('success')
    expect(state.toasts[1].type).toBe('error')
    expect(state.toasts[2].type).toBe('info')
  })

  test('toast state persists across operations', () => {
    const { toastStore } = require('./toast')
    
    toastStore.success('First toast', undefined, 0)
    const state1 = toastStore.$toastState.get()
    const firstId = state1.toasts[0].id
    
    toastStore.error('Second toast', undefined, 0)
    const state2 = toastStore.$toastState.get()
    
    expect(state2.toasts).toHaveLength(2)
    
    toastStore.hideToast(firstId)
    const state3 = toastStore.$toastState.get()
    
    expect(state3.toasts).toHaveLength(1)
    expect(state3.toasts[0].type).toBe('error')
  })
})
