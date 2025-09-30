# Bitcoin Wallet Integration

This directory contains the Bitcoin wallet integration for the Originals auction platform. It supports connecting to Unisat, Leather, and Xverse wallets for signing transactions.

## Features

- ✅ Support for multiple Bitcoin wallets (Unisat, Leather, Xverse)
- ✅ React Context API for state management
- ✅ Persistent wallet connection across page reloads (localStorage)
- ✅ Network switching (Testnet/Mainnet)
- ✅ Address truncation for UI display
- ✅ Comprehensive error handling
- ✅ TypeScript type safety

## Files

- `walletAdapter.ts` - Core wallet connection logic and utilities
- `WalletContext.tsx` - React Context for wallet state management
- `WalletButton.tsx` - UI component for wallet connection (located in `components/ui/`)

## Usage

### 1. Wrap your app with WalletProvider

```tsx
import { WalletProvider } from './lib/wallet/WalletContext'

function App() {
  return (
    <WalletProvider defaultNetwork="Testnet">
      {/* Your app content */}
    </WalletProvider>
  )
}
```

### 2. Use the WalletButton component

```tsx
import WalletButton from './components/ui/WalletButton'

function Header() {
  return (
    <header>
      <nav>
        {/* Other nav items */}
        <WalletButton />
      </nav>
    </header>
  )
}
```

### 3. Access wallet data in your components

```tsx
import { useWallet } from './lib/wallet/WalletContext'

function CreateAuction() {
  const { wallet, isConnecting, error } = useWallet()
  
  if (!wallet) {
    return <p>Please connect your wallet</p>
  }
  
  return (
    <form onSubmit={(e) => {
      e.preventDefault()
      // Use wallet.paymentAddress for transactions
      console.log('Seller address:', wallet.paymentAddress)
    }}>
      {/* Form fields */}
    </form>
  )
}
```

### Convenience Hooks

```tsx
import { 
  useWalletAddress, 
  useIsWalletConnected 
} from './lib/wallet/WalletContext'

function MyComponent() {
  const address = useWalletAddress() // Returns payment address or null
  const isConnected = useIsWalletConnected() // Returns boolean
}
```

## Wallet Adapter API

### `connectWallet(provider, network)`

Connects to a Bitcoin wallet.

```typescript
const wallet = await connectWallet('unisat', 'Testnet')
console.log(wallet.paymentAddress) // tb1q...
```

### `disconnectWallet()`

Clears the wallet connection from localStorage.

```typescript
disconnectWallet()
```

### `checkWalletCapabilities()`

Checks which wallets are installed in the browser.

```typescript
const capabilities = checkWalletCapabilities()
// { hasUnisat: true, hasLeather: false, hasXverse: true }
```

### `getAvailableWallets()`

Returns an array of available wallet providers.

```typescript
const wallets = getAvailableWallets()
// ['unisat', 'xverse']
```

### `formatAddress(address, chars?)`

Formats a Bitcoin address for display by truncating the middle.

```typescript
formatAddress('tb1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh')
// 'tb1qxy...jhx0wlh'

formatAddress('tb1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', 8)
// 'tb1qxy2k...kfjhx0wlh'
```

## Types

### `ConnectedWallet`

```typescript
interface ConnectedWallet {
  addresses: WalletAddress[]
  paymentAddress: string
  paymentPublicKey: string
  ordinalsAddress: string
  ordinalsPublicKey: string
  provider: WalletProvider
  network: BitcoinNetworkType
}
```

### `WalletAddress`

```typescript
interface WalletAddress {
  address: string
  publicKey: string
  purpose: 'payment' | 'ordinals'
}
```

### `WalletProvider`

```typescript
type WalletProvider = 'unisat' | 'leather' | 'xverse'
```

## Wallet Context API

The `WalletContext` provides the following properties:

```typescript
interface WalletContextType {
  wallet: ConnectedWallet | null
  isConnecting: boolean
  error: string | null
  network: BitcoinNetworkType
  availableWallets: WalletProvider[]
  connectWallet: (provider: WalletProvider) => Promise<void>
  disconnectWallet: () => void
  switchNetwork: (network: BitcoinNetworkType) => void
  clearError: () => void
}
```

