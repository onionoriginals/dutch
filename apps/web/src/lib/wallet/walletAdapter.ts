// Laser Eyes Bitcoin Wallet Adapter
// This module provides a compatibility layer that wraps Laser Eyes functionality
// to maintain the existing API surface while using Laser Eyes under the hood

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
 * Map our provider names to Laser Eyes wallet types
 */
function getWalletType(provider: WalletProvider): string {
  const walletMap: Record<WalletProvider, string> = {
    unisat: 'unisat',
    leather: 'leather',
    xverse: 'xverse',
  }
  return walletMap[provider]
}

/**
 * Get the Laser Eyes instance from window
 * Laser Eyes attaches itself to window when the provider is set up
 */
function getLaserEyesInstance(): any {
  if (typeof window === 'undefined') return null
  
  // Laser Eyes typically exposes its methods through a global context
  // We'll need to access the wallet providers directly
  return (window as any).__laserEyesContext
}

/**
 * Connect to a Bitcoin wallet using direct wallet provider APIs
 * This mimics what Laser Eyes does internally but gives us more control
 */
export async function connectWallet(
  provider: WalletProvider,
  network: BitcoinNetworkType = 'Testnet'
): Promise<ConnectedWallet> {
  if (typeof window === 'undefined') {
    throw new Error('Wallet connection is only available in browser environment')
  }

  try {
    const walletType = getWalletType(provider)
    let paymentAddress = ''
    let paymentPublicKey = ''
    let ordinalsAddress = ''
    let ordinalsPublicKey = ''

    // Connect directly to wallet providers
    switch (provider) {
      case 'unisat': {
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
        
        paymentAddress = accounts[0]
        paymentPublicKey = pubKey
        ordinalsAddress = accounts[0] // Unisat uses same address for both
        ordinalsPublicKey = pubKey
        
        // Switch network if needed
        const networkMap: Record<BitcoinNetworkType, string> = {
          'Mainnet': 'livenet',
          'Testnet': 'testnet',
          'Signet': 'signet',
        }
        await unisat.switchNetwork(networkMap[network])
        break
      }

      case 'xverse': {
        const xverse = (window as any).XverseProviders?.BitcoinProvider || (window as any).BitcoinProvider
        if (!xverse) {
          throw new Error('Xverse wallet not found. Please install the Xverse extension.')
        }

        // Request addresses using Xverse's getAddresses method
        const response = await xverse.request('getAddresses', {
          purposes: ['payment', 'ordinals'],
          message: 'Connect your wallet to create and bid on auctions',
        })

        if (!response || !response.addresses) {
          throw new Error('Could not retrieve addresses from Xverse wallet')
        }

        const addresses = response.addresses
        const paymentAddr = addresses.find((addr: any) => addr.purpose === 'payment')
        const ordinalsAddr = addresses.find((addr: any) => addr.purpose === 'ordinals')

        if (!paymentAddr || !ordinalsAddr) {
          throw new Error('Could not find payment or ordinals address')
        }

        paymentAddress = paymentAddr.address
        paymentPublicKey = paymentAddr.publicKey
        ordinalsAddress = ordinalsAddr.address
        ordinalsPublicKey = ordinalsAddr.publicKey
        break
      }

      case 'leather': {
        const leather = (window as any).LeatherProvider || (window as any).HiroWalletProvider
        if (!leather) {
          throw new Error('Leather wallet not found. Please install the Leather extension.')
        }

        // Request addresses using Leather's API
        const response = await leather.request('getAddresses', {
          message: 'Connect your wallet to create and bid on auctions',
        })

        if (!response || !response.result || !response.result.addresses) {
          throw new Error('Could not retrieve addresses from Leather wallet')
        }

        const addresses = response.result.addresses
        const paymentAddr = addresses.find((addr: any) => 
          addr.type === 'p2wpkh' || addr.type === 'p2tr'
        )
        const ordinalsAddr = addresses.find((addr: any) => 
          addr.type === 'p2tr'
        ) || paymentAddr

        if (!paymentAddr) {
          throw new Error('Could not find payment address')
        }

        paymentAddress = paymentAddr.address
        paymentPublicKey = paymentAddr.publicKey || ''
        ordinalsAddress = ordinalsAddr?.address || paymentAddr.address
        ordinalsPublicKey = ordinalsAddr?.publicKey || paymentAddr.publicKey || ''
        break
      }

      default:
        throw new Error(`Unsupported wallet provider: ${provider}`)
    }

    const wallet: ConnectedWallet = {
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
      provider,
      network,
    }

    return wallet
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
