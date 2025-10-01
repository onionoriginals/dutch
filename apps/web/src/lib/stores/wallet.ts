import { atom, computed, map } from 'nanostores'
import {
  connectWallet as connectWalletAdapter,
  disconnectWallet as disconnectWalletAdapter,
  saveWalletToStorage,
  loadWalletFromStorage,
  getAvailableWallets,
  waitForWallets,
  type ConnectedWallet,
  type WalletProvider,
  type BitcoinNetworkType,
} from '../wallet/walletAdapter'

// Types
export interface WalletState {
  wallet: ConnectedWallet | null
  isConnecting: boolean
  error: string | null
  network: BitcoinNetworkType
  availableWallets: WalletProvider[]
}

// Singleton pattern: ensure one store instance across all islands/bundles
declare global {
  interface Window {
    __dutchWalletStore?: ReturnType<typeof createWalletStore>
  }
}

function createWalletStore() {
  // Create the store with initial state
  const $walletState = map<WalletState>({
    wallet: null,
    isConnecting: false,
    error: null,
    network: 'Testnet',
    availableWallets: [],
  })

  // Initialize on client-side only
  let isInitialized = false
  let walletCheckInProgress = false

  async function initializeStore() {
    if (typeof window === 'undefined') return
    
    console.log('[WalletStore] Initializing store...', { isInitialized })
    
    // Only load from storage once
    if (!isInitialized) {
      isInitialized = true
      
      // Load wallet from localStorage on initialization
      const storedWallet = loadWalletFromStorage()
      if (storedWallet) {
        console.log('[WalletStore] Loaded wallet from storage:', storedWallet.provider, storedWallet.paymentAddress)
        $walletState.setKey('wallet', storedWallet)
        $walletState.setKey('network', storedWallet.network)
      }
      
      // Start polling for wallet extensions (they load asynchronously)
      if (!walletCheckInProgress) {
        walletCheckInProgress = true
        console.log('[WalletStore] Waiting for wallet extensions to load...')
        const wallets = await waitForWallets(5000, 100)
        console.log('[WalletStore] Available wallets after polling:', wallets)
        $walletState.setKey('availableWallets', wallets)
        walletCheckInProgress = false
      }
    } else {
      // On subsequent calls, just check immediately (for re-renders)
      const wallets = getAvailableWallets()
      console.log('[WalletStore] Available wallets after check:', wallets)
      $walletState.setKey('availableWallets', wallets)
    }
  }

  // Actions
  const connectWallet = async (provider: WalletProvider): Promise<void> => {
    if (typeof window === 'undefined') return

    console.log('[WalletStore] Attempting to connect to:', provider)
    $walletState.setKey('isConnecting', true)
    $walletState.setKey('error', null)

    try {
      const network = $walletState.get().network
      console.log('[WalletStore] Connecting with network:', network)
      const connectedWallet = await connectWalletAdapter(provider, network)
      console.log('[WalletStore] Successfully connected:', connectedWallet.paymentAddress)
      $walletState.setKey('wallet', connectedWallet)
      saveWalletToStorage(connectedWallet)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect wallet'
      console.error('[WalletStore] Connection error:', err)
      $walletState.setKey('error', errorMessage)
    } finally {
      $walletState.setKey('isConnecting', false)
    }
  }

  const disconnectWallet = (): void => {
    $walletState.setKey('wallet', null)
    $walletState.setKey('error', null)
    disconnectWalletAdapter()
  }

  const switchNetwork = (newNetwork: BitcoinNetworkType): void => {
    const currentWallet = $walletState.get().wallet
    
    $walletState.setKey('network', newNetwork)
    
    // If wallet is connected, disconnect it as we need to reconnect with new network
    if (currentWallet) {
      $walletState.setKey('wallet', null)
      disconnectWalletAdapter()
      $walletState.setKey('error', 'Network changed. Please reconnect your wallet.')
    }
  }

  const clearError = (): void => {
    $walletState.setKey('error', null)
  }

  return {
    $walletState,
    connectWallet,
    disconnectWallet,
    switchNetwork,
    clearError,
    initializeStore,
  }
}

// Get or create singleton instance
function getWalletStore() {
  if (typeof window !== 'undefined') {
    if (!window.__dutchWalletStore) {
      window.__dutchWalletStore = createWalletStore()
    }
    return window.__dutchWalletStore
  }
  
  // SSR fallback: return a temporary instance (won't be used)
  return createWalletStore()
}

// Export the singleton store
export const walletStore = getWalletStore()

// Export convenience selectors
export const $wallet = computed(walletStore.$walletState, (state: WalletState) => state.wallet)
export const $isConnecting = computed(walletStore.$walletState, (state: WalletState) => state.isConnecting)
export const $error = computed(walletStore.$walletState, (state: WalletState) => state.error)
export const $network = computed(walletStore.$walletState, (state: WalletState) => state.network)
export const $availableWallets = computed(walletStore.$walletState, (state: WalletState) => state.availableWallets)

// Export actions
export const { connectWallet, disconnectWallet, switchNetwork, clearError, initializeStore } = walletStore

// Convenience selectors
export const $walletAddress = computed($wallet, (wallet: ConnectedWallet | null) => wallet?.paymentAddress || null)
export const $isWalletConnected = computed($wallet, (wallet: ConnectedWallet | null) => wallet !== null)
