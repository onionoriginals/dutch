import { useStore } from '@nanostores/react'
import { useEffect } from 'react'
import type { BitcoinNetworkType } from 'sats-connect'
import type { WalletProvider } from '../wallet/walletAdapter'
import {
  walletStore,
  $wallet,
  $isConnecting,
  $error,
  $network,
  $availableWallets,
  $walletAddress,
  $isWalletConnected,
} from './wallet'

// React hook that matches the original WalletContext API
export function useWallet() {
  // Subscribe to store state
  const wallet = useStore($wallet)
  const isConnecting = useStore($isConnecting)
  const error = useStore($error)
  const network = useStore($network)
  const availableWallets = useStore($availableWallets)

  // Initialize store on mount
  useEffect(() => {
    walletStore.initializeStore()
  }, [])

  return {
    wallet,
    isConnecting,
    error,
    network,
    availableWallets,
    connectWallet: walletStore.connectWallet,
    disconnectWallet: walletStore.disconnectWallet,
    switchNetwork: walletStore.switchNetwork,
    clearError: walletStore.clearError,
  }
}

// Convenience hook to get just the wallet address
export function useWalletAddress(): string | null {
  return useStore($walletAddress)
}

// Convenience hook to check if wallet is connected
export function useIsWalletConnected(): boolean {
  return useStore($isWalletConnected)
}
