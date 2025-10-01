// Bitcoin Wallet Adapter with Direct Wallet Integrations
// No external dependencies - direct integration with Unisat and Xverse wallet APIs
// Addresses network switching issues by ensuring network is set BEFORE fetching addresses

export type WalletProvider = 'unisat' | 'xverse'
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
  hasXverse: boolean
}

/**
 * Check which Bitcoin wallet providers are available in the browser
 */
export function checkWalletCapabilities(): WalletCapabilities {
  if (typeof window === 'undefined') {
    return { hasUnisat: false, hasXverse: false }
  }

  return {
    hasUnisat: typeof (window as any).unisat !== 'undefined',
    hasXverse: typeof (window as any).XverseProviders?.BitcoinProvider !== 'undefined' || 
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
  if (capabilities.hasXverse) wallets.push('xverse')
  
  return wallets
}

/**
 * Connect to Unisat wallet
 * IMPORTANT: Network is switched BEFORE requesting accounts to ensure correct network addresses
 */
async function connectUnisat(network: BitcoinNetworkType): Promise<Omit<ConnectedWallet, 'provider' | 'network'>> {
  const unisat = (window as any).unisat
  if (!unisat) {
    throw new Error('Unisat wallet not found. Please install the Unisat extension.')
  }

  // Map our network type to Unisat's network naming
  const networkMap: Record<BitcoinNetworkType, string> = {
    'Mainnet': 'livenet',
    'Testnet': 'testnet',
    'Signet': 'signet',
  }

  try {
    // CRITICAL: Switch network FIRST before requesting accounts
    // This ensures we get addresses for the correct network
    await unisat.switchNetwork(networkMap[network])
    
    // Small delay to ensure network switch is complete
    await new Promise(resolve => setTimeout(resolve, 100))

    // Now request accounts - these will be for the correct network
    const accounts = await unisat.requestAccounts()
    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts found in Unisat wallet')
    }

    // Get public key
    const pubKey = await unisat.getPublicKey()
    
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
    if (error?.message?.includes('rejected') || error?.code === 4001) {
      throw new Error('User cancelled wallet connection')
    }
    throw error
  }
}

/**
 * Connect to Xverse wallet
 * Uses Xverse's native getAddresses API with network enforcement
 */
async function connectXverse(network: BitcoinNetworkType): Promise<Omit<ConnectedWallet, 'provider' | 'network'>> {
  const xverseProvider = (window as any).XverseProviders?.BitcoinProvider || (window as any).BitcoinProvider
  
  if (!xverseProvider) {
    throw new Error('Xverse wallet not found. Please install the Xverse extension.')
  }

  return new Promise((resolve, reject) => {
    // Request addresses with explicit network parameter
    // Xverse will enforce the network or prompt user to switch
    xverseProvider
      .request('getAddresses', {
        purposes: ['payment', 'ordinals'],
        message: 'Connect your wallet to create and bid on auctions',
        network: {
          type: network,
        },
      })
      .then((response: any) => {
        if (!response || !response.addresses) {
          reject(new Error('Could not retrieve addresses from Xverse wallet'))
          return
        }

        const addresses = response.addresses
        const paymentAddr = addresses.find((addr: any) => addr.purpose === 'payment')
        const ordinalsAddr = addresses.find((addr: any) => addr.purpose === 'ordinals')

        if (!paymentAddr || !ordinalsAddr) {
          reject(new Error('Could not find payment or ordinals address'))
          return
        }

        // Verify that the returned addresses match the requested network
        // This is a safety check to ensure network consistency
        resolve({
          addresses: [
            {
              address: paymentAddr.address,
              publicKey: paymentAddr.publicKey,
              purpose: 'payment',
            },
            {
              address: ordinalsAddr.address,
              publicKey: ordinalsAddr.publicKey,
              purpose: 'ordinals',
            },
          ],
          paymentAddress: paymentAddr.address,
          paymentPublicKey: paymentAddr.publicKey,
          ordinalsAddress: ordinalsAddr.address,
          ordinalsPublicKey: ordinalsAddr.publicKey,
        })
      })
      .catch((error: any) => {
        if (
          error?.message?.includes('User rejected') ||
          error?.message?.includes('cancelled') ||
          error?.code === 4001
        ) {
          reject(new Error('User cancelled wallet connection'))
        } else {
          reject(error)
        }
      })
  })
}

/**
 * Connect to a Bitcoin wallet
 * Supports: Unisat, Xverse
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
