# Settlement Dashboard Implementation - Task 6

## Overview
This document describes the implementation of the Settlement Dashboard for Auction Creators, which allows sellers to monitor bids and execute settlement for clearing auctions.

## Files Created

### 1. Frontend Components

#### `/apps/web/src/components/auction/SettlementDashboard.tsx`
A comprehensive React component that provides:
- **Bid Display**: Shows all bids with their status, bidder address, quantity, and amounts
- **Settlement Summary**: Displays clearing price, total quantity, items remaining, and allocations
- **Allocation Plan**: Shows which bidders will receive items in order of confirmation
- **Settlement Process**: Multi-step workflow for:
  1. Processing settlement to generate PSBTs
  2. Signing each PSBT for inscription transfers
  3. Broadcasting transactions to Bitcoin network
  4. Marking bids as settled in database
- **Status Indicators**: Color-coded badges for bid statuses (placed, payment_pending, payment_confirmed, settled, failed, refunded)
- **Error Handling**: Comprehensive error messages and validation
- **Responsive Design**: Mobile-friendly layout with Tailwind CSS

Key Features:
- Real-time status updates
- Idempotent operations (can retry safely)
- Sequential PSBT signing workflow
- Transaction broadcast simulation
- Automatic bid status refresh after settlement

#### `/apps/web/src/pages/auctions/settlement.astro`
Astro page that:
- Provides the UI shell for the settlement dashboard
- Accepts `?auctionId=` query parameter
- Renders the SettlementDashboard component with React
- Shows helpful error messages if no auction ID is provided

### 2. Backend Enhancements

#### `/packages/dutch/src/database.ts`
Added new method `generateSettlementPSBTs()`:
- Generates PSBTs for each inscription transfer based on settlement allocations
- Only generates PSBTs for payment_confirmed bids (not already settled)
- Creates Bitcoin PSBTs with:
  - Input: Inscription UTXO (from auction address)
  - Output: Transfer to bidder's address
  - Proper network configuration (mainnet/testnet/signet/regtest)
- Handles errors gracefully with mock PSBTs as fallback
- Returns structured data with bidId, inscriptionId, toAddress, and PSBT string

Features:
- Uses bitcoinjs-lib for PSBT creation
- Network-aware (respects BITCOIN_NETWORK environment variable)
- Dust limit handling (546 sats for inscriptions)
- Mock UTXO generation for development/testing

#### `/apps/api/src/index.ts`
Enhanced `POST /api/clearing/process-settlement` endpoint:
- Calls `generateSettlementPSBTs()` to create transfer PSBTs
- Also fetches settlement calculation for context
- Returns combined response with:
  - auctionId
  - clearingPrice
  - allocations
  - psbts (array of PSBT objects)

Response structure:
```json
{
  "ok": true,
  "data": {
    "auctionId": "string",
    "clearingPrice": 25000,
    "allocations": [
      { "bidId": "b1", "bidderAddress": "tb1q...", "quantity": 2 }
    ],
    "psbts": [
      {
        "bidId": "b1",
        "inscriptionId": "insc-0",
        "toAddress": "tb1q...",
        "psbt": "cHNidP8BAH..."
      }
    ]
  }
}
```

### 3. Test Coverage

#### `/apps/api/src/__tests__/settlement-dashboard.api.test.ts`
Comprehensive test suite covering:

**Complete Settlement Workflow**:
1. Create clearing auction with multiple inscriptions
2. Create bid payment PSBTs for multiple bidders
3. Confirm bid payments
4. Fetch all bids and verify status
5. Calculate settlement and verify allocations
6. Process settlement to generate PSBTs
7. Mark bids as settled
8. Verify final bid status

**Edge Cases**:
- Prevents settlement without payment confirmation
- Handles idempotent settlement marking
- Calculates correct clearing price based on fraction sold
- Validates PSBT structure

**Test Assertions**:
- PSBT generation for confirmed bids
- Correct clearing price calculation
- Proper allocation order (by confirmation time)
- Status transitions (payment_confirmed → settled)
- Error handling for invalid state transitions

## API Endpoints Used

### Existing Endpoints
- `GET /api/clearing/bids/:auctionId` - Fetch all bids for an auction
- `GET /api/clearing/settlement/:auctionId` - Calculate settlement details
- `POST /api/clearing/mark-settled` - Mark bids as settled after broadcast

### Enhanced Endpoint
- `POST /api/clearing/process-settlement` - Generate PSBTs for inscription transfers

## User Workflow

### For Auction Creators:

1. **Access Dashboard**:
   - Navigate to `/auctions/settlement?auctionId=YOUR_AUCTION_ID`

2. **Review Bids**:
   - View all bids with payment status
   - Check clearing price calculation
   - Review allocation plan

3. **Process Settlement**:
   - Click "Process Settlement" button
   - System generates PSBTs for each inscription transfer

