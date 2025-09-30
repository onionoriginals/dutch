# Bid State Machine

## State Diagram

```
┌─────────┐
│ placed  │ Initial state when bid is placed without payment
└────┬────┘
     │
     │ (Not typically used in payment flow)
     │
     ▼
┌────────────────┐
│ payment_pending │ Bid payment PSBT created, awaiting transaction
└────────┬───────┘
         │
         │ confirmBidPayment(bidId, txId)
         │ ✓ Valid transaction ID
         │ ✓ Bid exists
         │
         ▼
┌──────────────────┐
│ payment_confirmed │ Transaction confirmed on-chain
└─────────┬────────┘
          │
          │ processAuctionSettlement(auctionId) OR
          │ markBidsSettled(auctionId, [bidIds])
          │ ✓ Auction exists
          │ ✓ Settlement conditions met
          │
          ▼
     ┌─────────┐
     │ settled │ Inscriptions allocated to bidder
     └─────────┘


Alternative paths:

┌────────────────┐
│ payment_pending │
└────────┬───────┘
         │
         │ (Failed transaction or timeout)
         │
         ▼
     ┌────────┐
     │ failed │ Payment failed, can be retried
     └────────┘


┌──────────────────┐
│ payment_confirmed │
└─────────┬────────┘
          │
          │ (Refund initiated)
          │
          ▼
     ┌──────────┐
     │ refunded │ Payment returned to bidder
     └──────────┘
```

## State Transition Rules

### Valid Transitions

| From               | To                 | Method                   | Conditions                                    |
|--------------------|--------------------|--------------------------|-----------------------------------------------|
| `payment_pending`  | `payment_confirmed`| `confirmBidPayment()`    | Valid transaction ID provided                 |
| `payment_confirmed`| `settled`          | `processAuctionSettlement()` | Auction settlement processed              |
| `payment_confirmed`| `settled`          | `markBidsSettled()`      | Manual settlement marking                     |
| `payment_pending`  | `failed`           | (Future enhancement)     | Transaction failed or timed out               |
| `payment_confirmed`| `refunded`         | (Future enhancement)     | Refund processed                              |

### Invalid Transitions (Rejected)

| From          | To       | Method                       | Error Message                                              |
|---------------|----------|------------------------------|------------------------------------------------------------|
| `placed`      | `payment_confirmed` | `confirmBidPayment()`   | "Cannot confirm payment for bid in status: placed. Expected payment_pending." |
| `placed`      | `settled`| `markBidsSettled()`          | "Cannot settle bid with status: placed. Payment must be confirmed first." |
| `payment_pending` | `settled` | `markBidsSettled()`     | "Cannot settle bid with status: payment_pending. Payment must be confirmed first." |
| `settled`     | Any      | Any                          | N/A (terminal state, idempotent operations allowed) |

### Idempotent Transitions

| From               | To                 | Method                   | Behavior                                      |
|--------------------|--------------------|--------------------------|-----------------------------------------------|
| `payment_confirmed`| `payment_confirmed`| `confirmBidPayment()`    | Returns `{ success: true, alreadyConfirmed: true }` if same txId |
| `settled`          | `settled`          | `markBidsSettled()`      | Counts as successful, no state change         |
| `settled`          | `settled`          | `processAuctionSettlement()` | Skips bid, no new artifacts generated    |

## Method-Specific Validation

### `createBidPaymentPSBT(auctionId, bidderAddress, bidAmount, quantity)`

**Pre-conditions:**
- ✓ Auction exists
- ✓ Auction status is `active`
- ✓ Bidder address is valid for current network
- ✓ Bid amount > 0
- ✓ Quantity > 0
- ✓ Quantity ≤ auction.itemsRemaining

**Creates bid in state:** `payment_pending`

**Returns:**
```typescript
{
  escrowAddress: string,  // Network-specific address
  bidId: string          // Unique bid identifier
}
```

### `confirmBidPayment(bidId, transactionId)`

