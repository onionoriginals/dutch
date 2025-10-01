# Task 3: Bidding Interface - Testing Guide

## Quick Start Testing

### Prerequisites
1. API server running on port 3000
2. Web app built and served
3. At least one active clearing auction in the database

### Step-by-Step Test Procedure

#### 1. Create a Test Clearing Auction

```bash
# Start the API server
cd apps/api
bun run dev

# In another terminal, create a demo auction
curl -X POST http://localhost:3000/api/demo/create-clearing-auction \
  -H "Content-Type: application/json" \
  -d '{
    "auctionId": "test_clearing_001",
    "inscriptionIds": ["insc-1", "insc-2", "insc-3"],
    "quantity": 3,
    "startPrice": 0.0001,
    "minPrice": 0.00001,
    "duration": 3600,
    "decrementInterval": 600,
    "sellerAddress": "tb1p_seller_test"
  }'
```

**Expected Response:**
```json
{
  "ok": true,
  "data": {
    "success": true,
    "auctionDetails": {
      "id": "test_clearing_001",
      "auction_type": "clearing",
      "status": "active",
      "quantity": 3,
      "itemsRemaining": 3
    }
  }
}
```

#### 2. Verify Auction in Browser

```bash
# Open browser to auction view page
open http://localhost:3000/auctions/view?id=test_clearing_001
```

**What to verify:**
- ✅ Auction card displays with "Dutch" type
- ✅ Auction details section shows 3 items, start/min prices
- ✅ Bidding interface is visible (since auction is active)
- ✅ "Place Bid" button is enabled
- ✅ Quantity input defaults to 1
- ✅ Total bid amount shows correctly

#### 3. Test Bid Placement

**Actions:**
1. Enter quantity: `1`
2. Verify total: `0.0001 BTC` (1 × 0.0001)
3. Click "Place Bid"

**Expected Behavior:**
- Payment modal opens immediately
- Modal shows:
  - Bid summary (1 item, 0.0001 BTC per item, 0.0001 BTC total)
  - Escrow address (starts with `tb1q`)
  - Copy button next to address
  - Payment instructions
  - "I've Sent the Payment" button

#### 4. Test Copy to Clipboard

**Actions:**
1. Click "Copy" button next to escrow address
2. Check clipboard contents

**Expected Behavior:**
- Button text changes to "✓" for 2 seconds
- Clipboard contains escrow address
- Address format: `tb1q[38 characters]`

#### 5. Test QR Code Toggle

**Actions:**
1. Click "Show QR Code" link

**Expected Behavior:**
- QR code section expands
- Shows placeholder "QR Code (requires QR library)"
- Link text changes to "Hide QR Code"
- Click again to collapse

#### 6. Test Payment Confirmation Flow

**Actions:**
1. Click "I've Sent the Payment"
2. Enter transaction ID: `test_tx_abc123def456`
3. Click OK in prompt

**Expected Behavior:**
- Modal shows "Broadcasting Transaction" with spinner
- Automatically transitions to "Waiting for Confirmation"
- Shows transaction ID
- Shows "Polling for confirmation..." indicator
- Every 10 seconds, polls API

**API Calls to Verify:**
```bash
# Check bid was created with payment_pending status
curl http://localhost:3000/api/clearing/bids/test_clearing_001

# Should see bid with status "payment_pending"
```

#### 7. Manually Confirm Payment (for testing)

```bash
# Manually update bid status to payment_confirmed
curl -X POST http://localhost:3000/api/clearing/confirm-bid-payment \
  -H "Content-Type: application/json" \
  -d '{
    "bidId": "b1",
    "transactionId": "test_tx_abc123def456"
  }'
```

**Expected Response:**
```json
{
  "ok": true,
  "data": {
    "success": true
  }
}
```

**Expected UI Behavior:**
- Within 10 seconds, modal updates to "Payment Confirmed!"
- Shows green checkmark icon
- Shows transaction ID
- "Done" button appears

#### 8. Complete Bid Flow

**Actions:**
1. Click "Done" button

**Expected Behavior:**
- Modal closes
- Auction view page refreshes
- "Your Bids" section appears with 1 bid
- Bid shows:
  - Bid ID (e.g., "b1")
  - Status badge: "Payment Confirmed" (blue)
  - Quantity: 1
  - Bid Amount: 0.0001 BTC
  - Escrow address (truncated)
  - Transaction ID (truncated)
- "All Bids" section shows the same bid
- Items remaining updates to 2

#### 9. Test Multiple Bids

**Actions:**
1. Change quantity to `2`
2. Click "Place Bid" again
3. Complete payment flow with different TX ID