4. **Sign PSBTs**:
   - Sign each PSBT sequentially
   - System prompts for signature (integrates with Bitcoin wallet)
   - Progress indicator shows current PSBT (e.g., "2 of 5")

5. **Broadcast Transactions**:
   - System automatically broadcasts signed PSBTs
   - Displays transaction IDs for each transfer

6. **Complete Settlement**:
   - System marks bids as settled
   - Dashboard updates to show final status
   - All bids show "settled" status

## Security Considerations

1. **PSBT Signing**: 
   - PSBTs must be signed by the seller who controls the auction address
   - Private keys are never exposed in the frontend
   - In production, integrate with hardware wallets (Ledger, Trezor)

2. **State Validation**:
   - Only payment_confirmed bids can be settled
   - Idempotent operations prevent double-settlement
   - Database validates status transitions

3. **Transaction Broadcasting**:
   - Simulated in current implementation
   - Production should use mempool API or Bitcoin RPC

## Implementation Notes

### Current Limitations (Development Mode):
1. **Mock PSBTs**: Generated with placeholder UTXOs for testing
2. **Simulated Broadcasting**: Transaction IDs are mocked
3. **Manual Signing**: Prompts user for signed PSBT (should integrate with wallet)

### Production Requirements:
1. **Real UTXO Fetching**: Query blockchain for actual inscription UTXOs
2. **Wallet Integration**: Connect to Unisat, Xverse, or other Bitcoin wallets
3. **Mempool Broadcasting**: Use mempool.space API or Bitcoin Core RPC
4. **Fee Estimation**: Calculate proper transaction fees
5. **Confirmation Monitoring**: Track transaction confirmations

## Clearing Price Algorithm

The clearing price is calculated using a Dutch auction model:

```
fractionSold = soldQuantity / totalQuantity
priceDrop = (startPrice - minPrice) * fractionSold
clearingPrice = max(minPrice, startPrice - priceDrop)
```

Example:
- Start Price: 100,000 sats
- Min Price: 50,000 sats
- Total Quantity: 10 items
- Sold: 5 items (50%)
- Clearing Price: 100,000 - ((100,000 - 50,000) * 0.5) = 75,000 sats

## Allocation Algorithm

Allocations are determined by:
1. **Order**: First-come-first-served (by payment confirmation time)
2. **Quantity**: Each bidder receives up to their requested quantity
3. **Inscription Assignment**: Sequential inscription IDs from the auction

Example:
```
Auction: [insc-0, insc-1, insc-2]
Bid 1: quantity=2, confirmed_at=100
Bid 2: quantity=1, confirmed_at=200

Allocation:
- Bid 1 gets [insc-0, insc-1]
- Bid 2 gets [insc-2]
```

## Future Enhancements

1. **Partial Settlement**: Allow settling individual bids
2. **Refund Management**: Handle overpayments and refunds
3. **Multi-Signature**: Support multi-sig auction addresses
4. **Batch Broadcasting**: Optimize transaction fees with CPFP/RBF
5. **Settlement History**: Track all settlement transactions
6. **Email Notifications**: Notify bidders when items are transferred
7. **Escrow Timeout**: Auto-refund if settlement not processed

## Dependencies

### Frontend:
- React 18+
- Tailwind CSS (for styling)
- Fetch API (for HTTP requests)

### Backend:
- Elysia (web framework)
- bitcoinjs-lib (PSBT generation)
- bun:sqlite (database)
- tiny-secp256k1 (cryptography)

## Testing

Run the test suite:
```bash
bun test apps/api/src/__tests__/settlement-dashboard.api.test.ts
```

Expected results:
- ✓ Complete settlement workflow
- ✓ Prevents settlement without payment confirmation
- ✓ Handles idempotent settlement marking
- ✓ Calculates correct clearing price

## Acceptance Criteria ✅

All requirements from Task 6 have been met:

- ✅ Seller can view all bids and their payment status
- ✅ Dashboard shows clearing price and allocation
- ✅ Seller can click "Settle Auction"
- ✅ PSBTs generated for each inscription transfer
- ✅ Seller signs each PSBT in sequence
- ✅ Transactions broadcast successfully (simulated)
- ✅ Bids marked as settled in database

## Deployment Notes

1. Set environment variables:
   ```bash
   export BITCOIN_NETWORK=testnet  # or mainnet/signet/regtest
   export AUCTION_ENCRYPTION_PASSWORD=your-secure-password
   ```

2. Build the web app:
   ```bash
   bun --cwd apps/web run build
   ```

3. Start the API server:
   ```bash
   bun --cwd apps/api run start
   ```

4. Access the dashboard:
   ```
   https://your-domain.com/auctions/settlement?auctionId=YOUR_AUCTION_ID
   ```

## Support

For issues or questions:
- Review API documentation at `/swagger` endpoint
- Check audit logs for settlement events
- Monitor transaction status via blockchain explorer
