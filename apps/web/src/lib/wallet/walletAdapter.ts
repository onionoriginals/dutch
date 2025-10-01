// Bitcoin Wallet Adapter using sats-connect's modern request() API
// Uses the non-deprecated request() method instead of getAddress()

import { request, type BitcoinNetworkType } from 'sats-connect'

export type WalletProvider = 'unisat' | 'leather' | 'xverse'
export type { BitcoinNetworkType }

export interface WalletAddress {
  address: string
  publicKey: string
  purpose: 'payment' | 'ordinals'
}

export interface ConnectedWallet {
  addresses: WalletAddress[]
  paymentAddress: string
  paymentPublicKey: string
  ordinalsAddress: string
  ordinalsPublicKey: string
  provider: WalletProvider
  network: BitcoinNetworkType
}

export interface WalletCapabilities {
  hasUnisat: boolean
  hasLeather: boolean
  hasXverse: boolean
}

/**
 * Check which Bitcoin wallet providers are available in the browser
 */
export function checkWalletCapabilities(): WalletCapabilities {
  if (typeof window === 'undefined') {
    return { hasUnisat: false, hasLeather: false, hasXverse: false }
  }

  return {
    hasUnisat: typeof (window as any).unisat !== 'undefined',
    hasLeather: typeof (window as any).LeatherProvider !== 'undefined' || 
                typeof (window as any).HiroWalletProvider !== 'undefined',
    hasXverse: typeof (window as any).XverseProviders !== 'undefined' || 
               typeof (window as any).BitcoinProvider !== 'undefined',
  }
}

/**
 * Get available wallet providers
 */
export function getAvailableWallets(): WalletProvider[] {
  const capabilities = checkWalletCapabilities()
  const wallets: WalletProvider[] = []
  
  if (capabilities.hasUnisat) wallets.push('unisat')
  if (capabilities.hasLeather) wallets.push('leather')
  if (capabilities.hasXverse) wallets.push('xverse')
  
  return wallets
}

/**
 * Connect to a Bitcoin wallet using sats-connect's modern request() API
 * This replaces the deprecated getAddress() function
 */
export async function connectWallet(
  provider: WalletProvider,
  network: BitcoinNetworkType = 'Testnet'
): Promise<ConnectedWallet> {
  if (typeof window === 'undefined') {
    throw new Error('Wallet connection is only available in browser environment')
  }

  try {
    return new Promise((resolve, reject) => {
      // Use the modern request() API instead of deprecated getAddress()
      request('getAddresses', {
        purposes: ['payment', 'ordinals'],
        message: 'Connect your wallet to create and bid on auctions',
        network: {
          type: network,
        },
      })
        .then((response: any) => {
          try {
            // The response structure from request() should be similar to getAddress()
            const addresses = response.addresses || response.result?.addresses
            
            if (!addresses || !Array.isArray(addresses)) {
              throw new Error('Could not retrieve wallet addresses')
            }

            const paymentAddress = addresses.find(
              (addr: any) => addr.purpose === 'payment'
            )
            const ordinalsAddress = addresses.find(
              (addr: any) => addr.purpose === 'ordinals'
            )

            if (!paymentAddress || !ordinalsAddress) {
              throw new Error('Could not retrieve wallet addresses')
            }

            const wallet: ConnectedWallet = {
              addresses: addresses.map((addr: any) => ({
                address: addr.address,
                publicKey: addr.publicKey,
                purpose: addr.purpose as 'payment' | 'ordinals',
              })),
              paymentAddress: paymentAddress.address,
              paymentPublicKey: paymentAddress.publicKey,
              ordinalsAddress: ordinalsAddress.address,
              ordinalsPublicKey: ordinalsAddress.publicKey,
              provider,
              network,
            }

            resolve(wallet)
          } catch (error) {
            reject(error)
          }
        })
        .catch((error: any) => {
          // Handle user cancellation
          if (
            error &&
            (error.message?.includes('User rejected') ||
             error.message?.includes('cancelled') ||
             error.code === 4001)
          ) {
            reject(new Error('User cancelled wallet connection'))
          } else {
            reject(error)
          }
        })
    })
  } catch (error) {
    console.error('Wallet connection error:', error)
    throw new Error(
      `Failed to connect to ${provider}: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    )
  }
}

/**
 * Disconnect wallet (clears local state)
 */
export function disconnectWallet(): void {
  // Clear any cached wallet data
  if (typeof window !== 'undefined') {
    localStorage.removeItem('connected_wallet')
  }
}

/**
 * Save wallet to localStorage for persistence
 */
export function saveWalletToStorage(wallet: ConnectedWallet): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('connected_wallet', JSON.stringify(wallet))
    } catch (error) {
      console.error('Failed to save wallet to localStorage:', error)
    }
  }
}

/**
 * Load wallet from localStorage
 */
export function loadWalletFromStorage(): ConnectedWallet | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const stored = localStorage.getItem('connected_wallet')
    if (!stored) return null

    const wallet = JSON.parse(stored) as ConnectedWallet
    
    // Validate the stored wallet data
    if (!wallet.paymentAddress || !wallet.ordinalsAddress) {
      return null
    }

    return wallet
  } catch (error) {
    console.error('Failed to load wallet from localStorage:', error)
    return null
  }
}

/**
 * Format address for display (truncate middle)
 */
export function formatAddress(address: string, chars: number = 6): string {
  if (!address || address.length <= chars * 2) {
    return address
  }
  return `${address.slice(0, chars)}...${address.slice(-chars)}`
}
