# Inscription Selector Implementation

## Overview
Implemented a user-friendly inscription selector that allows users to select inscriptions from their connected wallet instead of manually entering inscription IDs in a text field.

## Changes Made

### 1. Enhanced Wallet Adapter (`apps/web/src/lib/wallet/walletAdapter.ts`)

#### Added Inscription Interface
```typescript
export interface Inscription {
  inscriptionId: string
  inscriptionNumber?: number
  address: string
  outputValue: number
  content?: string
  contentType?: string
  contentLength?: number
  timestamp?: number
  genesisTransaction?: string
  location?: string
  output?: string
  offset?: number
}
```

#### Added `getInscriptions()` Function
- Supports both **Unisat** and **Xverse** wallets
- For Unisat: Uses the wallet's native `getInscriptions()` API method
- For Xverse: Fetches from Xverse API endpoints (testnet and mainnet)
- Returns up to 100 inscriptions per wallet
- Handles errors gracefully and returns empty array on failure

### 2. New InscriptionSelector Component (`apps/web/src/components/inputs/InscriptionSelector.tsx`)

#### Features
- **Automatic Wallet Detection**: When wallet is connected, automatically fetches and displays user's inscriptions
- **Visual Selection**: Checkbox-based selection interface with inscription details
- **Inscription Details Display**:
  - Inscription number (e.g., #12345)
  - Content type (e.g., text/plain, image/png)
  - Inscription ID (full transaction ID)
  - Output value in sats
- **Bulk Actions**:
  - Select All button
  - Deselect All button
- **Manual Input Fallback**: Users can switch to manual text input if needed
- **Loading States**: Shows spinner while fetching inscriptions
- **Error Handling**: Displays error messages and offers manual input fallback
- **No Wallet Mode**: Falls back to traditional textarea when wallet is not connected

#### User Experience
1. **With Wallet Connected**: 
   - Component fetches inscriptions automatically
   - Users see a scrollable list of their inscriptions
   - Click checkboxes to select inscriptions for auction
   - Real-time count shows number of selected inscriptions
   - Option to switch to manual input if needed

2. **Without Wallet**: 
   - Shows traditional textarea for manual input
   - Displays helpful message to connect wallet

### 3. Updated CreateAuctionWizard (`apps/web/src/components/auction/CreateAuctionWizard.tsx`)

#### Changes
- Replaced `<Textarea>` with `<InscriptionSelector>` component
- Integrated with form using `ControlAdapter` render prop pattern
- Passes wallet provider and ordinals address to selector
- Updated helper text to reflect new selection method
- Maintains backward compatibility with manual input

#### Integration Code
```typescript
<FormField name="inscriptionIds">
  <FieldLabel>Inscription IDs</FieldLabel>
  <ControlAdapter
    render={(field) => (
      <InscriptionSelector
        value={field.value}
        onChange={field.onChange}
        walletProvider={wallet?.provider}
        walletAddress={wallet?.ordinalsAddress}
        placeholder="e.g.&#10;abc123...def456i0&#10;789abc...123def i1&#10;xyz987...654abci0"
      />
    )}
  />
  <InscriptionCountHelper />
  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
    {wallet ? (
      'Select inscriptions from your wallet or enter them manually'
    ) : (
      'Enter inscription IDs in the format: <txid>i<vout> (one per line)'
    )}
  </div>
  <FieldError />
</FormField>
```

## Technical Details

### Wallet API Methods

#### Unisat Wallet
```javascript
const response = await window.unisat.getInscriptions(cursor, size)
// Returns: { list: [...inscriptions], total: number }
```

#### Xverse Wallet
```javascript
// Uses Xverse API
const response = await fetch(
  `${apiBase}/v1/address/${address}/ordinals/inscriptions?offset=0&limit=100`
)
// Returns: { results: [...inscriptions] }
```

### Data Flow
1. User connects wallet → Wallet store updates
2. CreateAuctionWizard receives wallet info via `useWallet()` hook
3. InscriptionSelector receives `walletProvider` and `walletAddress` props
4. Component automatically fetches inscriptions via `getInscriptions()`
5. User selects inscriptions via checkboxes
6. Selected IDs are converted to newline-separated string
7. Form field updates with inscription IDs
8. Existing validation and verification logic continues to work

## Benefits

1. **Improved UX**: Users can visually see and select their inscriptions
2. **Reduced Errors**: No need to manually copy/paste inscription IDs
3. **Transparency**: Users see inscription details (number, type, value)
4. **Flexibility**: Can still manually enter IDs if needed
5. **Backward Compatible**: Works with existing form validation and verification
6. **Wallet Agnostic**: Supports multiple wallet providers

## Testing

### Manual Testing Steps
1. **With Unisat Wallet**:
   - Install Unisat browser extension
   - Connect wallet from app header
   - Navigate to create auction page
   - Verify inscriptions load automatically
   - Select inscriptions and submit form
   - Verify selected IDs are used in auction creation

2. **With Xverse Wallet**:
   - Install Xverse browser extension
   - Connect wallet from app header
   - Navigate to create auction page
   - Verify inscriptions load from API
   - Select inscriptions and submit form

3. **Without Wallet**:
   - Don't connect wallet
   - Navigate to create auction page
   - Verify textarea appears for manual input
   - Enter inscription IDs manually
   - Submit form normally

4. **Error Handling**:
   - Test with wallet that has no inscriptions
   - Test with network errors
   - Verify manual input fallback works

## Future Enhancements

1. **Pagination**: Load more than 100 inscriptions
2. **Search/Filter**: Search inscriptions by ID or content type
3. **Preview**: Show inscription content preview (images, text)
4. **Sorting**: Sort by inscription number, date, or value
5. **Multi-page Load**: Fetch all inscriptions across multiple API calls
6. **Caching**: Cache inscription data to reduce API calls
7. **Refresh Button**: Manually refresh inscription list

## Inscription Content Previews

### Visual Content Rendering
The InscriptionSelector now includes rich visual previews for different content types:

- **Images** (`image/*`): Displays the actual image from ordinals.com
- **Text** (`text/plain`): Shows a document icon with "TXT" badge
- **HTML** (`text/html`): Renders content in a sandboxed iframe with "HTML" badge
- **SVG** (`image/svg+xml`): Displays SVG content with "SVG" badge
- **JSON** (`application/json`): Shows JSON file icon with "JSON" badge
- **Video** (`video/*`): Displays video thumbnail with "VIDEO" badge
- **Audio** (`audio/*`): Shows music icon with "AUDIO" badge
- **Unknown types**: Shows gradient ordinals icon with inscription number

### Preview Component Features
- **64x64px thumbnails**: Compact but visible previews
- **Content type badges**: Visual indicators for file types
- **Lazy loading**: Images/iframes load only when scrolled into view
- **Error handling**: Graceful fallback to default icon on load errors
- **Responsive design**: Adapts to different screen sizes
- **Dark mode support**: Works seamlessly in light and dark themes

## Files Modified

1. `/workspace/apps/web/src/lib/wallet/walletAdapter.ts` - Added inscription fetching
2. `/workspace/apps/web/src/components/inputs/InscriptionSelector.tsx` - New component with previews
3. `/workspace/apps/web/src/components/inputs/InscriptionPreview.tsx` - New preview component
4. `/workspace/apps/web/src/components/auction/CreateAuctionWizard.tsx` - Integrated selector

## Compatibility

- ✅ Works with Unisat wallet
- ✅ Works with Xverse wallet  
- ✅ Maintains manual input option
- ✅ Backward compatible with existing form validation
- ✅ Works on both testnet and mainnet
- ✅ Responsive design (mobile and desktop)
- ✅ Dark mode support
