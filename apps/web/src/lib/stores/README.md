# Stores

Framework-agnostic state management using [nanostores](https://github.com/nanostores/nanostores) for cross-island state sharing in Astro.

## Overview

This directory contains the core state management stores that work seamlessly across multiple Astro islands without requiring provider wrappers. Each store uses a window-based singleton pattern to ensure a single instance across all island bundles.

## Stores

### Wallet Store (`wallet.ts`)

Manages Bitcoin wallet connection state and actions.

**State:**
- `wallet: ConnectedWallet | null` - Connected wallet details
- `isConnecting: boolean` - Connection in progress
- `error: string | null` - Last error message
- `network: BitcoinNetworkType` - Current network (Mainnet/Testnet/Signet)
- `availableWallets: WalletProvider[]` - Detected wallet providers

**Actions:**
- `connectWallet(provider)` - Connect to a wallet provider
- `disconnectWallet()` - Disconnect and clear state
- `switchNetwork(network)` - Change Bitcoin network
- `clearError()` - Clear error state
- `initializeStore()` - Load from localStorage and detect wallets

**Example:**
```typescript
import { walletStore } from './wallet'

// Subscribe to changes
walletStore.$walletState.subscribe((state) => {
  console.log('Wallet state:', state)
})

// Perform actions
await walletStore.connectWallet('unisat')
walletStore.switchNetwork('Mainnet')
walletStore.disconnectWallet()
```

### Toast Store (`toast.ts`)

Manages toast notifications with auto-hide functionality.

**State:**
- `toasts: Toast[]` - Array of active toasts

**Actions:**
- `showToast(toast)` - Show a custom toast
- `hideToast(id)` - Hide a specific toast
- `success(message, title?, duration?)` - Show success toast
- `error(message, title?, duration?)` - Show error toast
- `info(message, title?, duration?)` - Show info toast
- `warning(message, title?, duration?)` - Show warning toast

**Example:**
```typescript
import { toastStore } from './toast'

// Subscribe to changes
toastStore.$toastState.subscribe((state) => {
  console.log('Toasts:', state.toasts)
})

// Show toasts
toastStore.success('Action completed!', 'Success')
toastStore.error('Something went wrong', 'Error', 5000)
toastStore.hideToast(toastId)
```

## React Integration

### Wallet React Hook (`wallet.react.ts`)

React hooks for using the wallet store in components.

**Hooks:**
- `useWallet()` - Full wallet state and actions
- `useWalletAddress()` - Just the payment address
- `useIsWalletConnected()` - Boolean connection status

**Example:**
```tsx
import { useWallet } from './wallet.react'

function WalletButton() {
  const { wallet, connectWallet, disconnectWallet } = useWallet()
  
  return (
    <button onClick={() => connectWallet('unisat')}>
      {wallet ? 'Disconnect' : 'Connect Wallet'}
    </button>
  )
}
```

### Toast React Hook (`toast.react.ts`)

React hooks for using the toast store in components.

**Hooks:**
- `useToast()` - Toast state and actions

**Example:**
```tsx
import { useToast } from './toast.react'

function MyComponent() {
  const { success, error } = useToast()
  
  const handleAction = async () => {
    try {
      await doSomething()
      success('Action completed!')
    } catch (err) {
      error('Action failed', 'Error')
    }
  }
  
  return <button onClick={handleAction}>Do Action</button>
}
```

## Architecture

### Singleton Pattern

Each store uses a window-based singleton to ensure one instance across all islands:

```typescript
declare global {
  interface Window {
    __dutchWalletStore?: ReturnType<typeof createWalletStore>
  }
}

function getWalletStore() {
  if (typeof window !== 'undefined') {
    if (!window.__dutchWalletStore) {
      window.__dutchWalletStore = createWalletStore()
    }
    return window.__dutchWalletStore
  }
  // SSR fallback
  return createWalletStore()
}
```

**Benefits:**
- Single source of truth across all islands
- No provider wrappers needed
- Works with Astro's partial hydration
- SSR-safe (no window access during build)

### SSR Safety

All stores check for `window` before accessing browser APIs:

```typescript
function showToast(toast) {
  // Safe: always runs
  const id = generateId()
  $toastState.set({ toasts: [...toasts, toast] })
  
  // Safe: only runs in browser
  if (typeof window !== 'undefined' && duration > 0) {
    setTimeout(() => hideToast(id), duration)
  }
}
```

### Type Safety

All stores are fully typed with TypeScript:

```typescript
export interface WalletState {
  wallet: ConnectedWallet | null
  isConnecting: boolean
  error: string | null
  network: BitcoinNetworkType
  availableWallets: WalletProvider[]
}
```

## Usage in Astro Pages

### Multiple Islands Sharing State

```astro
---
import WalletButton from '@/components/ui/WalletButton'
import WalletStatus from '@/components/ui/WalletStatus'
import ToastContainer from '@/components/ui/ToastContainer'
---
<html>
  <body>
    <!-- All three islands share the same store instances -->
    <header>
      <WalletButton client:load />
    </header>
    
    <aside>
      <WalletStatus client:visible />
    </aside>
    
    <ToastContainer client:load />
  </body>
</html>
```

All islands will:
- See the same wallet connection state
- Show toasts from any island
- Update reactively when state changes

### No Providers Needed

Unlike React Context, no provider wrappers are required:

```astro
<!-- ❌ OLD: Required provider wrappers -->
<body>
  <WalletProvider client:load>
    <ToastProvider client:load>
      <WalletButton client:load />
    </ToastProvider>
  </WalletProvider>
</body>

<!-- ✅ NEW: Independent islands -->
<body>
  <WalletButton client:load />
  <ToastContainer client:load />
</body>
```

## Testing

Run all store tests:
```bash
bun run test:stores
```

Or run individual test files:
```bash
bun test src/lib/stores/wallet.test.ts
bun test src/lib/stores/toast.test.ts
bun test src/lib/stores/integration.test.ts
```

### Test Structure

**Unit Tests:**
- `wallet.test.ts` - Wallet store unit tests
- `toast.test.ts` - Toast store unit tests

**Integration Tests:**
- `integration.test.ts` - Cross-store integration tests

### Writing Tests

Example test with store:

```typescript
import { describe, test, expect, beforeEach } from 'bun:test'

describe('My Store', () => {
  beforeEach(() => {
    // Reset store state
    const { myStore } = require('./myStore')
    myStore.$state.set({ /* initial state */ })
  })
  
  test('action updates state', () => {
    const { myStore } = require('./myStore')
    
    myStore.someAction()
    
    const state = myStore.$state.get()
    expect(state.someValue).toBe('expected')
  })
})
```

## Performance

### Bundle Size
- nanostores core: ~1KB
- Each store: ~2-3KB
- React integration: ~1KB
- **Total overhead**: ~5-7KB

### Comparison with Context
- **Before**: Single wrapper island ~200KB
- **After**: Multiple small islands ~50KB + ~30KB + ~20KB
- **Savings**: ~40% reduction in initial bundle size

### Memory Usage
- Single store instance per page (via singleton)
- Efficient subscription model (only re-render on actual changes)
- Automatic cleanup of toast timers

## Best Practices

### 1. Use Computed Selectors for Derived State

```typescript
import { computed } from 'nanostores'
import { $wallet } from './wallet'

export const $walletAddress = computed($wallet, (wallet) => 
  wallet?.paymentAddress || null
)
```

### 2. Subscribe in React Components via Hooks

```tsx
// ✅ DO: Use React hooks
import { useWallet } from './wallet.react'

function MyComponent() {
  const { wallet } = useWallet()
  return <div>{wallet?.paymentAddress}</div>
}

// ❌ DON'T: Subscribe manually in components
import { walletStore } from './wallet'

function MyComponent() {
  const [wallet, setWallet] = useState(null)
  useEffect(() => {
    const unsubscribe = walletStore.$walletState.subscribe((state) => {
      setWallet(state.wallet)
    })
    return unsubscribe
  }, [])
  // ...
}
```

### 3. Keep Actions Simple

```typescript
// ✅ DO: Simple, focused actions
function clearError(): void {
  $walletState.setKey('error', null)
}

// ❌ DON'T: Complex business logic in actions
function complexAction(): void {
  // Multiple async operations
  // Complex state transformations
  // Side effects
}
```

### 4. Handle SSR Safely

```typescript
// ✅ DO: Check for window
function initializeStore(): void {
  if (typeof window === 'undefined') return
  
  const stored = localStorage.getItem('key')
  // ...
}

// ❌ DON'T: Access window directly
function initializeStore(): void {
  const stored = localStorage.getItem('key') // ❌ Crashes during SSR
  // ...
}
```

## Troubleshooting

### State Not Shared Across Islands

**Problem**: Different islands show different state.

**Solution**: Ensure you're importing from the store module, not creating new instances:
```typescript
// ✅ Correct
import { walletStore } from '@/lib/stores/wallet'

// ❌ Wrong
import { createWalletStore } from '@/lib/stores/wallet'
const walletStore = createWalletStore() // New instance!
```

### "window is not defined" Error During Build

**Problem**: Accessing window during SSR.

**Solution**: Add window check:
```typescript
if (typeof window !== 'undefined') {
  // Browser-only code
}
```

### Tests Failing Due to State Persistence

**Problem**: Store state persists between tests.

**Solution**: Reset state in `beforeEach`:
```typescript
beforeEach(() => {
  const { myStore } = require('./myStore')
  myStore.$state.set({ /* reset state */ })
})
```

## Future Improvements

Potential enhancements:
- [ ] Add Zustand devtools integration
- [ ] Create middleware system for action logging
- [ ] Add optimistic updates helper
- [ ] Create auction state store
- [ ] Add persistence plugin for automatic localStorage sync
- [ ] Add undo/redo functionality

## References

- [Nanostores Documentation](https://github.com/nanostores/nanostores)
- [Nanostores React Integration](https://github.com/nanostores/react)
- [Astro Islands](https://docs.astro.build/en/concepts/islands/)
- [Migration Guide](../../MIGRATION.md)