**Pre-conditions:**
- ✓ Bid exists
- ✓ Bid status is `payment_pending` OR `payment_confirmed` (idempotent)
- ✓ Transaction ID is valid string

**Idempotency:**
- If already `payment_confirmed` with same `transactionId`, returns success with `alreadyConfirmed: true`
- If already `payment_confirmed` with different `transactionId`, rejects (prevents double-spend)

**Transitions:** `payment_pending` → `payment_confirmed`

**Returns:**
```typescript
{
  success: true,
  alreadyConfirmed?: boolean  // Present if idempotent call
}
```

### `processAuctionSettlement(auctionId)`

**Pre-conditions:**
- ✓ Auction exists
- ✓ At least one bid with status `payment_confirmed`

**Per-bid validation:**
- ✓ Bid status is `payment_confirmed` OR `settled`
- ✗ Rejects if bid status is `placed`, `payment_pending`, `failed`, or `refunded`

**Idempotency:**
- Skips bids already in `settled` state
- Generates artifacts only for newly settled bids

**Transitions:** `payment_confirmed` → `settled` (for multiple bids)

**Returns:**
```typescript
{
  success: true,
  artifacts: Array<{
    bidId: string,
    inscriptionId: string,
    toAddress: string
  }>
}
```

### `markBidsSettled(auctionId, bidIds[])`

**Pre-conditions:**
- ✓ Auction exists
- ✓ Bid IDs belong to auction

**Per-bid validation:**
- ✓ Bid exists in auction
- ✓ Bid status is `payment_confirmed` OR `settled`
- ✗ Rejects bids with status `placed`, `payment_pending`, `failed`, or `refunded`

**Idempotency:**
- Bids already `settled` count towards `updated` count
- No state change for already settled bids

**Partial success:**
- Continues processing all bids even if some fail
- Returns errors for failed bids

**Transitions:** `payment_confirmed` → `settled` (for multiple bids)

**Returns:**
```typescript
{
  success: true,
  updated: number,
  errors?: Array<{
    bidId: string,
    error: string
  }>
}
```

## Error Handling Patterns

### Validation Errors (400 Bad Request)

**Examples:**
```
"Quantity must be greater than zero"
"Insufficient items available. Requested: 5, Available: 2"
"Invalid testnet address format (expected tb1...)"
"Bid amount must be greater than zero"
"Cannot confirm payment for bid in status: placed. Expected payment_pending."
"Cannot settle bid b123 with status: payment_pending. Payment must be confirmed first."
```

### Not Found Errors (404 Not Found)

**Examples:**
```
"Bid not found"
"Clearing auction not found"
"Auction not found"
```

### Conflict Errors (409 Conflict)

**Examples:**
```
"Auction not active"
```

### Multi-Status (207 Multi-Status)

Used when some operations succeed and others fail:
```json
{
  "success": true,
  "updated": 2,
  "errors": [
    {
      "bidId": "b3",
      "error": "Cannot settle bid with status: payment_pending. Payment must be confirmed first."
    }
  ]
}
```

## Usage Examples

### Happy Path: Create → Confirm → Settle

```typescript
// 1. Create auction
const auction = db.createClearingPriceAuction({
  id: 'auction-1',
  inscription_ids: ['insc-0', 'insc-1'],
  quantity: 2,
  // ... other fields
});

// 2. Create bid payment
const payment = db.createBidPaymentPSBT(
  'auction-1',
  'tb1qbuyer',
  10000,
  1
);
// Returns: { escrowAddress: 'tb1q...', bidId: 'b1' }
// Bid state: payment_pending

// 3. Confirm payment
const confirm = db.confirmBidPayment('b1', 'tx_abc123');
// Returns: { success: true }
// Bid state: payment_confirmed

// 4. Settle
const settlement = db.processAuctionSettlement('auction-1');
// Returns: { success: true, artifacts: [...] }
// Bid state: settled
```

### Idempotency Example

