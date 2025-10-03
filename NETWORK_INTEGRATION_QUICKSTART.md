# Network Integration Quick Start Guide

## For Users

### Creating an Auction on a Specific Network

1. **Connect Your Wallet**: Click the wallet button in the top right and select your network in the wallet settings
2. **Open the Wizard**: Navigate to "Create Auction"
3. **Check the Network Badge**: The network badge in the top right shows the current auction network
4. **Change Network (if needed)**: Click "Change Network" and select your desired network
5. **Resolve Mismatches**: If you see a yellow warning, choose one of the two options:
   - "Switch Auction to [Wallet Network]" - Changes the auction to match your wallet
   - "Reconnect Wallet to [Auction Network]" - Prompts you to reconnect your wallet

### Using URL Parameters

You can set the initial network via URL:
```
https://your-app.com/auctions/new?network=mainnet
https://your-app.com/auctions/new?network=testnet
https://your-app.com/auctions/new?network=signet
https://your-app.com/auctions/new?network=regtest
```

### Network Compatibility

| Network | Wallet Support | Production | Use Case |
|---------|---------------|------------|----------|
| Mainnet | ✅ Yes | ✅ Yes | Real Bitcoin auctions |
| Testnet | ✅ Yes | ✅ Yes | Testing with test coins |
| Signet | ✅ Yes* | ✅ Yes | Reliable testing |
| Regtest | ❌ No | ❌ No | Local development |

*Requires manual enablement in Unisat wallet settings

## For Developers

### Importing Network Utilities

```typescript
import {
  type AppNetwork,
  getNetworkConfig,
  validateAddressForNetwork,
  detectNetworkFromAddress,
  walletNetworkToAppNetwork,
  appNetworkToWalletNetwork,
  getExplorerTxLink,
  emitNetworkTelemetry,
} from '@/lib/config/networks'
```

### Using Network in Components

```typescript
// Get current network from wallet
const { wallet } = useWallet()
const appNetwork = wallet ? walletNetworkToAppNetwork(wallet.network) : 'testnet'

// Validate address
const isValid = validateAddressForNetwork(address, appNetwork)

// Get explorer link
const explorerUrl = getExplorerTxLink(txid, appNetwork)

// Emit telemetry
emitNetworkTelemetry('custom.event', {
  network: appNetwork,
  success: true,
})
```

### Network-Specific API Calls

```typescript
// Broadcast transaction to specific network
const result = await broadcastTransaction(txHex, appNetwork)

// Verify inscription on specific network  
const verification = await verifyInscription(inscriptionId, address, appNetwork)

// Poll for confirmations on specific network
await pollForConfirmations(txid, appNetwork, { targetConfirmations: 1 })
```

### Adding Network UI

```typescript
import { NetworkBadge, NetworkSelector } from '@/components/auction'

// Display current network
<NetworkBadge network={currentNetwork} />

// Allow network selection
<NetworkSelector
  value={currentNetwork}
  onChange={setCurrentNetwork}
  disabled={isProcessing}
/>
```

### Address Validation

```typescript
import { validateAddressForNetwork, detectNetworkFromAddress } from '@/lib/config/networks'

// Validate address for specific network
if (!validateAddressForNetwork(address, 'mainnet')) {
  throw new Error('Invalid mainnet address')
}

// Auto-detect network from address
const network = detectNetworkFromAddress(address)
if (network === 'mainnet') {
  // Handle mainnet address
}
```

### Network Configuration

```typescript
import { getNetworkConfig } from '@/lib/config/networks'

const config = getNetworkConfig('testnet')

console.log(config.displayName)        // "Bitcoin Testnet"
console.log(config.apis.mempool)       // "https://mempool.space/testnet/api"
console.log(config.addressPrefixes)    // { bech32: ['tb1'], legacy: ['m', 'n', '2'] }
```

### Telemetry Best Practices

```typescript
// Emit events for key operations
emitNetworkTelemetry('auction.created', {
  network: appNetwork,
  auctionId: id,
  success: true,
})

emitNetworkTelemetry('broadcast.failed', {
  network: appNetwork,
  error: errorMessage,
  errorCode: code,
})
```

## Common Issues & Solutions

### Issue: "Network mismatch" error when submitting
**Solution**: Click one of the buttons in the yellow warning banner to resolve the mismatch.

### Issue: "Signet network not available" error
**Solution**: Open Unisat wallet → Settings → Network → Enable Signet, then reconnect.

### Issue: Regtest addresses not working with wallet
**Solution**: Regtest is not supported by standard wallets. Use manual address entry or local development setup.

### Issue: Address validation fails
**Solution**: Ensure the address prefix matches the selected network:
- Mainnet: `bc1...` or `1...` or `3...`
- Testnet/Signet: `tb1...` or `m...` or `n...`
- Regtest: `bcrt1...`

## Testing

### Unit Tests
```bash
cd apps/web
bun test src/lib/config/networks.test.ts
```

### Component Tests
```bash
bun test src/components/auction/NetworkBadge.test.tsx
bun test src/components/auction/NetworkSelector.test.tsx
```

### Integration Tests
```bash
bun test src/components/auction/CreateAuctionWizard.integration.test.tsx
```

## API Reference

### Network Types

```typescript
type AppNetwork = 'mainnet' | 'testnet' | 'signet' | 'regtest'
type BitcoinNetworkType = 'Mainnet' | 'Testnet' | 'Signet'
```

### Core Functions

#### `getSupportedNetworks(): AppNetwork[]`
Returns all supported networks.

#### `validateAddressForNetwork(address: string, network: AppNetwork): boolean`
Validates if an address is valid for the specified network.

#### `detectNetworkFromAddress(address: string): AppNetwork | null`
Auto-detects network from address prefix.

#### `getExplorerTxLink(txid: string, network: AppNetwork): string`
Generates explorer link for transaction.

#### `emitNetworkTelemetry(event: string, data: object): void`
Emits telemetry event with network context.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      User Interface                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ NetworkBadge │  │NetworkSelector│  │MismatchBanner│      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                   Wizard State Layer                         │
│  - auctionNetwork: AppNetwork                                │
│  - walletNetwork: AppNetwork | null                          │
│  - hasNetworkMismatch: boolean                               │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              Network Configuration Module                    │
│  - Network definitions (NETWORKS)                            │
│  - Validation utilities                                      │
│  - Type conversions                                          │
│  - Telemetry helpers                                         │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                   External Services                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │Wallet Adapter│  │Mempool API   │  │Broadcast API │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## Support

For issues or questions:
1. Check the IMPLEMENTATION_SUMMARY.md for detailed information
2. Review the test files for usage examples
3. Check console logs for telemetry events (in development)