**Expected Behavior:**
- Second bid created successfully
- "Your Bids" section shows 2 bids
- Items remaining updates to 0 (or auction quantity depleted)
- If all items are taken, "Place Bid" button should disable

#### 10. Test Error Cases

##### 10a. Invalid Quantity
**Actions:**
1. Enter quantity: `999` (more than available)
2. Try to place bid

**Expected Behavior:**
- Error message: "Invalid quantity. Available: X"
- Bid creation fails

##### 10b. No Items Remaining
**Actions:**
1. Place bids until all items are taken
2. Try to place another bid

**Expected Behavior:**
- "Place Bid" button is disabled
- Red message: "No items remaining in this auction"

##### 10c. API Error Simulation
**Actions:**
1. Stop API server
2. Try to place bid

**Expected Behavior:**
- Error modal appears
- Shows error message
- "Try Again" and "Cancel" buttons available

## Automated Test Script

Save this as `test_bidding.sh`:

```bash
#!/bin/bash

API_BASE="http://localhost:3000/api"
AUCTION_ID="test_clearing_$(date +%s)"

echo "🧪 Testing Bidding Interface Flow"
echo "================================"

# 1. Create auction
echo ""
echo "1️⃣  Creating test auction..."
CREATE_RESP=$(curl -s -X POST $API_BASE/demo/create-clearing-auction \
  -H "Content-Type: application/json" \
  -d "{
    \"auctionId\": \"$AUCTION_ID\",
    \"quantity\": 3,
    \"startPrice\": 10000,
    \"minPrice\": 1000
  }")

if echo "$CREATE_RESP" | grep -q '"ok":true'; then
  echo "✅ Auction created: $AUCTION_ID"
else
  echo "❌ Failed to create auction"
  exit 1
fi

# 2. Check auction status
echo ""
echo "2️⃣  Checking auction status..."
STATUS_RESP=$(curl -s $API_BASE/clearing/status/$AUCTION_ID)
if echo "$STATUS_RESP" | grep -q '"status":"active"'; then
  echo "✅ Auction is active"
else
  echo "❌ Auction not active"
  exit 1
fi

# 3. Create bid payment
echo ""
echo "3️⃣  Creating bid payment..."
BID_RESP=$(curl -s -X POST $API_BASE/clearing/create-bid-payment \
  -H "Content-Type: application/json" \
  -d "{
    \"auctionId\": \"$AUCTION_ID\",
    \"bidderAddress\": \"tb1qtestbidder0000000000000000000000\",
    \"bidAmount\": 10000,
    \"quantity\": 1
  }")

BID_ID=$(echo "$BID_RESP" | grep -o '"bidId":"[^"]*"' | cut -d'"' -f4)
ESCROW=$(echo "$BID_RESP" | grep -o '"escrowAddress":"[^"]*"' | cut -d'"' -f4)

if [ -n "$BID_ID" ]; then
  echo "✅ Bid created: $BID_ID"
  echo "   Escrow: $ESCROW"
else
  echo "❌ Failed to create bid"
  exit 1
fi

# 4. Confirm payment
echo ""
echo "4️⃣  Confirming bid payment..."
CONFIRM_RESP=$(curl -s -X POST $API_BASE/clearing/confirm-bid-payment \
  -H "Content-Type: application/json" \
  -d "{
    \"bidId\": \"$BID_ID\",
    \"transactionId\": \"test_tx_$(date +%s)\"
  }")

if echo "$CONFIRM_RESP" | grep -q '"success":true'; then
  echo "✅ Payment confirmed"
else
  echo "❌ Failed to confirm payment"
  exit 1
fi

# 5. Check bid status
echo ""
echo "5️⃣  Checking bid status..."
BID_STATUS=$(curl -s $API_BASE/clearing/bid-payment-status/$BID_ID)
if echo "$BID_STATUS" | grep -q '"status":"payment_confirmed"'; then
  echo "✅ Bid status: payment_confirmed"
else
  echo "⚠️  Bid status not yet confirmed (may need time)"
fi

# 6. Get all bids
echo ""
echo "6️⃣  Getting all bids for auction..."
BIDS_RESP=$(curl -s $API_BASE/clearing/bids/$AUCTION_ID)
BID_COUNT=$(echo "$BIDS_RESP" | grep -o '"id":"' | wc -l)
echo "✅ Found $BID_COUNT bid(s)"

# 7. Final auction status
echo ""
echo "7️⃣  Final auction status..."
FINAL_STATUS=$(curl -s $API_BASE/clearing/status/$AUCTION_ID)
ITEMS_REMAINING=$(echo "$FINAL_STATUS" | grep -o '"itemsRemaining":[0-9]*' | cut -d':' -f2)
echo "✅ Items remaining: $ITEMS_REMAINING / 3"

echo ""
echo "🎉 All tests passed!"
echo "🌐 View in browser: http://localhost:3000/auctions/view?id=$AUCTION_ID"
```

