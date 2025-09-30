# Task 2: PSBT Signing Workflow - Testing Guide

## Prerequisites

### 1. Bitcoin Wallet Setup
- **Install Unisat Wallet** (recommended): https://unisat.io/download
  - Available for Chrome, Brave, Firefox
  - Best support for Ordinals and inscriptions
- **Alternative wallets:** Xverse, Leather (Hiro)

### 2. Testnet Configuration
1. Open your wallet extension
2. Switch network to **Bitcoin Testnet**
   - Unisat: Settings → Network → Testnet
   - Xverse: Settings → Network → Bitcoin Testnet
   - Leather: Settings → Network → Testnet

### 3. Get Testnet BTC
1. Visit a testnet faucet:
   - https://testnet-faucet.mempool.co/
   - https://coinfaucet.eu/en/btc-testnet/
2. Enter your testnet address from wallet
3. Wait for confirmation (usually 10-20 minutes)
4. You need at least ~0.001 tBTC for transaction fees

### 4. Get a Testnet Inscription
For testing, you can use any valid testnet inscription TXID in the format: `<txid>i<vout>`

Example format: `abc123def456...i0`

If you don't have a real inscription, you can create a test one on testnet or use the demo mode (if available).

## Environment Setup

### 1. Set Environment Variables
```bash
# In /workspace/apps/api/.env
AUCTION_ENCRYPTION_PASSWORD=your-secure-password-here
BITCOIN_NETWORK=testnet
```

### 2. Start the Application
```bash
# From /workspace root
bun install
bun run dev
```

This will start:
- API server on http://localhost:3000
- Web frontend on http://localhost:4321

## Test Scenarios

### Scenario 1: Happy Path - Complete Auction Creation Flow

**Objective:** Test the complete PSBT signing workflow from start to finish

**Steps:**
1. Navigate to http://localhost:4321/auctions/create
2. Fill in the form:
   - **Title:** "Test Inscription Auction"
   - **Description:** "Testing PSBT signing workflow"
   - **Inscription IDs:** Enter your testnet inscription ID (one per line)
     ```
     abc123def456789...i0
     ```
   - **Start Price:** 0.001 BTC
   - **End Price:** 0.0005 BTC
   - **Decrement Amount:** 0.0001 BTC
   - **Decrement Interval:** 60 seconds
   - **Start Time:** Current time (use Quick Timing: "Start in 0 days")
   - **Duration:** 1 hour
3. Click through the wizard steps (Next → Next → ... → Review)
4. On the Review page, verify all details
5. Click **"Create auction"**

**Expected Results:**
- ✅ Stage 1 (Wallet Connect): Wallet popup appears asking to connect
  - Approve the connection
  - Should see your testnet address
- ✅ Stage 2 (API Call): Loading spinner with "Creating Auction..."
  - Should take 2-5 seconds
  - API validates inscription ownership
  - API generates PSBT
- ✅ Stage 3 (Signing): Screen shows:
  - "Sign with Wallet" heading
  - Auction ID and address
  - Inscription details (TXID, vout)
  - Large blue "Sign with Wallet" button
- ✅ Stage 4 (Wallet Signing): Click "Sign with Wallet"
  - Wallet popup shows PSBT details
  - Shows transaction fee
  - Shows destination address (auction address)
  - Approve the signature
- ✅ Stage 5 (Broadcasting): Loading spinner with "Broadcasting Transaction..."
  - Should take 1-3 seconds
  - Transaction sent to mempool
- ✅ Stage 6 (Confirming): Screen shows:
  - "Waiting for Confirmation" heading
  - Transaction ID (full hash)
  - Link to mempool.space explorer (clickable)
  - Confirmation counter: "0/1"
  - Loading spinner
  - Counter updates every 5 seconds
- ✅ Stage 7 (Success): After ~10-30 minutes (testnet block time):
  - Counter shows "1/1"
  - Success screen appears
  - "Auction Created Successfully!" message
  - Option to create another auction or go home

**What to Verify:**
- Transaction appears on mempool.space
- Inscription UTXO is spent (moved to auction address)
- Auction record has transaction_id stored
- Auction status is 'active'

### Scenario 2: User Rejects Wallet Connection

