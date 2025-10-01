import { describe, test, expect, beforeEach, mock } from 'bun:test'
import type { ConnectedWallet, WalletProvider, BitcoinNetworkType } from '../wallet/walletAdapter'

// Mock the walletAdapter module
const mockConnectedWallet: ConnectedWallet = {
  addresses: [
    { address: 'tb1qtest', publicKey: 'pubkey1', purpose: 'payment' },
    { address: 'tb1qordinals', publicKey: 'pubkey2', purpose: 'ordinals' },
  ],
  paymentAddress: 'tb1qtest',
  paymentPublicKey: 'pubkey1',
  ordinalsAddress: 'tb1qordinals',
  ordinalsPublicKey: 'pubkey2',
  provider: 'unisat' as WalletProvider,
  network: 'Testnet' as BitcoinNetworkType,
}

describe('Wallet Store', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    if (typeof window !== 'undefined') {
      localStorage.clear()
    }
    
    // Clear singleton instance
    if (typeof window !== 'undefined') {
      delete (window as any).__dutchWalletStore
    }
    
    // Reset the store state
    const { walletStore } = require('./wallet')
    walletStore.$walletState.set({
      wallet: null,
      isConnecting: false,
      error: null,
      network: 'Testnet',
      availableWallets: [],
    })
  })

  test('initializes with default state', () => {
    // Import fresh store
    const { walletStore } = require('./wallet')
    
    const state = walletStore.$walletState.get()
    expect(state.wallet).toBeNull()
    expect(state.isConnecting).toBe(false)
    expect(state.error).toBeNull()
    expect(state.network).toBe('Testnet')
    expect(state.availableWallets).toEqual([])
  })

  test('disconnectWallet clears state', () => {
    const { walletStore } = require('./wallet')
    
    // Set a wallet first
    walletStore.$walletState.setKey('wallet', mockConnectedWallet)
    
    // Clear localStorage mock
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem = mock(() => {})
    }
    
    walletStore.disconnectWallet()
    
    const state = walletStore.$walletState.get()
    expect(state.wallet).toBeNull()
  })

  test('switchNetwork updates network and clears wallet when wallet is connected', () => {
    const { walletStore } = require('./wallet')
    
    // Set a wallet first
    walletStore.$walletState.setKey('wallet', mockConnectedWallet)
    
    // Clear localStorage mock
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem = mock(() => {})
    }
    
    walletStore.switchNetwork('Mainnet' as BitcoinNetworkType)
    
    const state = walletStore.$walletState.get()
    expect(state.network).toBe('Mainnet')
    expect(state.wallet).toBeNull()
    expect(state.error).toBe('Network changed. Please reconnect your wallet.')
  })
  
  test('switchNetwork updates network without clearing wallet when no wallet connected', () => {
    const { walletStore } = require('./wallet')
    
    // Ensure no wallet is connected and no error
    walletStore.$walletState.set({
      wallet: null,
      isConnecting: false,
      error: null,
      network: 'Testnet',
      availableWallets: [],
    })
    
    walletStore.switchNetwork('Mainnet' as BitcoinNetworkType)
    
    const state = walletStore.$walletState.get()
    expect(state.network).toBe('Mainnet')
    expect(state.wallet).toBeNull()
    // No error should be set when no wallet was connected
    expect(state.error).toBeNull()
  })

  test('clearError clears error state', () => {
    const { walletStore } = require('./wallet')
    
    walletStore.$walletState.setKey('error', 'Test error')
    walletStore.clearError()
    
    const state = walletStore.$walletState.get()
    expect(state.error).toBeNull()
  })

  test('wallet state can be directly manipulated for testing', () => {
    const { walletStore } = require('./wallet')
    
    // Directly set wallet state for testing
    walletStore.$walletState.setKey('wallet', mockConnectedWallet)
    walletStore.$walletState.setKey('isConnecting', true)
    walletStore.$walletState.setKey('error', 'Test error')
    
    const state = walletStore.$walletState.get()
    expect(state.wallet).toEqual(mockConnectedWallet)
    expect(state.isConnecting).toBe(true)
    expect(state.error).toBe('Test error')
  })
})
