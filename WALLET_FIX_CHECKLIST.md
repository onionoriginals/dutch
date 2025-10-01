# Wallet Connection Fix - Verification Checklist

## Quick Test Steps

### 1. Verify Wallet Extensions Are Installed
- [ ] Install Unisat extension: https://unisat.io/
- [ ] OR install Xverse extension: https://www.xverse.app/
- [ ] Ensure extension is enabled in browser

### 2. Launch Application
```bash
bun run dev:web
# or
npm run dev:web
```

### 3. Open Browser Console
- Press F12 or Right-click > Inspect
- Go to Console tab
- Look for wallet detection logs

### 4. Expected Console Output
```
[WalletAdapter] Checking wallet capabilities: { hasUnisat: true, hasXverse: false }
[WalletStore] Initializing store... { isInitialized: false }
[WalletStore] Available wallets after check: ['unisat']
[WalletStore] Initializing store... { isInitialized: true }
[WalletStore] Available wallets after check: ['unisat']
```

### 5. Test Connection Flow
- [ ] Click "Connect wallet" button
- [ ] Dropdown menu appears with wallet options
- [ ] Click on wallet provider (e.g., "Unisat")
- [ ] Wallet popup appears
- [ ] Approve connection in wallet
- [ ] Address displays in UI

### 6. Expected Console Output During Connection
```
[WalletStore] Attempting to connect to: unisat
[WalletStore] Connecting with network: Testnet
[WalletAdapter] Connecting to Unisat with network: Testnet
[WalletAdapter] Switching Unisat network to: testnet
[WalletAdapter] Requesting Unisat accounts...
[WalletAdapter] Received accounts: [...]
[WalletAdapter] Received public key
[WalletStore] Successfully connected: tb1q...
```

## Common Issues & Solutions

### Issue: No wallets appear in dropdown
**Symptoms**: Click "Connect wallet" but dropdown is empty

**Solution**:
1. Check browser console for: `hasUnisat: false, hasXverse: false`
2. Ensure wallet extension is installed and enabled
3. Try refreshing the page (extensions load async)
4. Wait 1 second after page load for delayed detection

### Issue: Clicking wallet does nothing
**Symptoms**: Click wallet option but no popup appears

**Check**:
1. Browser console for error messages
2. Wallet extension is unlocked
3. Extension permissions are granted
4. Try disabling/re-enabling extension

### Issue: Connection fails with error
**Symptoms**: Toast notification shows error

**Common Errors**:
- "Unisat wallet not found" - Extension not detected
- "User cancelled wallet connection" - User rejected in popup
- "No accounts found" - Wallet has no accounts created

## Code Changes Summary

### `/apps/web/src/lib/stores/wallet.ts`
✅ Changed functions to arrow functions (proper binding)
✅ Improved initialization to re-check wallets
✅ Added debug logging

### `/apps/web/src/lib/stores/wallet.react.ts`
✅ Added 1-second delayed wallet re-check
✅ Catches late-loading extensions

### `/apps/web/src/lib/wallet/walletAdapter.ts`
✅ Added comprehensive debug logging
✅ Better error messages
✅ Improved Unisat connection flow
✅ Improved Xverse connection flow

### `/apps/web/src/components/ui/WalletButton.tsx`
✅ Fixed event handling (preventDefault/stopPropagation)
✅ Proper async handling

## Technical Details

### Function Binding Fix
```typescript
// BEFORE (could lose context)
function connectWallet(provider: WalletProvider): Promise<void> {
  // uses $walletState
}

// AFTER (proper binding)
const connectWallet = async (provider: WalletProvider): Promise<void> => {
  // $walletState always accessible
}
```

### Delayed Detection Fix
```typescript
// Check immediately on mount
walletStore.initializeStore()

// Re-check after 1 second for late-loading extensions
const timeout = setTimeout(() => {
  walletStore.initializeStore()
}, 1000)
```

### Event Handling Fix
```typescript
// BEFORE
onClick={() => handleConnect(provider)}

// AFTER
onClick={(e) => {
  e.preventDefault()
  e.stopPropagation()
  handleConnect(provider)
}}
```

## Testing in Different Scenarios

### Scenario 1: Fresh Install
1. Clear browser cache
2. Install wallet extension
3. Load application
4. Should detect wallet within 1 second

### Scenario 2: Already Installed
1. Wallet already installed
2. Load application
3. Should detect wallet immediately

### Scenario 3: Network Switching
1. Connect wallet
2. Switch network in UI
3. Wallet should disconnect
4. Reconnect to get new network addresses

### Scenario 4: Extension Disabled
1. Disable wallet extension
2. Load application
3. Should show empty wallet list
4. Enable extension
5. Refresh page
6. Should detect wallet

## Next Steps

If issues persist:
1. Check browser extension permissions
2. Try different browser
3. Check wallet extension version compatibility
4. Review sats-connect library version (for Xverse)
5. Test with both Testnet and Mainnet configurations
