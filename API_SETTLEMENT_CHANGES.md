# API Changes for Settlement Dashboard

## Summary
Enhanced the clearing auction settlement API to generate PSBTs for inscription transfers, enabling sellers to execute settlement through the Settlement Dashboard.

## Modified Endpoint

### POST `/api/clearing/process-settlement`

**Previous Behavior**:
- Called `processAuctionSettlement()` which marked bids as settled and returned artifacts
- Did not generate actual PSBTs for inscription transfers

**New Behavior**:
- Calls `generateSettlementPSBTs()` to create transfer PSBTs
- Calls `calculateSettlement()` to get settlement details
- Returns combined response with PSBTs and settlement information

#### Request
```json
{
  "auctionId": "string"
}
```

#### Response (New Format)
```json
{
  "ok": true,
  "data": {
    "auctionId": "auction-123",
    "clearingPrice": 25000,
    "allocations": [
      {
        "bidId": "b1",
        "bidderAddress": "tb1qbidder1address...",
        "quantity": 2
      },
      {
        "bidId": "b2",
        "bidderAddress": "tb1qbidder2address...",
        "quantity": 1
      }
    ],
    "psbts": [
      {
        "bidId": "b1",
        "inscriptionId": "insc-0",
        "toAddress": "tb1qbidder1address...",
        "psbt": "cHNidP8BAH8CAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAf///////wE..."
      },
      {
        "bidId": "b1",
        "inscriptionId": "insc-1",
        "toAddress": "tb1qbidder1address...",
        "psbt": "cHNidP8BAH8CAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAf///////wE..."
      },
      {
        "bidId": "b2",
        "inscriptionId": "insc-2",
        "toAddress": "tb1qbidder2address...",
        "psbt": "cHNidP8BAH8CAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAf///////wE..."
      }
    ]
  }
}
```

#### PSBT Object Structure
```typescript
{
  bidId: string          // ID of the bid receiving this inscription
  inscriptionId: string  // Inscription identifier from auction.inscription_ids
  toAddress: string      // Bidder's Bitcoin address
  psbt: string          // Base64-encoded PSBT for signing
}
```

#### HTTP Status Codes
- `200 OK` - PSBTs generated successfully
- `400 Bad Request` - Missing or invalid auctionId
- `500 Internal Server Error` - Auction not found or generation failed

#### Example Error Response
```json
{
  "ok": false,
  "error": "Clearing auction not found",
  "code": "INTERNAL_ERROR"
}
```

## New Database Method

### `SecureDutchyDatabase.generateSettlementPSBTs(auctionId: string)`

Added to `/packages/dutch/src/database.ts`:

```typescript
generateSettlementPSBTs(auctionId: string): { 
  success: boolean; 
  psbts: Array<{ 
    bidId: string; 
    inscriptionId: string; 
    toAddress: string; 
    psbt: string 
  }> 
}
```

**Logic**:
1. Fetch clearing auction by ID
2. Calculate settlement allocations
3. For each allocation with `payment_confirmed` status:
   - Iterate through inscription IDs for the bid's quantity
   - Create a PSBT with:
     - Input: Inscription UTXO (mock in development)
     - Output: Transfer to bidder's address at dust limit (546 sats)
   - Add network configuration
4. Return array of PSBT objects

**PSBT Structure** (per inscription):
- **Input**: 
  - Transaction ID: Inscription's UTXO txid (mock: all zeros in dev)
  - Vout: Inscription's output index (mock: 0 in dev)
  - Witness UTXO: Script and value (546 sats)
- **Output**:
  - Script: Bidder's address script
  - Value: 546 sats (dust limit)

**Error Handling**:
- Falls back to mock PSBT string if bitcoinjs-lib fails
- Skips bids that are not in `payment_confirmed` status
- Throws error if auction doesn't exist

## Workflow Changes

### Old Workflow
1. Seller calls `/api/clearing/process-settlement`
2. Bids are immediately marked as `settled`
3. No actual Bitcoin transactions created

### New Workflow
1. Seller calls `/api/clearing/process-settlement`
2. PSBTs are generated and returned
3. Seller signs each PSBT using Bitcoin wallet
4. Seller broadcasts signed PSBTs to Bitcoin network
5. Seller calls `/api/clearing/mark-settled` with bidIds
6. Bids are marked as `settled`

## Backward Compatibility