**Objective:** Test error handling when user rejects wallet connection

**Steps:**
1. Navigate to auction creation
2. Fill in form and click "Create auction"
3. When wallet popup appears, click **"Cancel"** or **"Reject"**

**Expected Results:**
- ❌ Error screen appears
- Error message: "Failed to connect wallet" or similar
- Red "Try Again" button appears
- Clicking "Try Again" resets to form

### Scenario 3: User Rejects PSBT Signing

**Objective:** Test error handling when user rejects PSBT signing

**Steps:**
1. Navigate to auction creation
2. Fill in form and click "Create auction"
3. Approve wallet connection
4. Wait for "Sign with Wallet" screen
5. Click "Sign with Wallet"
6. When wallet popup appears, click **"Cancel"** or **"Reject"**

**Expected Results:**
- ❌ Error screen appears
- Error message: "User rejected the signing request"
- Red "Try Again" button appears
- Can retry signing without starting over

### Scenario 4: Invalid Inscription ID

**Objective:** Test validation of inscription ownership

**Steps:**
1. Navigate to auction creation
2. Enter an **invalid or non-existent** inscription ID:
   - Wrong format: `invalid-inscription-id`
   - Or non-existent TXID: `0000000000000000000000000000000000000000000000000000000000000000i0`
3. Fill in other fields and submit

**Expected Results:**
- ❌ API returns error
- Error screen shows: "Transaction not found" or "Invalid inscriptionId format"
- Red "Try Again" button appears

### Scenario 5: Inscription Already Spent

**Objective:** Test handling of already-spent inscriptions

**Steps:**
1. Use an inscription ID that's already been spent/moved
2. Fill in form and submit
3. Approve wallet connection

**Expected Results:**
- ❌ API validation fails
- Error message: "Inscription UTXO already spent"
- HTTP 403 Forbidden
- Can retry with different inscription

### Scenario 6: Ownership Mismatch

**Objective:** Test that seller must own the inscription

**Steps:**
1. Use an inscription ID that exists but is NOT in your wallet
2. Fill in form and submit
3. Approve wallet connection

**Expected Results:**
- ❌ API validation fails
- Error message: "Ownership mismatch for inscription UTXO"
- HTTP 403 Forbidden
- Must use inscription in connected wallet

### Scenario 7: Network Mismatch

**Objective:** Test network validation

**Steps:**
1. Connect wallet on **mainnet**
2. Try to create auction (API is on testnet)

**Expected Results:**
- ⚠️ Transaction might fail at broadcast
- Error: Network mismatch or validation failure
- Switch wallet to testnet to proceed

### Scenario 8: Confirmation Polling Timeout

**Objective:** Test behavior when confirmation takes too long

**Steps:**
1. Create auction with very low fee (if possible)
2. Complete signing and broadcasting
3. Wait for polling to timeout (5 minutes = 60 attempts × 5s)

**Expected Results:**
- ⏱️ Polling continues for max 5 minutes
- If no confirmation by timeout:
  - Error message: "Timeout: Transaction did not reach 1 confirmation(s)"
  - Transaction ID still shown
  - Can check mempool manually
  - Auction may still confirm later

**Note:** In practice, testnet blocks come every 10-30 minutes, so this might not timeout.

## Manual API Testing

### Test PSBT Generation Endpoint

```bash
# Test create-auction endpoint directly
curl -X POST http://localhost:3000/api/create-auction \
  -H "Content-Type: application/json" \
  -d '{
    "asset": "YOUR_INSCRIPTION_ID_HERE",
    "startPrice": 0.001,
    "minPrice": 0.0005,
    "duration": 3600,
    "decrementInterval": 60,
    "sellerAddress": "YOUR_TESTNET_ADDRESS_HERE"
  }'
```

**Expected Response:**
```json
{
  "ok": true,
  "data": {
    "id": "auction_id_here",
    "address": "tb1q...",
    "psbt": "cHNidP8BAH...",
    "inscriptionInfo": {
      "txid": "abc123...",
      "vout": 0,
      "address": "tb1q...",
      "value": 546,
      "spent": false
    }
  }
}
```

### Test Confirm Escrow Endpoint

