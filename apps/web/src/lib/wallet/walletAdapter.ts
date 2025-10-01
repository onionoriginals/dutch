// Bitcoin Wallet Adapter - Hybrid approach using both sats-connect and direct APIs
// Uses sats-connect for Xverse (which implements the sats-connect protocol)
// Uses direct APIs for Unisat and Leather for better control

import { getAddress, type GetAddressOptions, type GetAddressResponse } from 'sats-connect'

export type WalletProvider = 'unisat' | 'leather' | 'xverse'
export type BitcoinNetworkType = 'Mainnet' | 'Testnet' | 'Signet'

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
 * Connect to Unisat wallet using direct API
 */
async function connectUnisat(network: BitcoinNetworkType): Promise<Omit<ConnectedWallet, 'provider' | 'network'>> {
  const unisat = (window as any).unisat
  if (!unisat) {
    throw new Error('Unisat wallet not found. Please install the Unisat extension.')
  }

  // Request accounts
  const accounts = await unisat.requestAccounts()
  if (!accounts || accounts.length === 0) {
    throw new Error('No accounts found in Unisat wallet')
  }

  // Get public key
  const pubKey = await unisat.getPublicKey()
  
  // Switch network if needed
  const networkMap: Record<BitcoinNetworkType, string> = {
    'Mainnet': 'livenet',
    'Testnet': 'testnet',
    'Signet': 'signet',
  }
  await unisat.switchNetwork(networkMap[network])

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
}

/**
 * Connect to Xverse wallet using sats-connect (standard protocol)
 * Xverse implements the sats-connect protocol, so we use it directly
 */
async function connectXverse(network: BitcoinNetworkType): Promise<Omit<ConnectedWallet, 'provider' | 'network'>> {
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
          reject(error)
        }
      },
      onCancel: () => {
        reject(new Error('User cancelled wallet connection'))
      },
    }

    getAddress(options)
  })
}

/**
 * Connect to Leather wallet using direct API
 */
async function connectLeather(network: BitcoinNetworkType): Promise<Omit<ConnectedWallet, 'provider' | 'network'>> {
  return new Promise((resolve, reject) => {
    const leather = (window as any).LeatherProvider || (window as any).HiroWalletProvider
    
    if (!leather) {
      reject(new Error('Leather wallet not found. Please install the Leather extension.'))
      return
    }

    // Request addresses using Leather's API
    leather
      .request('getAddresses', {
        message: 'Connect your wallet to create and bid on auctions',
      })
      .then((response: any) => {
        if (!response || !response.result || !response.result.addresses) {
          reject(new Error('Could not retrieve addresses from Leather wallet'))
          return
        }

        const addresses = response.result.addresses
        const paymentAddr = addresses.find((addr: any) => 
          addr.type === 'p2wpkh' || addr.type === 'p2tr'
        )
        const ordinalsAddr = addresses.find((addr: any) => 
          addr.type === 'p2tr'
        ) || paymentAddr

        if (!paymentAddr) {
          reject(new Error('Could not find payment address'))
          return
        }

        resolve({
          addresses: [
            {
              address: paymentAddr.address,
              publicKey: paymentAddr.publicKey || '',
              purpose: 'payment',
            },
            {
              address: ordinalsAddr?.address || paymentAddr.address,
              publicKey: ordinalsAddr?.publicKey || paymentAddr.publicKey || '',
              purpose: 'ordinals',
            },
          ],
          paymentAddress: paymentAddr.address,
          paymentPublicKey: paymentAddr.publicKey || '',
          ordinalsAddress: ordinalsAddr?.address || paymentAddr.address,
          ordinalsPublicKey: ordinalsAddr?.publicKey || paymentAddr.publicKey || '',
        })
      })
      .catch((error: any) => {
        if (error && error.message && error.message.includes('User rejected')) {
          reject(new Error('User cancelled wallet connection'))
        } else {
          reject(error)
        }
      })
  })
}

/**
 * Connect to a Bitcoin wallet
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

      case 'leather':
        walletData = await connectLeather(network)
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
