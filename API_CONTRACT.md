# API Contract - Bidding Interface Endpoints

## Overview
This document describes the API endpoints used by the bidding interface, including request/response formats, validation rules, and error handling.

## Base URL
```
Development: http://localhost:3000/api
Production: https://your-domain.com/api
```

## Authentication
Currently, no authentication is required. Future versions should implement:
- Wallet signature verification
- Session tokens
- Rate limiting per address

---

## Endpoints

### 1. Create Bid Payment

Creates a new bid and returns escrow address for payment.

**Endpoint:** `POST /api/clearing/create-bid-payment`

**Request Body:**
```json
{
  "auctionId": "string",
  "bidderAddress": "string",
  "bidAmount": "number",
  "quantity": "number"
}
```

**Field Validation:**
- `auctionId`: Required, must exist and be active
- `bidderAddress`: Required, must be valid Bitcoin address (P2WPKH, P2TR)
- `bidAmount`: Required, must be > 0
- `quantity`: Optional (default: 1), must be > 0 and <= itemsRemaining

**Success Response (200):**
```json
{
  "ok": true,
  "data": {
    "escrowAddress": "tb1q...",
    "bidId": "b123"
  }
}
```

**Error Responses:**

*400 - Validation Error:*
```json
{
  "ok": false,
  "error": "auctionId, bidderAddress, bidAmount required",
  "code": "VALIDATION_ERROR"
}
```

*400 - Invalid Address:*
```json
{
  "ok": false,
  "error": "Invalid bidder address",
  "code": "VALIDATION_ERROR"
}
```

*400 - Insufficient Items:*
```json
{
  "ok": false,
  "error": "Insufficient items available. Requested: 5, Available: 3",
  "code": "VALIDATION_ERROR"
}
```

*500 - Auction Not Found:*
```json
{
  "ok": false,
  "error": "Clearing auction not found",
  "code": "INTERNAL_ERROR"
}
```

*500 - Auction Not Active:*
```json
{
  "ok": false,
  "error": "Auction not active",
  "code": "INTERNAL_ERROR"
}
```

**Side Effects:**
- Creates bid record with status `payment_pending`
- Generates deterministic escrow address
- Stores bid in database

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/clearing/create-bid-payment \
  -H "Content-Type: application/json" \
  -d '{
    "auctionId": "auction_123",
    "bidderAddress": "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx",
    "bidAmount": 10000,
    "quantity": 2
  }'
```

---

### 2. Confirm Bid Payment

Confirms that payment has been broadcast and updates bid status.

**Endpoint:** `POST /api/clearing/confirm-bid-payment`

**Request Body:**
```json
{
  "bidId": "string",
  "transactionId": "string"
}
```

**Field Validation:**
- `bidId`: Required, must exist
- `transactionId`: Required, must be valid transaction ID format

**Success Response (200):**
```json
{
  "ok": true,
  "data": {
    "success": true,
    "alreadyConfirmed": false
  }
}
```

**Idempotent Response (200):**
```json
{
  "ok": true,
  "data": {
    "success": true,
    "alreadyConfirmed": true
  }
}
```

**Error Responses:**

*400 - Missing Fields:*
```json
{
  "ok": false,
  "error": "bidId and transactionId required",
  "code": "VALIDATION_ERROR"
}
```

*500 - Bid Not Found:*
```json
{
  "ok": false,
  "error": "Bid not found",
  "code": "INTERNAL_ERROR"
}
```

*500 - Invalid State:*
```json
{
  "ok": false,
  "error": "Cannot confirm payment for bid in status: settled. Expected payment_pending.",
  "code": "INTERNAL_ERROR"
}
```

**Side Effects:**
- Updates bid status from `payment_pending` to `payment_confirmed`
- Stores transaction ID
- Updates `updated_at` timestamp

**Idempotency:**
If called multiple times with same `bidId` and `transactionId`, returns success without error.

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/clearing/confirm-bid-payment \
  -H "Content-Type: application/json" \
  -d '{
    "bidId": "b123",
    "transactionId": "abc123def456789"
  }'
```

---

### 3. Get Bid Payment Status

Retrieves current status of a bid, used for polling confirmation.

**Endpoint:** `GET /api/clearing/bid-payment-status/:bidId`

**Path Parameters:**
- `bidId`: Bid identifier

**Success Response (200):**
```json
{
  "ok": true,
  "data": {
    "id": "b123",
    "auctionId": "auction_123",
    "bidderAddress": "tb1q...",
    "bidAmount": 10000,
    "quantity": 2,
    "status": "payment_confirmed",
    "escrowAddress": "tb1q...",
    "transactionId": "abc123...",
    "created_at": 1696089600,
    "updated_at": 1696089700
  }
}
```

**Error Responses:**