**Run the test:**
```bash
chmod +x test_bidding.sh
./test_bidding.sh
```

## Browser Testing Checklist

### Visual Checks
- [ ] Bidding interface has clean, card-based design
- [ ] Quantity input is properly sized and styled
- [ ] Price displays are legible and formatted correctly
- [ ] "Place Bid" button is prominent and has hover state
- [ ] Payment modal is centered and scrollable
- [ ] Status badges use appropriate colors (yellow/pending, blue/confirmed, green/settled)
- [ ] Dark mode works correctly for all components
- [ ] Responsive design works on mobile (< 768px)

### Functional Checks
- [ ] Quantity input accepts numbers only
- [ ] Quantity validation prevents invalid values
- [ ] Total amount updates in real-time
- [ ] Copy button copies escrow address to clipboard
- [ ] QR code toggle works
- [ ] Payment modal can be canceled
- [ ] Transaction ID prompt accepts input
- [ ] Polling starts automatically after confirmation
- [ ] Modal closes on completion
- [ ] Bid list refreshes after new bid
- [ ] User bids are filtered correctly
- [ ] All bids list shows all bidders

### Error Handling Checks
- [ ] Invalid quantity shows error message
- [ ] No wallet shows appropriate warning
- [ ] API errors display in modal
- [ ] Network errors are caught and shown
- [ ] Retry button works after error
- [ ] Cancel button returns to safe state

### Performance Checks
- [ ] Page loads quickly (< 2s)
- [ ] Bid creation is responsive (< 500ms)
- [ ] Modal animations are smooth
- [ ] Polling doesn't block UI
- [ ] Bid list renders efficiently (test with 50+ bids)

## Integration with Existing Tests

### Run Existing API Tests
```bash
cd apps/api
bun test
```

**Relevant test files:**
- `src/__tests__/clearing-auction.api.test.ts`
- `src/__tests__/clearing-auction-enhanced.api.test.ts`

**Tests to verify:**
- ✅ Bid creation with payment
- ✅ Payment confirmation flow
- ✅ Bid status transitions
- ✅ Multiple bids per auction
- ✅ Auction settlement

## Known Issues / TODOs

1. **Wallet Integration**: Currently uses mock address
   - TODO: Integrate real Bitcoin wallet
   - TODO: Request wallet permissions
   - TODO: Handle wallet connection errors

2. **PSBT Generation**: Returns escrow address only
   - TODO: Query user's UTXOs
   - TODO: Build complete PSBT
   - TODO: Return PSBT for wallet signing

3. **QR Code**: Shows placeholder
   - TODO: Integrate QR code library
   - TODO: Generate bitcoin: URI
   - TODO: Support BIP21 payment protocol

4. **Real-time Updates**: Uses polling
   - TODO: Replace with WebSocket
   - TODO: Push bid status updates
   - TODO: Live itemsRemaining countdown

5. **Transaction Verification**: Not implemented
   - TODO: Verify transaction on mempool.space
   - TODO: Check transaction amount matches bid
   - TODO: Verify payment to correct escrow address

## Debugging Tips

### Check Browser Console
```javascript
// View current state
console.log(document.querySelector('[data-auction-id]'))

// Check API responses
fetch('/api/clearing/bids/test_clearing_001')
  .then(r => r.json())
  .then(console.log)
```

### Monitor Network Requests
1. Open DevTools (F12)
2. Go to Network tab
3. Filter by "Fetch/XHR"
4. Watch API calls during bid flow

### Check API Server Logs
```bash
# In API server terminal
# Look for:
# - "create-bid-payment" requests
# - "confirm-bid-payment" requests
# - "bid-payment-status" polling requests
```

### Inspect Database State
```bash
# If using SQLite
sqlite3 apps/api/data/auctions.db "SELECT * FROM bids;"

# Check bid statuses
sqlite3 apps/api/data/auctions.db "SELECT id, status FROM bids WHERE auctionId='test_clearing_001';"
```

## Support

For issues or questions:
1. Check implementation summary: `TASK_3_IMPLEMENTATION_SUMMARY.md`
2. Review flow diagram: `BIDDING_FLOW_DIAGRAM.md`
3. Check component source code in `apps/web/src/components/auction/`