```bash
# After broadcasting transaction
curl -X POST http://localhost:3000/api/auction/AUCTION_ID/confirm-escrow \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "YOUR_TXID_HERE",
    "signedPsbt": "SIGNED_PSBT_BASE64_HERE"
  }'
```

**Expected Response:**
```json
{
  "ok": true,
  "data": {
    "auctionId": "auction_id",
    "transactionId": "txid...",
    "status": "escrowed",
    "escrowUpdate": { ... }
  }
}
```

## Browser Console Debugging

Open browser DevTools (F12) and check:

### Console Logs
Look for these log messages:
- `"Auction created, PSBT generated:"`
- `"PSBT signed successfully"`
- `"Transaction broadcast:"`
- `"PSBT signing workflow failed:"` (on errors)

### Network Tab
Check these API calls:
1. `POST /api/create-auction` - Should return 200 with PSBT
2. `POST /api/auction/:id/confirm-escrow` - Should return 200
3. `POST https://mempool.space/testnet/api/tx` - Transaction broadcast
4. `GET https://mempool.space/testnet/api/tx/:txid` - Status polling

### Application Tab → Local Storage
Check for:
- `auction-create-draft-v1` - Form draft (should be cleared after success)

## Troubleshooting

### "No Bitcoin wallet detected"
- **Solution:** Install Unisat, Xverse, or Leather wallet extension
- Refresh the page after installation

### "Wallet not connected"
- **Solution:** Click connect in wallet extension first
- Some wallets require manual connection before use

### "Transaction not found"
- **Solution:** Verify inscription ID format: `<64-char-hex-txid>i<number>`
- Check that transaction exists on testnet mempool

### "Ownership mismatch for inscription UTXO"
- **Solution:** Inscription must be in the connected wallet's address
- Switch to wallet that owns the inscription

### "Broadcast failed: insufficient fee"
- **Issue:** Fixed 500 sat fee might be too low
- **Workaround:** Wait for mempool to clear, or increase fee in code

### "CORS error"
- **Solution:** Make sure API is running on localhost:3000
- Check ALLOWED_ORIGINS environment variable

### Confirmation never arrives
- **Testnet blocks are slow:** Can take 10-30 minutes
- **Check mempool:** Click the mempool.space link
- **Status:** Look for "In mempool" or "Confirmed"

## Performance Benchmarks

Expected timing for each stage:

| Stage | Expected Duration | Notes |
|-------|------------------|-------|
| Wallet Connect | 1-3 seconds | User approval time |
| API Call | 2-5 seconds | Depends on mempool.space API |
| Signing Prompt | 0.5 seconds | Display time |
| Wallet Signing | 2-10 seconds | User approval + wallet processing |
| Broadcasting | 1-3 seconds | Network latency |
| First Poll | 5 seconds | Initial check |
| Subsequent Polls | 5 seconds | Until confirmation |
| Confirmation | 10-30 minutes | Testnet block time (varies) |

Total time (excluding confirmation): **~10-25 seconds**
Total time (including confirmation): **~10-30 minutes**

## Success Indicators

You've successfully completed testing when you can:

✅ Create an auction from start to finish
✅ See transaction on mempool.space
✅ Watch confirmation counter update from 0/1 to 1/1
✅ See auction marked as active in database
✅ Handle errors gracefully (user rejection, network errors)
✅ Retry failed operations

## Next Steps After Testing

1. **Test on mainnet testnet thoroughly** - Don't skip to mainnet!
2. **Test with real inscriptions** - Use your own Ordinals
3. **Monitor gas prices** - Adjust fee calculation if needed
4. **Load testing** - Multiple concurrent auctions
5. **Security audit** - Review encryption and key management
6. **User acceptance testing** - Have real users try the flow

## Support

If you encounter issues during testing:

1. Check browser console for errors
2. Check API logs: `bun --cwd apps/api run dev` output
3. Verify environment variables are set
4. Check network connectivity to mempool.space
5. Ensure wallet is on correct network (testnet)

## Reporting Issues

When reporting issues, include:
- Browser and wallet version
- Network (testnet/mainnet)
- Console logs (DevTools F12 → Console)
- Transaction ID (if available)
- Steps to reproduce
- Screenshots of error screens
