# Inscription Ownership Verification - Usage Guide

## Quick Start

### For Users Creating Auctions

1. **Navigate to Create Auction Page**
2. **Fill in Basic Information** (title, description)
3. **Enter Inscription Details:**
   - Paste your inscription IDs (one per line)
   - Format: `<txid>i<vout>` (e.g., `abc123...def456i0`)
   - Enter your Bitcoin address (the address that owns the inscriptions)
4. **Configure Pricing and Timing**
5. **Review and Submit**
   - The system will automatically verify ownership
   - Wait for verification to complete (shows loading indicator)
   - If verification fails, error messages will explain why
6. **On Success:** Auction is created and ready to go!

### Example Inscription ID Formats

✅ **Valid:**
```
3f8d2a1b4c5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2bi0
abc123def456789012345678901234567890123456789012345678901234567890i1
```

❌ **Invalid:**
```
abc123i0                    (txid too short)
not-a-valid-inscription     (wrong format)
abc123def456...i-1          (negative vout)
```

### Example Bitcoin Addresses

✅ **Valid:**
```
bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh    (mainnet P2WPKH)
tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx    (testnet P2WPKH)
```

❌ **Invalid:**
```
not-a-bitcoin-address
bc1qinvalid
```

## Error Messages Explained

### "Ownership mismatch"
- **Cause:** The Bitcoin address you provided doesn't own the inscription
- **Solution:** 
  - Double-check you entered the correct address
  - Verify the inscription ID is correct
  - Ensure you're using the address that currently holds the inscription

### "Inscription already spent"
- **Cause:** The inscription has been transferred to another address
- **Solution:**
  - If you transferred it, use the new owner address
  - If someone else owns it now, you cannot auction it

### "Transaction not found"
- **Cause:** The transaction doesn't exist on the blockchain
- **Solution:**
  - Verify the inscription ID is correct
  - Check you're on the right network (testnet vs mainnet)
  - Wait if the transaction is very recent and not yet confirmed

### "Output not found"
- **Cause:** The vout index doesn't exist in the transaction
- **Solution:**
  - Check the inscription ID format (especially the number after 'i')
  - Verify you copied the complete inscription ID

## For Developers

### Using the Verification API Directly

```typescript
import { verifyInscriptionOwnership } from '@/lib/bitcoin/verifyInscription'

const result = await verifyInscriptionOwnership(
  'abc123...def456i0',  // inscription ID
  'bc1q...',             // seller address
  'testnet'              // network
)

if (result.valid) {
  console.log('✓ Verified!', result.details)
} else {
  console.error('✗ Failed:', result.error)
}
```

### Batch Verification

```typescript
import { verifyMultipleInscriptions, checkAllValid } from '@/lib/bitcoin/verifyInscription'

const inscriptionIds = [
  'abc123...def456i0',
  'xyz789...abc123i1',
]

const results = await verifyMultipleInscriptions(
  inscriptionIds,
  'bc1q...',
  'testnet'
)

const { allValid, errors } = checkAllValid(results)

if (allValid) {
  console.log('✓ All verified!')
} else {
  errors.forEach(err => console.error(err.error))
}
```

### Network Configuration

Set the network via environment variable:

```bash
# .env
PUBLIC_BITCOIN_NETWORK=testnet  # or mainnet, signet, regtest
```

If not set, defaults to `testnet` for safety.

## API Endpoints

### Client-Side Verification
The frontend automatically calls `verifyInscriptionOwnership()` before submission.

### Server-Side Verification
The API endpoint `POST /api/create-auction` performs verification again as a security measure.

## Testing Checklist

- [ ] Valid inscription on testnet
- [ ] Valid inscription on mainnet  
- [ ] Invalid inscription ID format
- [ ] Wrong seller address (ownership mismatch)
- [ ] Already spent inscription
- [ ] Non-existent transaction
- [ ] Multiple inscriptions (some valid, some invalid)
- [ ] Network mismatch (mainnet inscription on testnet)

## Troubleshooting

### Verification Takes Too Long
- Check network connection
- mempool.space API might be slow
- Try again in a few seconds

### "Cannot verify on regtest"
- Regtest uses localhost:3002 API
- Ensure local mempool API is running

### TypeScript Errors
- Most TypeScript errors are related to missing type definitions (React, Bun)
- These don't affect runtime functionality
- Run `bun install` to ensure all dependencies are installed

## Network URLs

The verification system uses mempool.space APIs:

- **Mainnet:** https://mempool.space/api
- **Testnet:** https://mempool.space/testnet/api
- **Signet:** https://mempool.space/signet/api
- **Regtest:** http://localhost:3002/api (requires local setup)

## Support

For issues or questions:
1. Check the error message for specific guidance
2. Verify inscription ID and address format
3. Confirm you're on the correct network
4. Review the implementation in `apps/web/src/lib/bitcoin/verifyInscription.ts`
