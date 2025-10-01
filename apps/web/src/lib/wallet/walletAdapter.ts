// Bitcoin Wallet Adapter - Hybrid Approach
// - Direct API for Unisat (better control over network switching)
// - sats-connect for Xverse (implements the standard protocol)

import { getAddress, type GetAddressOptions, type GetAddressResponse, type BitcoinNetworkType } from 'sats-connect'

export type WalletProvider = 'unisat' | 'xverse'
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
  hasXverse: boolean
}

/**
 * Check which Bitcoin wallet providers are available in the browser
 */
export function checkWalletCapabilities(): WalletCapabilities {
  if (typeof window === 'undefined') {
    return { hasUnisat: false, hasXverse: false }
  }

  const hasUnisat = typeof (window as any).unisat !== 'undefined'
  const hasXverse = typeof (window as any).XverseProviders?.BitcoinProvider !== 'undefined' || 
                    typeof (window as any).BitcoinProvider !== 'undefined'

  console.log('[WalletAdapter] Checking wallet capabilities:', { hasUnisat, hasXverse })

  return {
    hasUnisat,
    hasXverse,
  }
}

/**
 * Get available wallet providers
 */
export function getAvailableWallets(): WalletProvider[] {
  const capabilities = checkWalletCapabilities()
  const wallets: WalletProvider[] = []
  
  if (capabilities.hasUnisat) wallets.push('unisat')
  if (capabilities.hasXverse) wallets.push('xverse')
  
  console.log('[WalletAdapter] Available wallets:', wallets)
  
  return wallets
}

/**
 * Connect to Unisat wallet using direct API
 * IMPORTANT: Network is switched BEFORE requesting accounts to ensure correct network addresses
 */
async function connectUnisat(network: BitcoinNetworkType): Promise<Omit<ConnectedWallet, 'provider' | 'network'>> {
  console.log('[WalletAdapter] Connecting to Unisat with network:', network)
  
  const unisat = (window as any).unisat
  if (!unisat) {
    console.error('[WalletAdapter] Unisat wallet object not found on window')
    throw new Error('Unisat wallet not found. Please install the Unisat extension.')
  }

  // Map our network type to Unisat's network naming
  const networkMap: Record<BitcoinNetworkType, string> = {
    'Mainnet': 'livenet',
    'Testnet': 'testnet',
    'Signet': 'signet',
  }

  try {
    console.log('[WalletAdapter] Switching Unisat network to:', networkMap[network])
    // CRITICAL: Switch network FIRST before requesting accounts
    // This ensures we get addresses for the correct network
    await unisat.switchNetwork(networkMap[network])
    
    // Small delay to ensure network switch is complete
    await new Promise(resolve => setTimeout(resolve, 100))

    console.log('[WalletAdapter] Requesting Unisat accounts...')
    // Now request accounts - these will be for the correct network
    const accounts = await unisat.requestAccounts()
    console.log('[WalletAdapter] Received accounts:', accounts)
    
    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts found in Unisat wallet')
    }

    // Get public key
    const pubKey = await unisat.getPublicKey()
    console.log('[WalletAdapter] Received public key')
    
    const paymentAddress = accounts[0]
    const paymentPublicKey = pubKey
    const ordinalsAddress = accounts[0] // Unisat uses same address for both
    const ordinalsPublicKey = pubKey

    return {
      addresses: [
        {
          address: paymentAddress,
          publicKey: paymentPublicKey,
          purpose: 'payment',
        },
        {
          address: ordinalsAddress,
          publicKey: ordinalsPublicKey,
          purpose: 'ordinals',
        },
      ],
      paymentAddress,
      paymentPublicKey,
      ordinalsAddress,
      ordinalsPublicKey,
    }
  } catch (error: any) {
    console.error('[WalletAdapter] Unisat connection error:', error)
    if (error?.message?.includes('rejected') || error?.code === 4001) {
      throw new Error('User cancelled wallet connection')
    }
    throw error
  }
}

/**
 * Connect to Xverse wallet using sats-connect
 * Xverse implements the sats-connect protocol, so we use it for reliability
 */
async function connectXverse(network: BitcoinNetworkType): Promise<Omit<ConnectedWallet, 'provider' | 'network'>> {
  console.log('[WalletAdapter] Connecting to Xverse with network:', network)
  
  return new Promise((resolve, reject) => {
    const options: GetAddressOptions = {
      payload: {
        purposes: ['payment', 'ordinals'],
        message: 'Connect your wallet to create and bid on auctions',
        network: {
          type: network,
        },
      },
      onFinish: (response: GetAddressResponse) => {
        try {
          console.log('[WalletAdapter] Xverse connection successful, received addresses')
          
          const paymentAddress = response.addresses.find(
            (addr) => addr.purpose === 'payment'
          )
          const ordinalsAddress = response.addresses.find(
            (addr) => addr.purpose === 'ordinals'
          )

          if (!paymentAddress || !ordinalsAddress) {
            reject(new Error('Could not retrieve wallet addresses'))
            return
          }

          resolve({
            addresses: response.addresses.map((addr) => ({
              address: addr.address,
              publicKey: addr.publicKey,
              purpose: addr.purpose as 'payment' | 'ordinals',
            })),
            paymentAddress: paymentAddress.address,
            paymentPublicKey: paymentAddress.publicKey,
            ordinalsAddress: ordinalsAddress.address,
            ordinalsPublicKey: ordinalsAddress.publicKey,
          })
        } catch (error) {
          console.error('[WalletAdapter] Error processing Xverse response:', error)
          reject(error)
        }
      },
      onCancel: () => {
        console.log('[WalletAdapter] User cancelled Xverse connection')
        reject(new Error('User cancelled wallet connection'))
      },
    }

    console.log('[WalletAdapter] Calling getAddress for Xverse...')
    getAddress(options)
  })
}

/**
 * Connect to a Bitcoin wallet
 * Supports: Unisat (direct API), Xverse (sats-connect protocol)
 * Network switching is handled properly for each wallet type
 */
export async function connectWallet(
  provider: WalletProvider,
  network: BitcoinNetworkType = 'Testnet'
): Promise<ConnectedWallet> {
  if (typeof window === 'undefined') {
    throw new Error('Wallet connection is only available in browser environment')
  }

  try {
    let walletData: Omit<ConnectedWallet, 'provider' | 'network'>

    switch (provider) {
      case 'unisat':
        walletData = await connectUnisat(network)
        break

      case 'xverse':
        walletData = await connectXverse(network)
        break

      default:
        throw new Error(`Unsupported wallet provider: ${provider}`)
    }

    return {
      ...walletData,
      provider,
      network,
    }
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
