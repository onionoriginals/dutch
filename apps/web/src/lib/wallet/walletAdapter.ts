import {
  getAddress,
  getCapabilities,
  request,
  type GetAddressOptions,
  type GetAddressResponse,
  type BitcoinNetworkType,
} from 'sats-connect'

export type WalletProvider = 'unisat' | 'leather' | 'xverse'

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
 * Connect to a Bitcoin wallet
 */
export async function connectWallet(
  provider: WalletProvider,
  network: BitcoinNetworkType = 'Testnet'
): Promise<ConnectedWallet> {
  try {
    const options: GetAddressOptions = {
      payload: {
        purposes: ['payment', 'ordinals'],
        message: 'Connect your wallet to create and bid on auctions',
        network: {
          type: network,
        },
      },
      onFinish: (response: GetAddressResponse) => {
        return response
      },
      onCancel: () => {
        throw new Error('User cancelled wallet connection')
      },
    }

    return new Promise((resolve, reject) => {
      options.onFinish = (response: GetAddressResponse) => {
        try {
          const paymentAddress = response.addresses.find(
            (addr) => addr.purpose === 'payment'
          )
          const ordinalsAddress = response.addresses.find(
            (addr) => addr.purpose === 'ordinals'
          )

          if (!paymentAddress || !ordinalsAddress) {
            throw new Error('Could not retrieve wallet addresses')
          }

          const wallet: ConnectedWallet = {
            addresses: response.addresses.map((addr: any) => ({
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
      }

      options.onCancel = () => {
        reject(new Error('User cancelled wallet connection'))
      }

      getAddress(options)
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