*404 - Not Found:*
```json
{
  "ok": false,
  "error": "Bid not found",
  "code": "NOT_FOUND"
}
```

**Status Values:**
- `payment_pending`: Bid created, waiting for payment
- `payment_confirmed`: Payment confirmed on-chain (1+ confirmations)
- `settled`: Auction settled, inscriptions allocated
- `failed`: Payment or settlement failed
- `refunded`: Bid refunded (non-winning)

**Example Request:**
```bash
curl http://localhost:3000/api/clearing/bid-payment-status/b123
```

---

### 4. Get Auction Bids

Retrieves all bids for an auction.

**Endpoint:** `GET /api/clearing/bids/:auctionId`

**Path Parameters:**
- `auctionId`: Auction identifier

**Success Response (200):**
```json
{
  "ok": true,
  "data": {
    "bids": [
      {
        "id": "b123",
        "auctionId": "auction_123",
        "bidderAddress": "tb1q...",
        "bidAmount": 10000,
        "quantity": 2,
        "status": "payment_confirmed",
        "escrowAddress": "tb1q...",
        "transactionId": "abc123...",
        "created_at": 1696089600,
        "updated_at": 1696089700
      },
      {
        "id": "b124",
        "auctionId": "auction_123",
        "bidderAddress": "tb1p...",
        "bidAmount": 9500,
        "quantity": 1,
        "status": "payment_pending",
        "escrowAddress": "tb1q...",
        "created_at": 1696089800,
        "updated_at": 1696089800
      }
    ]
  }
}
```

**Error Responses:**

*404 - Not Found:*
```json
{
  "ok": false,
  "error": "Auction not found",
  "code": "NOT_FOUND"
}
```

**Example Request:**
```bash
curl http://localhost:3000/api/clearing/bids/auction_123
```

---

### 5. Get Clearing Auction Status

Retrieves complete status of a clearing auction.

**Endpoint:** `GET /api/clearing/status/:auctionId`

**Path Parameters:**
- `auctionId`: Auction identifier

**Success Response (200):**
```json
{
  "ok": true,
  "data": {
    "auction": {
      "id": "auction_123",
      "inscription_id": "insc-0",
      "inscription_ids": ["insc-0", "insc-1", "insc-2"],
      "quantity": 3,
      "itemsRemaining": 1,
      "status": "active",
      "start_price": 30000,
      "min_price": 10000,
      "duration": 3600,
      "decrement_interval": 600,
      "created_at": 1696089000,
      "updated_at": 1696089600,
      "auction_type": "clearing"
    },
    "progress": {
      "itemsRemaining": 1
    }
  }
}
```

**Error Responses:**

*404 - Not Found:*
```json
{
  "ok": false,
  "error": "Auction not found",
  "code": "NOT_FOUND"
}
```

**Example Request:**
```bash
curl http://localhost:3000/api/clearing/status/auction_123
```

---

## Data Models

### Bid
```typescript
type Bid = {
  id: string                    // Unique identifier (e.g., "b123")
  auctionId: string             // Parent auction ID
  bidderAddress: string         // Bitcoin address (P2WPKH or P2TR)
  bidAmount: number             // Total bid in satoshis
  quantity: number              // Number of items bid on
  status: BidStatus             // Current status
  escrowAddress?: string        // Generated escrow address
  transactionId?: string        // Bitcoin transaction ID
  created_at: number            // Unix timestamp (seconds)
  updated_at: number            // Unix timestamp (seconds)
}

type BidStatus = 
  | 'placed'                    // Initial state (legacy)
  | 'payment_pending'           // Waiting for payment
  | 'payment_confirmed'         // Payment confirmed on-chain
  | 'settled'                   // Auction settled, items allocated
  | 'failed'                    // Payment/settlement failed
  | 'refunded'                  // Non-winning bid refunded
```

### Clearing Auction
```typescript
type ClearingAuction = {
  id: string                    // Unique identifier
  inscription_id: string        // Primary inscription (first in array)
  inscription_ids: string[]     // All inscription IDs
  quantity: number              // Total items
  itemsRemaining: number        // Items not yet bid on
  status: AuctionStatus         // Current status
  start_price: number           // Starting price in satoshis
  min_price: number             // Minimum price in satoshis
  duration: number              // Duration in seconds
  decrement_interval: number    // Price decrement interval
  created_at: number            // Unix timestamp (seconds)
  updated_at: number            // Unix timestamp (seconds)
  auction_type: 'clearing'      // Always 'clearing'
}

type AuctionStatus = 
  | 'active'                    // Auction is live
  | 'sold'                      // All items sold
  | 'expired'                   // Auction ended without selling all
```

---

## Error Codes

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `VALIDATION_ERROR` | 400 | Invalid request parameters |
| `NOT_FOUND` | 404 | Resource not found |
| `INTERNAL_ERROR` | 500 | Server-side error |

---

