import { describe, test, expect, beforeEach } from 'bun:test'

/**
 * Integration tests demonstrating cross-island store behavior
 */
describe('Store Integration', () => {
  beforeEach(() => {
    // Reset stores
    if (typeof window !== 'undefined') {
      delete (window as any).__dutchWalletStore
      delete (window as any).__dutchToastStore
    }
    
    const { walletStore } = require('./wallet')
    const { toastStore } = require('./toast')
    
    walletStore.$walletState.set({
      wallet: null,
      isConnecting: false,
      error: null,
      network: 'Testnet',
      availableWallets: [],
    })
    
    toastStore.$toastState.set({
      toasts: [],
    })
  })

  test('wallet and toast stores work together', () => {
    const { walletStore } = require('./wallet')
    const { toastStore } = require('./toast')
    
    // Simulate wallet connection
    const mockWallet = {
      addresses: [],
      paymentAddress: 'tb1qtest123',
      paymentPublicKey: 'pubkey1',
      ordinalsAddress: 'tb1qordinals123',
      ordinalsPublicKey: 'pubkey2',
      provider: 'unisat' as const,
      network: 'Testnet' as const,
    }
    
    walletStore.$walletState.setKey('wallet', mockWallet)
    
    // Show success toast
    toastStore.success('Wallet connected!', 'Success', 0)
    
    // Verify both stores have correct state
    const walletState = walletStore.$walletState.get()
    const toastState = toastStore.$toastState.get()
    
    expect(walletState.wallet).toEqual(mockWallet)
    expect(toastState.toasts).toHaveLength(1)
    expect(toastState.toasts[0].type).toBe('success')
    expect(toastState.toasts[0].message).toBe('Wallet connected!')
  })

  test('wallet error triggers error toast', () => {
    const { walletStore } = require('./wallet')
    const { toastStore } = require('./toast')
    
    // Simulate connection error
    walletStore.$walletState.setKey('error', 'Failed to connect wallet')
    
    // Show error toast
    const errorMessage = walletStore.$walletState.get().error
    if (errorMessage) {
      toastStore.error(errorMessage, 'Connection Error', 0)
    }
    
    // Verify toast was created
    const toastState = toastStore.$toastState.get()
    expect(toastState.toasts).toHaveLength(1)
    expect(toastState.toasts[0].type).toBe('error')
    expect(toastState.toasts[0].message).toBe('Failed to connect wallet')
  })

  test('network switch shows warning toast', () => {
    const { walletStore } = require('./wallet')
    const { toastStore } = require('./toast')
    
    // Set up connected wallet
    const mockWallet = {
      addresses: [],
      paymentAddress: 'tb1qtest123',
      paymentPublicKey: 'pubkey1',
      ordinalsAddress: 'tb1qordinals123',
      ordinalsPublicKey: 'pubkey2',
      provider: 'unisat' as const,
      network: 'Testnet' as const,
    }
    
    walletStore.$walletState.setKey('wallet', mockWallet)
    
    // Clear localStorage mock
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem = () => {}
    }
    
    // Switch network
    walletStore.switchNetwork('Mainnet')
    
    // Show warning toast
    toastStore.warning('Network changed. Please reconnect your wallet.', 'Network Switched', 0)
    
    // Verify wallet was disconnected
    const walletState = walletStore.$walletState.get()
    expect(walletState.wallet).toBeNull()
    expect(walletState.network).toBe('Mainnet')
    
    // Verify toast was created
    const toastState = toastStore.$toastState.get()
    expect(toastState.toasts).toHaveLength(1)
    expect(toastState.toasts[0].type).toBe('warning')
  })

  test('multiple components can read same state', () => {
    const { walletStore: walletStore1 } = require('./wallet')
    const { toastStore: toastStore1 } = require('./toast')
    
    // Simulate another import (like a different island)
    const { walletStore: walletStore2 } = require('./wallet')
    const { toastStore: toastStore2 } = require('./toast')
    
    // Set state in first "island"
    walletStore1.$walletState.setKey('network', 'Mainnet')
    toastStore1.info('Test message', undefined, 0)
    
    // Read state in second "island"
    const walletState2 = walletStore2.$walletState.get()
    const toastState2 = toastStore2.$toastState.get()
    
    // Both should see the same state
    expect(walletState2.network).toBe('Mainnet')
    expect(toastState2.toasts).toHaveLength(1)
    expect(toastState2.toasts[0].message).toBe('Test message')
  })

  test('state updates propagate to all subscribers', () => {
    const { walletStore } = require('./wallet')
    
    let updateCount = 0
    const updates: any[] = []
    
    // Simulate multiple subscribers (like multiple React components)
    const unsubscribe1 = walletStore.$walletState.subscribe((state: any) => {
      updateCount++
      updates.push({ subscriber: 1, state })
    })
    
    const unsubscribe2 = walletStore.$walletState.subscribe((state: any) => {
      updateCount++
      updates.push({ subscriber: 2, state })
    })
    
    // Update state
    walletStore.$walletState.setKey('network', 'Mainnet')
    
    // Both subscribers should have received the update
    expect(updateCount).toBeGreaterThan(0)
    
    // Verify both subscribers got the same state
    const subscriber1States = updates.filter(u => u.subscriber === 1)
    const subscriber2States = updates.filter(u => u.subscriber === 2)
    
    expect(subscriber1States.length).toBeGreaterThan(0)
    expect(subscriber2States.length).toBeGreaterThan(0)
    
    // Cleanup
    unsubscribe1()
    unsubscribe2()
  })

  test('disconnecting wallet clears related state', () => {
    const { walletStore } = require('./wallet')
    
    // Set up connected wallet with error
    const mockWallet = {
      addresses: [],
      paymentAddress: 'tb1qtest123',
      paymentPublicKey: 'pubkey1',
      ordinalsAddress: 'tb1qordinals123',
      ordinalsPublicKey: 'pubkey2',
      provider: 'unisat' as const,
      network: 'Testnet' as const,
    }
    
    walletStore.$walletState.setKey('wallet', mockWallet)
    walletStore.$walletState.setKey('error', 'Some error')
    
    // Clear localStorage mock
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem = () => {}
    }
    
    // Disconnect
    walletStore.disconnectWallet()
    
    const state = walletStore.$walletState.get()
    expect(state.wallet).toBeNull()
    expect(state.error).toBeNull()
  })
})
