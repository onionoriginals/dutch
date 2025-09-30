/**
 * PSBT Signing Workflow for Bitcoin Inscriptions
 * 
 * This module provides utilities to sign PSBTs (Partially Signed Bitcoin Transactions)
 * using various Bitcoin wallet adapters (Unisat, Xverse, Leather, etc.)
 * 
 * SECURITY NOTE: This code runs in the browser. Private keys never leave the user's wallet.
 * The wallet extension handles all signing operations securely.
 */

export interface WalletAdapter {
  signPsbt(psbtBase64: string, options?: SignPsbtOptions): Promise<string>
  getAddress(): Promise<string>
  getPublicKey?(): Promise<string>
  getNetwork(): Promise<'mainnet' | 'testnet' | 'signet' | 'regtest'>
  getBalance?(): Promise<number>
}

export interface SignPsbtOptions {
  autoFinalize?: boolean
  toSignInputs?: Array<{
    index: number
    address?: string
    publicKey?: string
    sighashTypes?: number[]
  }>
}

export interface SignPsbtResult {
  success: boolean
  signedPsbt?: string
  error?: string
  errorCode?: string
}

/**
 * Detects and returns available Bitcoin wallet adapters in the browser
 * Supports: Unisat, Xverse, Leather (Hiro), and more
 */
export async function detectWallet(): Promise<WalletAdapter | null> {
  // Check for Unisat wallet (most popular for Ordinals)
  if (typeof window !== 'undefined' && (window as any).unisat) {
    return createUnisatAdapter()
  }
  
  // Check for Xverse wallet
  if (typeof window !== 'undefined' && (window as any).XverseProviders?.BitcoinProvider) {
    return createXverseAdapter()
  }
  
  // Check for Leather/Hiro wallet
  if (typeof window !== 'undefined' && (window as any).LeatherProvider) {
    return createLeatherAdapter()
  }
  
  return null
}

/**
 * Creates a wallet adapter for Unisat wallet
 */
function createUnisatAdapter(): WalletAdapter {
  const unisat = (window as any).unisat
  
  return {
    async signPsbt(psbtBase64: string, options?: SignPsbtOptions): Promise<string> {
      try {
        // Unisat's signPsbt method
        const signedPsbt = await unisat.signPsbt(psbtBase64, {
          autoFinalized: options?.autoFinalize ?? false,
          toSignInputs: options?.toSignInputs,
        })
        return signedPsbt
      } catch (error: any) {
        throw new Error(`Unisat signing failed: ${error?.message || 'Unknown error'}`)
      }
    },
    
    async getAddress(): Promise<string> {
      const accounts = await unisat.getAccounts()
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found. Please connect your wallet.')
      }
      return accounts[0]
    },
    
    async getPublicKey(): Promise<string> {
      return await unisat.getPublicKey()
    },
    
    async getNetwork(): Promise<'mainnet' | 'testnet' | 'signet' | 'regtest'> {
      const network = await unisat.getNetwork()
      return network === 'livenet' ? 'mainnet' : 'testnet'
    },
    
    async getBalance(): Promise<number> {
      const balance = await unisat.getBalance()
      return balance.total || 0
    },
  }
}

/**
 * Creates a wallet adapter for Xverse wallet
 */
function createXverseAdapter(): WalletAdapter {
  const xverse = (window as any).XverseProviders.BitcoinProvider
  
  return {
    async signPsbt(psbtBase64: string, options?: SignPsbtOptions): Promise<string> {
      try {
        const response = await xverse.signPsbt({
          psbt: psbtBase64,
          broadcast: false,
          inputsToSign: options?.toSignInputs,
        })
        return response.psbt
      } catch (error: any) {
        throw new Error(`Xverse signing failed: ${error?.message || 'Unknown error'}`)
      }
    },
    
    async getAddress(): Promise<string> {
      const response = await xverse.request('getAccounts', null)
      if (!response || response.length === 0) {
        throw new Error('No accounts found. Please connect your wallet.')
      }
      return response[0].address
    },
    
    async getNetwork(): Promise<'mainnet' | 'testnet' | 'signet' | 'regtest'> {
      // Xverse defaults to mainnet, would need to check their API
      return 'mainnet'
    },
  }
}

