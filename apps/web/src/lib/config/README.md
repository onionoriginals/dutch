# Network Configuration Module

> **Single Source of Truth for Bitcoin Network Configuration**

This module provides centralized configuration and utilities for managing Bitcoin networks (mainnet, testnet, signet, regtest) throughout the application.

## Overview

The network configuration module ensures consistency, correctness, and safety when working with different Bitcoin networks. It provides:

- **Type-safe network definitions** with TypeScript
- **Address validation** per network
- **Network detection** from addresses
- **API endpoint management** for different networks
- **Wallet integration** with network type conversions
- **Telemetry support** for observability
- **Production controls** for network availability

## Installation

```typescript
import {
  type AppNetwork,
  getNetworkConfig,
  validateAddressForNetwork,
  // ... other utilities
} from '@/lib/config/networks'
```

## Core Types

### AppNetwork

```typescript
type AppNetwork = 'mainnet' | 'testnet' | 'signet' | 'regtest'
```

Internal network type used throughout the application. Lowercase for consistency.

### NetworkConfig

```typescript
interface NetworkConfig {
  id: AppNetwork
  displayName: string
  shortName: string
  walletType: BitcoinNetworkType | null
  addressPrefixes: {
    bech32: string[]
    legacy?: string[]
  }
  apis: {
    mempool: string
    explorer: string
  }
  enabledInProduction: boolean
  badge: {
    color: string
    bgColor: string
    borderColor: string
  }
}
```

Complete configuration for a Bitcoin network including all network-specific settings.

## Network Definitions

### Mainnet
- **Wallet Type**: `'Mainnet'`
- **Prefixes**: `bc1` (bech32), `1`, `3` (legacy)
- **API**: https://mempool.space/api
- **Production**: Enabled
- **Color**: Orange

### Testnet
- **Wallet Type**: `'Testnet'`
- **Prefixes**: `tb1` (bech32), `m`, `n`, `2` (legacy)
- **API**: https://mempool.space/testnet/api
- **Production**: Enabled
- **Color**: Blue

### Signet
- **Wallet Type**: `'Signet'`
- **Prefixes**: `tb1` (bech32), `m`, `n`, `2` (legacy)
- **API**: https://mempool.space/signet/api
- **Production**: Enabled
- **Color**: Purple

### Regtest
- **Wallet Type**: `null` (not supported by standard wallets)
- **Prefixes**: `bcrt1` (bech32), `m`, `n`, `2` (legacy)
- **API**: http://localhost:3002/api
- **Production**: Disabled
- **Color**: Gray

## API Reference

### Network Discovery

#### `getSupportedNetworks(): AppNetwork[]`

Returns array of all supported networks.

```typescript
const networks = getSupportedNetworks()
// ['mainnet', 'testnet', 'signet', 'regtest']
```

#### `getWalletSupportedNetworks(): AppNetwork[]`

Returns networks that support wallet connections (excludes regtest).

```typescript
const walletNetworks = getWalletSupportedNetworks()
// ['mainnet', 'testnet', 'signet']
```

#### `getNetworkConfig(network: AppNetwork): NetworkConfig`

Gets complete configuration for a network.

```typescript
const config = getNetworkConfig('testnet')
console.log(config.displayName) // "Bitcoin Testnet"
console.log(config.apis.mempool) // "https://mempool.space/testnet/api"
```

### Type Conversions

#### `walletNetworkToAppNetwork(walletNetwork: BitcoinNetworkType): AppNetwork`

Converts wallet network type (capitalized) to app network type (lowercase).

```typescript
const appNetwork = walletNetworkToAppNetwork('Testnet')
// 'testnet'
```

#### `appNetworkToWalletNetwork(appNetwork: AppNetwork): BitcoinNetworkType | null`

Converts app network type to wallet network type. Returns `null` for regtest.

```typescript
const walletNetwork = appNetworkToWalletNetwork('mainnet')
// 'Mainnet'

const regtest = appNetworkToWalletNetwork('regtest')
// null
```

### Address Validation

#### `validateAddressForNetwork(address: string, network: AppNetwork): boolean`

Validates if an address belongs to a specific network.

```typescript
const isValid = validateAddressForNetwork(
  'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
  'mainnet'
)
// true

const isInvalid = validateAddressForNetwork(
  'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
  'mainnet'
)
// false
```

#### `detectNetworkFromAddress(address: string): AppNetwork | null`

Auto-detects network from address prefix.

```typescript
const network = detectNetworkFromAddress('bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh')
// 'mainnet'

const unknown = detectNetworkFromAddress('invalid')
// null
```

### Explorer Links

#### `getExplorerTxLink(txid: string, network: AppNetwork): string`

Generates mempool.space transaction link for the network.

```typescript
const link = getExplorerTxLink(
  '1234567890abcdef...',
  'testnet'
)
// 'https://mempool.space/testnet/tx/1234567890abcdef...'
```

#### `getExplorerAddressLink(address: string, network: AppNetwork): string`

Generates mempool.space address link for the network.

```typescript
const link = getExplorerAddressLink(
  'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
  'testnet'
)
// 'https://mempool.space/testnet/address/tb1qw508d...'
```

### Environment

#### `isNetworkEnabled(network: AppNetwork): boolean`

Checks if a network is enabled in the current environment.

```typescript
// In development (localhost)
isNetworkEnabled('regtest') // true
isNetworkEnabled('mainnet') // true

// In production
isNetworkEnabled('regtest') // false (not enabled in production)
isNetworkEnabled('mainnet') // true
```

#### `parseNetworkFromUrl(defaultNetwork?: AppNetwork): AppNetwork`

