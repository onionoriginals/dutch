/**
 * Network Configuration - Single Source of Truth
 * 
 * Centralizes network definitions, mappings, and utilities.
 * Supports: mainnet, testnet, signet, regtest
 */

import type { BitcoinNetworkType } from '../wallet/walletAdapter'

/**
 * Internal network type used throughout the application
 * (lowercase, includes regtest)
 */
export type AppNetwork = 'mainnet' | 'testnet' | 'signet' | 'regtest'

/**
 * Supported networks configuration
 */
export interface NetworkConfig {
  /** Internal network identifier */
  id: AppNetwork
  /** Display name for UI */
  displayName: string
  /** Short label for badges */
  shortName: string
  /** Wallet network type (from sats-connect) */
  walletType: BitcoinNetworkType | null
  /** Address prefixes for validation */
  addressPrefixes: {
    bech32: string[]
    legacy?: string[]
  }
  /** API endpoints */
  apis: {
    mempool: string
    explorer: string
  }
  /** Whether network is enabled in production */
  enabledInProduction: boolean
  /** UI styling */
  badge: {
    color: string
    bgColor: string
    borderColor: string
  }
}

/**
 * Network configurations - centralized configuration
 */
export const NETWORKS: Record<AppNetwork, NetworkConfig> = {
  mainnet: {
    id: 'mainnet',
    displayName: 'Bitcoin Mainnet',
    shortName: 'Mainnet',
    walletType: 'Mainnet',
    addressPrefixes: {
      bech32: ['bc1'],
      legacy: ['1', '3'],
    },
    apis: {
      mempool: 'https://mempool.space/api',
      explorer: 'https://mempool.space',
    },
    enabledInProduction: true,
    badge: {
      color: 'text-orange-700 dark:text-orange-300',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
      borderColor: 'border-orange-200 dark:border-orange-800',
    },
  },
  testnet: {
    id: 'testnet',
    displayName: 'Bitcoin Testnet',
    shortName: 'Testnet',
    walletType: 'Testnet',
    addressPrefixes: {
      bech32: ['tb1'],
      legacy: ['m', 'n', '2'],
    },
    apis: {
      mempool: 'https://mempool.space/testnet/api',
      explorer: 'https://mempool.space/testnet',
    },
    enabledInProduction: true,
    badge: {
      color: 'text-blue-700 dark:text-blue-300',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      borderColor: 'border-blue-200 dark:border-blue-800',
    },
  },
  signet: {
    id: 'signet',
    displayName: 'Bitcoin Signet',
    shortName: 'Signet',
    walletType: 'Signet',
    addressPrefixes: {
      bech32: ['tb1'],
      legacy: ['m', 'n', '2'],
    },
    apis: {
      mempool: 'https://mempool.space/signet/api',
      explorer: 'https://mempool.space/signet',
    },
    enabledInProduction: true,
    badge: {
      color: 'text-purple-700 dark:text-purple-300',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      borderColor: 'border-purple-200 dark:border-purple-800',
    },
  },
  regtest: {
    id: 'regtest',
    displayName: 'Bitcoin Regtest (Local)',
    shortName: 'Regtest',
    walletType: null, // Not supported by standard wallet adapters
    addressPrefixes: {
      bech32: ['bcrt1'],
      legacy: ['m', 'n', '2'],
    },
    apis: {
      mempool: 'http://localhost:3002/api',
      explorer: 'http://localhost:3002',
    },
    enabledInProduction: false,
    badge: {
      color: 'text-gray-700 dark:text-gray-300',
      bgColor: 'bg-gray-50 dark:bg-gray-900/20',
      borderColor: 'border-gray-200 dark:border-gray-800',
    },
  },
}

/**
 * Get list of supported networks
 */
export function getSupportedNetworks(): AppNetwork[] {
  return Object.keys(NETWORKS) as AppNetwork[]
}

/**
 * Get networks available for wallet connection
 * (excludes regtest which doesn't have standard wallet support)
 */
export function getWalletSupportedNetworks(): AppNetwork[] {
  return getSupportedNetworks().filter(
    (network) => NETWORKS[network].walletType !== null
  )
}

/**
 * Convert wallet network type to internal app network
 */
export function walletNetworkToAppNetwork(
  walletNetwork: BitcoinNetworkType
): AppNetwork {
  return walletNetwork.toLowerCase() as AppNetwork
}

/**
 * Convert internal app network to wallet network type
 */
export function appNetworkToWalletNetwork(
  appNetwork: AppNetwork
): BitcoinNetworkType | null {
  return NETWORKS[appNetwork].walletType
}

/**
 * Validate if an address belongs to a specific network
 */
export function validateAddressForNetwork(
  address: string,
  network: AppNetwork
): boolean {
  const config = NETWORKS[network]
  
  // Check bech32 prefixes
  for (const prefix of config.addressPrefixes.bech32) {
    if (address.startsWith(prefix)) {
      return true
    }
  }
  
  // Check legacy prefixes if available
  if (config.addressPrefixes.legacy) {
    for (const prefix of config.addressPrefixes.legacy) {
      if (address.startsWith(prefix)) {
        return true
      }
    }
  }
  
  return false
}

/**
 * Detect network from address prefix
 */
export function detectNetworkFromAddress(address: string): AppNetwork | null {
  for (const network of getSupportedNetworks()) {
    if (validateAddressForNetwork(address, network)) {
      return network
    }
  }
  return null
}

/**
 * Get network configuration
 */
export function getNetworkConfig(network: AppNetwork): NetworkConfig {
  return NETWORKS[network]
}

/**
 * Check if network is enabled in current environment
 */
export function isNetworkEnabled(network: AppNetwork): boolean {
  const config = NETWORKS[network]
  const isProduction = typeof window !== 'undefined' && 
    window.location.hostname !== 'localhost' &&
    !window.location.hostname.includes('127.0.0.1')
  
  return isProduction ? config.enabledInProduction : true
}

/**
 * Parse network from URL query parameter
 */
export function parseNetworkFromUrl(defaultNetwork: AppNetwork = 'testnet'): AppNetwork {
  if (typeof window === 'undefined') {
    return defaultNetwork
  }
  
  try {
    const params = new URLSearchParams(window.location.search)
    const networkParam = params.get('network')?.toLowerCase()
    
    if (networkParam && getSupportedNetworks().includes(networkParam as AppNetwork)) {
      const network = networkParam as AppNetwork
      
      // Only allow enabled networks
      if (isNetworkEnabled(network)) {
        return network
      }
    }
  } catch {
    // Fall through to default
  }
  
  return defaultNetwork
}

/**
 * Get mempool.space explorer link for a transaction
 */
export function getExplorerTxLink(txid: string, network: AppNetwork): string {
  const config = NETWORKS[network]
  return `${config.apis.explorer}/tx/${txid}`
}

/**
 * Get mempool.space explorer link for an address
 */
export function getExplorerAddressLink(address: string, network: AppNetwork): string {
  const config = NETWORKS[network]
  return `${config.apis.explorer}/address/${address}`
}

/**
 * Emit telemetry event for network operations
 */
export function emitNetworkTelemetry(
  event: string,
  data: {
    network?: AppNetwork
    walletNetwork?: BitcoinNetworkType
    success?: boolean
    error?: string
    [key: string]: any
  }
): void {
  // Log to console in development
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    console.log(`[Network Telemetry] ${event}:`, data)
  }
  
  // TODO: Integrate with analytics service (e.g., PostHog, Amplitude, etc.)
  // Example:
  // if (typeof window !== 'undefined' && (window as any).analytics) {
  //   (window as any).analytics.track(event, data)
  // }
}