## Network Switching

Users can switch between Mainnet and Testnet:

```tsx
const { network, switchNetwork } = useWallet()

<button onClick={() => switchNetwork('Mainnet')}>
  Switch to Mainnet
</button>
```

⚠️ **Note:** Switching networks will disconnect the current wallet, requiring the user to reconnect.

## Error Handling

The wallet integration includes comprehensive error handling:

```tsx
const { error, clearError } = useWallet()

{error && (
  <div className="error-toast">
    {error}
    <button onClick={clearError}>Dismiss</button>
  </div>
)}
```

Errors are automatically cleared after 5 seconds.

## Persistence

Wallet connections are persisted in localStorage under the key `connected_wallet`. The wallet will automatically reconnect on page reload if valid data is found.

To manually save/load wallet data:

```typescript
import { 
  saveWalletToStorage, 
  loadWalletFromStorage 
} from './lib/wallet/walletAdapter'

// Save
saveWalletToStorage(wallet)

// Load
const wallet = loadWalletFromStorage()
```

## Browser Wallet Detection

The integration automatically detects installed wallet extensions:

- **Unisat**: `window.unisat`
- **Leather**: `window.LeatherProvider` or `window.HiroWalletProvider`
- **Xverse**: `window.XverseProviders` or `window.BitcoinProvider`

## Example: Complete Integration

```tsx
// App.tsx
import { WalletProvider } from './lib/wallet/WalletContext'
import WalletButton from './components/ui/WalletButton'
import CreateAuction from './components/CreateAuction'

export default function App() {
  return (
    <WalletProvider defaultNetwork="Testnet">
      <header>
        <nav>
          <a href="/">Home</a>
          <WalletButton />
        </nav>
      </header>
      <main>
        <CreateAuction />
      </main>
    </WalletProvider>
  )
}

// CreateAuction.tsx
import { useWallet } from './lib/wallet/WalletContext'

export default function CreateAuction() {
  const { wallet, isConnecting } = useWallet()
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!wallet) {
      alert('Please connect your wallet first')
      return
    }
    
    const response = await fetch('/api/auctions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sellerAddress: wallet.paymentAddress,
        // ... other auction data
      })
    })
    
    // Handle response
  }
  
  if (isConnecting) {
    return <div>Connecting wallet...</div>
  }
  
  if (!wallet) {
    return (
      <div>
        <h2>Create Auction</h2>
        <p>Please connect your wallet to create an auction</p>
      </div>
    )
  }
  
  return (
    <form onSubmit={handleSubmit}>
      <h2>Create Auction</h2>
      <p>Connected: {wallet.paymentAddress}</p>
      {/* Form fields */}
      <button type="submit">Create Auction</button>
    </form>
  )
}
```

## Testing

To test wallet integration in development:

1. Install a Bitcoin wallet extension (Unisat, Leather, or Xverse)
2. Switch to testnet in the wallet settings
3. Get testnet BTC from a faucet
4. Connect your wallet in the app
5. The app will use your testnet address for transactions

## Security Notes

- Never expose private keys or seed phrases
- Always validate user input before signing transactions
- Use testnet for development and testing
- Only request necessary permissions from the wallet
- Implement proper error handling for all wallet operations

## Troubleshooting

### Wallet not detected
- Ensure the wallet extension is installed and enabled
- Refresh the page after installing the extension
- Check browser console for errors

### Connection fails
- Make sure the wallet is unlocked
- Check that you're on the correct network (testnet/mainnet)
- Try disconnecting and reconnecting
- Clear localStorage and try again

### Address not showing
- Ensure the wallet returned both payment and ordinals addresses
- Check the browser console for error messages
- Verify the wallet supports the requested network

## Dependencies

- `sats-connect`: ^2.6.0 - Bitcoin wallet connection library
- `react`: ^19.1.1
- `react-dom`: ^19.1.1

## Browser Support

- Chrome/Chromium-based browsers
- Firefox
- Brave
- Edge

Note: Safari support depends on wallet extension availability.