## Rate Limiting

**Current:** No rate limiting implemented

**Recommended:**
- 10 requests/minute per IP for bid creation
- 60 requests/minute for status polling
- 100 requests/minute for read-only endpoints

---

## Caching

**Current:** No caching implemented

**Recommended:**
- Cache auction status for 5 seconds
- Cache bid list for 2 seconds
- No cache for bid creation/confirmation

---

## Webhooks (Future)

For production, consider implementing webhooks to notify clients of:
- Bid status changes
- Auction settlement
- Payment confirmations

**Example Webhook Payload:**
```json
{
  "event": "bid.payment_confirmed",
  "timestamp": 1696089700,
  "data": {
    "bidId": "b123",
    "auctionId": "auction_123",
    "status": "payment_confirmed",
    "transactionId": "abc123..."
  }
}
```

---

## WebSocket API (Future)

Replace polling with WebSocket for real-time updates:

**Connection:**
```javascript
const ws = new WebSocket('wss://api.example.com/ws/bids')

ws.onopen = () => {
  ws.send(JSON.stringify({
    action: 'subscribe',
    auctionId: 'auction_123'
  }))
}

ws.onmessage = (event) => {
  const { type, data } = JSON.parse(event.data)
  if (type === 'bid_status_update') {
    // Update UI with new bid status
  }
}
```

---

## Migration Path

### Current Implementation
- Polling every 10 seconds
- Manual transaction ID entry
- Mock escrow addresses

### Phase 1: Enhanced PSBT
- Generate real PSBTs with UTXOs
- Query mempool API for UTXOs
- Return PSBT for wallet signing

### Phase 2: Wallet Integration
- Integrate with Bitcoin wallets
- Auto-sign PSBTs
- Broadcast transactions automatically

### Phase 3: Real-time Updates
- Implement WebSocket server
- Push bid status updates
- Eliminate polling

### Phase 4: Verification
- Verify transactions on-chain
- Check payment amounts
- Validate escrow addresses

---

## Testing Examples

### Create and Confirm Bid (Happy Path)
```bash
#!/bin/bash

# 1. Create bid
BID_RESP=$(curl -s -X POST http://localhost:3000/api/clearing/create-bid-payment \
  -H "Content-Type: application/json" \
  -d '{
    "auctionId": "auction_123",
    "bidderAddress": "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx",
    "bidAmount": 10000,
    "quantity": 1
  }')

BID_ID=$(echo $BID_RESP | jq -r '.data.bidId')
echo "Created bid: $BID_ID"

# 2. Confirm payment
curl -X POST http://localhost:3000/api/clearing/confirm-bid-payment \
  -H "Content-Type: application/json" \
  -d "{
    \"bidId\": \"$BID_ID\",
    \"transactionId\": \"test_tx_$(date +%s)\"
  }"

# 3. Check status
curl http://localhost:3000/api/clearing/bid-payment-status/$BID_ID | jq
```

### Test Error Handling
```bash
# Invalid quantity
curl -X POST http://localhost:3000/api/clearing/create-bid-payment \
  -H "Content-Type: application/json" \
  -d '{
    "auctionId": "auction_123",
    "bidderAddress": "tb1q...",
    "bidAmount": 10000,
    "quantity": 999
  }' | jq

# Expected: 500 error with "Insufficient items available"

# Missing fields
curl -X POST http://localhost:3000/api/clearing/create-bid-payment \
  -H "Content-Type: application/json" \
  -d '{"auctionId": "auction_123"}' | jq

# Expected: 400 error with "auctionId, bidderAddress, bidAmount required"
```

---

## Sequence Diagram

```
Client                  API Server              Database
  │                         │                       │
  │ POST create-bid-payment │                       │
  ├────────────────────────>│                       │
  │                         │ Validate request      │
  │                         │ Check auction active  │
  │                         │ Validate address      │
  │                         ├──────────────────────>│
  │                         │ Create bid record     │
  │                         │<──────────────────────┤
  │<────────────────────────┤                       │
  │ {escrowAddress, bidId}  │                       │
  │                         │                       │
  │ (User sends payment)    │                       │
  │                         │                       │
  │ POST confirm-bid-payment│                       │
  ├────────────────────────>│                       │
  │                         │ Validate bidId        │
  │                         │ Check bid status      │
  │                         ├──────────────────────>│
  │                         │ Update status         │
  │                         │<──────────────────────┤
  │<────────────────────────┤                       │
  │ {success: true}         │                       │
  │                         │                       │
  │ (Poll every 10s)        │                       │
  │ GET bid-payment-status  │                       │
  ├────────────────────────>│                       │
  │                         ├──────────────────────>│
  │                         │ Get bid               │
  │                         │<──────────────────────┤
  │<────────────────────────┤                       │
  │ {bid with status}       │                       │
  │                         │                       │
```