⚠️ **Breaking Change**: The response format of `/api/clearing/process-settlement` has changed.

**Migration Guide**:
- Old code expecting `artifacts` field should use `psbts` field instead
- Old code marking bids as settled automatically should now:
  1. Process PSBTs (sign & broadcast)
  2. Call `/api/clearing/mark-settled` explicitly

**Example Migration**:

**Before**:
```typescript
const response = await fetch('/api/clearing/process-settlement', {
  method: 'POST',
  body: JSON.stringify({ auctionId })
});
const { artifacts } = await response.json();
// Bids already settled at this point
```

**After**:
```typescript
const response = await fetch('/api/clearing/process-settlement', {
  method: 'POST',
  body: JSON.stringify({ auctionId })
});
const { psbts, allocations, clearingPrice } = await response.json();

// Sign and broadcast PSBTs
for (const psbt of psbts) {
  const signed = await walletSignPSBT(psbt.psbt);
  const txid = await broadcastTransaction(signed);
}

// Mark as settled
await fetch('/api/clearing/mark-settled', {
  method: 'POST',
  body: JSON.stringify({ 
    auctionId, 
    bidIds: psbts.map(p => p.bidId) 
  })
});
```

## Related Endpoints (Unchanged)

These endpoints remain the same and work with the new workflow:

### GET `/api/clearing/bids/:auctionId`
Returns all bids for an auction with their status.

### GET `/api/clearing/settlement/:auctionId`
Calculates settlement details (clearing price, allocations).

### POST `/api/clearing/mark-settled`
Marks specified bids as settled (called after broadcasting).

### POST `/api/clearing/create-bid-payment`
Creates a bid with payment escrow address.

### POST `/api/clearing/confirm-bid-payment`
Confirms payment for a bid (transitions to `payment_confirmed`).

## Security Considerations

1. **PSBT Validation**: 
   - Sellers should validate PSBT contents before signing
   - Verify inscription IDs match expected values
   - Check output addresses match bidder addresses

2. **State Management**:
   - PSBTs are only generated for `payment_confirmed` bids
   - Idempotent: Calling process-settlement multiple times returns same PSBTs
   - Bids in `settled` status are excluded from new PSBTs

3. **Private Key Security**:
   - Private keys never leave the signing device
   - PSBTs enable offline signing with hardware wallets
   - API never has access to seller's private keys

## Testing

### Test Coverage Added
- `/apps/api/src/__tests__/settlement-dashboard.api.test.ts`
  - Complete settlement workflow with PSBT generation
  - Validation of PSBT structure
  - Idempotent settlement marking
  - Clearing price calculation

### Manual Testing Steps
1. Create a clearing auction
2. Place and confirm multiple bids
3. Call process-settlement endpoint
4. Verify PSBT structure in response
5. (Simulate) Sign and broadcast PSBTs
6. Call mark-settled endpoint
7. Verify bid status updated to `settled`

## Future Enhancements

1. **Real UTXO Fetching**: 
   - Integrate with mempool API to fetch actual inscription UTXOs
   - Parse inscription IDs (format: `<txid>i<vout>`)

2. **Fee Optimization**:
   - Calculate optimal transaction fees based on network conditions
   - Support CPFP (Child Pays For Parent) for stuck transactions

3. **Batch Settlement**:
   - Combine multiple inscription transfers into one transaction
   - Reduce transaction fees for large auctions

4. **Transaction Monitoring**:
   - Track PSBT signing status
   - Monitor transaction confirmations
   - Detect and handle failed broadcasts

5. **Wallet Integration**:
   - Direct integration with Unisat, Xverse, Leather wallets
   - Support for hardware wallets (Ledger, Trezor)

## Documentation Updates

- Added PSBT generation to API documentation
- Updated Swagger schema for process-settlement endpoint
- Created Settlement Dashboard user guide
- Added clearing auction workflow diagram

## Deployment Checklist

- [ ] Review PSBT generation logic for production readiness
- [ ] Configure Bitcoin network (mainnet/testnet)
- [ ] Test with real inscription UTXOs
- [ ] Integrate with actual mempool API
- [ ] Set up transaction monitoring
- [ ] Configure error alerting
- [ ] Update API documentation
- [ ] Train support staff on settlement process

## Contact

For questions or issues with the settlement API:
- Review `/swagger` endpoint for interactive API docs
- Check audit logs for settlement events
- Monitor database for bid status transitions