Parses network from URL query parameter `?network=`.

```typescript
// URL: https://app.com/auctions/new?network=mainnet
const network = parseNetworkFromUrl('testnet')
// 'mainnet'

// URL: https://app.com/auctions/new
const network = parseNetworkFromUrl('testnet')
// 'testnet' (default)
```

### Telemetry

#### `emitNetworkTelemetry(event: string, data: object): void`

Emits telemetry event with network context.

```typescript
emitNetworkTelemetry('auction.created', {
  network: 'testnet',
  auctionId: 'abc123',
  success: true,
})
```

**Development**: Events logged to console  
**Production**: Ready for analytics integration (PostHog, Amplitude, etc.)

## Usage Examples

### Basic Network Validation

```typescript
import { validateAddressForNetwork } from '@/lib/config/networks'

function validateSellerAddress(address: string, network: AppNetwork) {
  if (!validateAddressForNetwork(address, network)) {
    throw new Error(
      `Invalid address for ${network}. ` +
      `Please ensure the address matches the selected network.`
    )
  }
}
```

### Network-Aware Components

```typescript
import { getNetworkConfig } from '@/lib/config/networks'

function NetworkInfo({ network }: { network: AppNetwork }) {
  const config = getNetworkConfig(network)
  
  return (
    <div className={`${config.badge.bgColor} ${config.badge.color}`}>
      <h3>{config.displayName}</h3>
      <p>Explorer: {config.apis.explorer}</p>
    </div>
  )
}
```

### Wallet Integration

```typescript
import { walletNetworkToAppNetwork } from '@/lib/config/networks'
import { useWallet } from '@/lib/stores/wallet.react'

function useAuctionNetwork() {
  const { wallet } = useWallet()
  
  // Convert wallet network to app network
  const appNetwork = wallet 
    ? walletNetworkToAppNetwork(wallet.network)
    : 'testnet'
  
  return appNetwork
}
```

### Transaction Broadcasting

```typescript
import { getNetworkConfig } from '@/lib/config/networks'

async function broadcastToNetwork(txHex: string, network: AppNetwork) {
  const config = getNetworkConfig(network)
  
  const response = await fetch(`${config.apis.mempool}/tx`, {
    method: 'POST',
    body: txHex,
  })
  
  return response.text() // txid
}
```

## Best Practices

### 1. Always Use AppNetwork Type

❌ **Don't** use string literals:
```typescript
const network = 'testnet' // Type: string
```

✅ **Do** use AppNetwork type:
```typescript
import type { AppNetwork } from '@/lib/config/networks'
const network: AppNetwork = 'testnet'
```

### 2. Validate Addresses Before Use

❌ **Don't** assume addresses are valid:
```typescript
const address = userInput
await sendToAddress(address, network)
```

✅ **Do** validate addresses:
```typescript
import { validateAddressForNetwork } from '@/lib/config/networks'

const address = userInput
if (!validateAddressForNetwork(address, network)) {
  throw new Error('Invalid address for network')
}
await sendToAddress(address, network)
```

### 3. Use Network Config for URLs

❌ **Don't** hardcode URLs:
```typescript
const apiUrl = 'https://mempool.space/api'
```

✅ **Do** use network config:
```typescript
import { getNetworkConfig } from '@/lib/config/networks'

const config = getNetworkConfig(network)
const apiUrl = config.apis.mempool
```

### 4. Emit Telemetry for Key Operations

```typescript
import { emitNetworkTelemetry } from '@/lib/config/networks'

// Emit events for debugging and monitoring
emitNetworkTelemetry('operation.started', {
  network,
  operationType: 'auction_creation',
})

try {
  // ... operation
  emitNetworkTelemetry('operation.success', {
    network,
    operationType: 'auction_creation',
  })
} catch (error) {
  emitNetworkTelemetry('operation.failed', {
    network,
    operationType: 'auction_creation',
    error: error.message,
  })
}
```

## Testing

The module includes comprehensive tests covering:

- Network configuration validation
- Type conversions
- Address validation for all networks
- Network detection from addresses
- Explorer link generation
- Configuration consistency

Run tests:
```bash
bun test src/lib/config/networks.test.ts
```

## Security Considerations

1. **Address Validation**: Always validate addresses against the selected network to prevent cross-network errors
2. **Network Allowlist**: Only supported networks are allowed; invalid networks are rejected
3. **URL Sanitization**: URL parameters are validated against the supported network list
4. **Production Controls**: Regtest is disabled in production environments
5. **No Secrets in Config**: Configuration contains only public information

## Performance

- **Network lookup**: O(1) constant time
- **Address validation**: O(n) where n is number of prefix patterns (typically 2-3)
- **Type conversions**: O(1) constant time
- **No network requests**: All configuration is local

## Extending

To add a new network:

1. Add to `AppNetwork` type
2. Add configuration to `NETWORKS` object
3. Update wallet adapter if wallet support is needed
4. Add tests for the new network
5. Update documentation

```typescript
export const NETWORKS: Record<AppNetwork, NetworkConfig> = {
  // ... existing networks
  
  newnetwork: {
    id: 'newnetwork',
    displayName: 'New Network',
    shortName: 'NewNet',
    walletType: null,
    addressPrefixes: {
      bech32: ['nn1'],
    },
    apis: {
      mempool: 'https://api.newnetwork.com',
      explorer: 'https://explorer.newnetwork.com',
    },
    enabledInProduction: true,
    badge: {
      color: 'text-green-700',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
    },
  },
}
```

## Dependencies

- `sats-connect`: For wallet network types (`BitcoinNetworkType`)
- No other external dependencies

## License

Part of the auction application. See main project LICENSE file.