/**
 * Creates a wallet adapter for Leather (Hiro) wallet
 */
function createLeatherAdapter(): WalletAdapter {
  const leather = (window as any).LeatherProvider
  
  return {
    async signPsbt(psbtBase64: string, options?: SignPsbtOptions): Promise<string> {
      try {
        const response = await leather.signPsbt({
          hex: psbtBase64,
          broadcast: false,
        })
        return response.hex
      } catch (error: any) {
        throw new Error(`Leather signing failed: ${error?.message || 'Unknown error'}`)
      }
    },
    
    async getAddress(): Promise<string> {
      const response = await leather.request('getAddresses', null)
      if (!response || !response.addresses || response.addresses.length === 0) {
        throw new Error('No accounts found. Please connect your wallet.')
      }
      // Return payment address (P2WPKH)
      const paymentAddr = response.addresses.find((a: any) => a.type === 'p2wpkh')
      return paymentAddr?.address || response.addresses[0].address
    },
    
    async getNetwork(): Promise<'mainnet' | 'testnet' | 'signet' | 'regtest'> {
      const response = await leather.request('getInfo', null)
      return response?.network?.type === 'Testnet' ? 'testnet' : 'mainnet'
    },
  }
}

/**
 * Signs a PSBT using the detected wallet
 * 
 * @param psbtBase64 - The base64-encoded PSBT to sign
 * @param options - Optional signing parameters
 * @returns SignPsbtResult with success status and signed PSBT or error
 */
export async function signPsbt(
  psbtBase64: string,
  options?: SignPsbtOptions
): Promise<SignPsbtResult> {
  try {
    // Validate input
    if (!psbtBase64 || typeof psbtBase64 !== 'string') {
      return {
        success: false,
        error: 'Invalid PSBT: must be a base64-encoded string',
        errorCode: 'INVALID_PSBT',
      }
    }
    
    // Detect wallet
    const wallet = await detectWallet()
    if (!wallet) {
      return {
        success: false,
        error: 'No Bitcoin wallet detected. Please install Unisat, Xverse, or Leather wallet.',
        errorCode: 'NO_WALLET',
      }
    }
    
    // Request wallet connection if needed
    try {
      await wallet.getAddress()
    } catch (error) {
      return {
        success: false,
        error: 'Wallet not connected. Please connect your wallet first.',
        errorCode: 'WALLET_NOT_CONNECTED',
      }
    }
    
    // Sign the PSBT
    const signedPsbt = await wallet.signPsbt(psbtBase64, options)
    
    if (!signedPsbt) {
      return {
        success: false,
        error: 'Signing failed: wallet returned empty response',
        errorCode: 'SIGNING_FAILED',
      }
    }
    
    return {
      success: true,
      signedPsbt,
    }
  } catch (error: any) {
    // Handle user rejection
    if (error?.message?.includes('reject') || error?.message?.includes('cancel') || error?.code === 4001) {
      return {
        success: false,
        error: 'User rejected the signing request',
        errorCode: 'USER_REJECTED',
      }
    }
    
    // Handle other errors
    return {
      success: false,
      error: error?.message || 'Failed to sign PSBT',
      errorCode: 'SIGNING_ERROR',
    }
  }
}

/**
 * Connects to the user's Bitcoin wallet and returns the address
 */
export async function connectWallet(): Promise<{ success: boolean; address?: string; error?: string }> {
  try {
    const wallet = await detectWallet()
    if (!wallet) {
      return {
        success: false,
        error: 'No Bitcoin wallet detected. Please install Unisat, Xverse, or Leather wallet.',
      }
    }
    
    const address = await wallet.getAddress()
    return {
      success: true,
      address,
    }
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'Failed to connect wallet',
    }
  }
}

/**
 * Gets the current wallet's network
 */
export async function getWalletNetwork(): Promise<'mainnet' | 'testnet' | 'signet' | 'regtest' | null> {
  try {
    const wallet = await detectWallet()
    if (!wallet) return null
    return await wallet.getNetwork()
  } catch {
    return null
  }
}