```typescript
// First confirmation
const confirm1 = db.confirmBidPayment('b1', 'tx_abc123');
// Returns: { success: true }

// Second confirmation with same txId (e.g., retry)
const confirm2 = db.confirmBidPayment('b1', 'tx_abc123');
// Returns: { success: true, alreadyConfirmed: true }

// Both succeed, no duplicate state change
```

### Error Handling Example

```typescript
try {
  // Try to settle without confirming payment
  db.markBidsSettled('auction-1', ['b1']);
} catch (error) {
  // Error: "Cannot settle bid with status: payment_pending. Payment must be confirmed first."
  console.error(error.message);
}

// Correct flow:
db.confirmBidPayment('b1', 'tx_123');
db.markBidsSettled('auction-1', ['b1']); // Now succeeds
```

### Partial Success Example

```typescript
// Bid 1: payment_confirmed
// Bid 2: payment_pending
// Bid 3: payment_confirmed

const result = db.markBidsSettled('auction-1', ['b1', 'b2', 'b3']);

// Returns:
// {
//   success: true,
//   updated: 2,  // b1 and b3 settled
//   errors: [
//     { bidId: 'b2', error: 'Cannot settle bid with status: payment_pending. Payment must be confirmed first.' }
//   ]
// }
```

## State Query Methods

### `getBidDetails(bidId)`

Returns full bid information including current status:
```typescript
{
  id: string,
  auctionId: string,
  bidderAddress: string,
  bidAmount: number,
  quantity: number,
  status: 'placed' | 'payment_pending' | 'payment_confirmed' | 'settled' | 'failed' | 'refunded',
  escrowAddress?: string,
  transactionId?: string,
  created_at: number,
  updated_at: number
}
```

### `getAuctionBidsWithPayments(auctionId)`

Returns all bids for an auction:
```typescript
{
  bids: Array<BidDetails>
}
```

### `calculateSettlement(auctionId)`

Calculates settlement without modifying state:
```typescript
{
  auctionId: string,
  clearingPrice: number,
  totalQuantity: number,
  itemsRemaining: number,
  allocations: Array<{
    bidId: string,
    bidderAddress: string,
    quantity: number
  }>
}
```

**Note:** Only includes bids with status `payment_confirmed` or `settled`.

## Testing State Transitions

### Test: Valid Transition

```typescript
it('allows valid state transition', () => {
  const payment = db.createBidPaymentPSBT(...);
  expect(db.getBidDetails(payment.bidId).status).toBe('payment_pending');
  
  db.confirmBidPayment(payment.bidId, 'tx_123');
  expect(db.getBidDetails(payment.bidId).status).toBe('payment_confirmed');
  
  db.markBidsSettled(auctionId, [payment.bidId]);
  expect(db.getBidDetails(payment.bidId).status).toBe('settled');
});
```

### Test: Invalid Transition

```typescript
it('rejects invalid state transition', () => {
  const bid = db.placeBid('auction-1', 'tb1qbuyer', 1);
  expect(db.getBidDetails(bid.bidId).status).toBe('placed');
  
  expect(() => {
    db.confirmBidPayment(bid.bidId, 'tx_123');
  }).toThrow('Cannot confirm payment for bid in status: placed');
});
```

### Test: Idempotency

```typescript
it('handles idempotent operations', () => {
  const payment = db.createBidPaymentPSBT(...);
  
  const confirm1 = db.confirmBidPayment(payment.bidId, 'tx_123');
  expect(confirm1.success).toBe(true);
  
  const confirm2 = db.confirmBidPayment(payment.bidId, 'tx_123');
  expect(confirm2.success).toBe(true);
  expect(confirm2.alreadyConfirmed).toBe(true);
});
```

## Summary

The bid state machine enforces a strict flow from payment creation through confirmation to settlement, with:

- ✅ Clear state transitions
- ✅ Validation at every step
- ✅ Idempotent operations for reliability
- ✅ Detailed error messages for debugging
- ✅ Partial success handling for batch operations
- ✅ No silent failures or inconsistent states