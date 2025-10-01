import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { BitcoinNetworkType } from 'sats-connect'
import {
  connectWallet as connectWalletAdapter,
  disconnectWallet as disconnectWalletAdapter,
  saveWalletToStorage,
  loadWalletFromStorage,
  getAvailableWallets,
  type ConnectedWallet,
  type WalletProvider,
} from './walletAdapter'

interface WalletContextType {
  wallet: ConnectedWallet | null
  isConnecting: boolean
  error: string | null
  network: BitcoinNetworkType
  availableWallets: WalletProvider[]
  connectWallet: (provider: WalletProvider) => Promise<void>
  disconnectWallet: () => void
  switchNetwork: (network: BitcoinNetworkType) => void
  clearError: () => void
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

interface WalletProviderProps {
  children: React.ReactNode
  defaultNetwork?: BitcoinNetworkType
}

export function WalletProvider({ 
  children, 
  defaultNetwork = 'Testnet' 
}: WalletProviderProps) {
  const [wallet, setWallet] = useState<ConnectedWallet | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [network, setNetwork] = useState<BitcoinNetworkType>(defaultNetwork)
  const [availableWallets, setAvailableWallets] = useState<WalletProvider[]>([])

  // Load wallet from localStorage on mount
  useEffect(() => {
    const storedWallet = loadWalletFromStorage()
    if (storedWallet) {
      setWallet(storedWallet)
      setNetwork(storedWallet.network)
    }

    // Check available wallets
    const wallets = getAvailableWallets()
    setAvailableWallets(wallets)
  }, [])

  const connectWallet = useCallback(
    async (provider: WalletProvider) => {
      setIsConnecting(true)
      setError(null)

      try {
        const connectedWallet = await connectWalletAdapter(provider, network)
        setWallet(connectedWallet)
        saveWalletToStorage(connectedWallet)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to connect wallet'
        setError(errorMessage)
        console.error('Wallet connection error:', err)
      } finally {
        setIsConnecting(false)
      }
    },
    [network]
  )

  const disconnectWallet = useCallback(() => {
    setWallet(null)
    setError(null)
    disconnectWalletAdapter()
  }, [])

  const switchNetwork = useCallback(
    (newNetwork: BitcoinNetworkType) => {
      setNetwork(newNetwork)
      
      // If wallet is connected, disconnect it as we need to reconnect with new network
      if (wallet) {
        setWallet(null)
        disconnectWalletAdapter()
        setError('Network changed. Please reconnect your wallet.')
      }
    },
    [wallet]
  )

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const value: WalletContextType = {
    wallet,
    isConnecting,
    error,
    network,
    availableWallets,
    connectWallet,
    disconnectWallet,
    switchNetwork,
    clearError,
  }

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet(): WalletContextType {
  const context = useContext(WalletContext)
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider')
  }
  return context
}

// Convenience hook to get just the wallet address
export function useWalletAddress(): string | null {
  const { wallet } = useWallet()
  return wallet?.paymentAddress || null
}

// Convenience hook to check if wallet is connected
export function useIsWalletConnected(): boolean {
  const { wallet } = useWallet()
  return wallet !== null
}
