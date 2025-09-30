# Bidding Interface - User Flow Diagram

## Visual Flow Chart

```
┌─────────────────────────────────────────────────────────────────────┐
│                     AUCTION VIEW PAGE                                │
│  /auctions/view?id=auction_123                                       │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Fetch Auction Data                                                  │
│  • GET /api/auction/:id                                             │
│  • GET /api/clearing/status/:id                                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
         ┌────────────────────┴────────────────────┐
         │                                          │
    ┌────▼────┐                               ┌────▼────┐
    │ Single  │                               │Clearing │
    │ Auction │                               │ Auction │
    └─────────┘                               └────┬────┘
         │                                         │
         ▼                                         ▼
  [No Bidding]                    ┌────────────────────────────────┐
                                  │   BIDDING INTERFACE            │
                                  │                                 │
                                  │  • Current Price: 0.0001 BTC   │
                                  │  • Items Remaining: 5          │
                                  │  • Quantity Input: [1]         │
                                  │  • Total: 0.0001 BTC          │
                                  │  • [Place Bid] Button         │
                                  └────────────┬───────────────────┘
                                               │
                                               ▼
                                        User Clicks "Place Bid"
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  POST /api/clearing/create-bid-payment                              │
│  Request: {                                                          │
│    auctionId: "auction_123",                                        │
│    bidderAddress: "tb1q...",                                        │
│    bidAmount: 10000,                                                │
│    quantity: 1                                                       │
│  }                                                                   │
│                                                                      │
│  Response: {                                                         │
│    escrowAddress: "tb1q...",                                        │
│    bidId: "b123"                                                    │
│  }                                                                   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     PAYMENT PSBT MODAL                               │
│  ┌───────────────────────────────────────────────────────────┐     │
│  │  Step 1: Payment Instructions                             │     │
│  │                                                             │     │
│  │  Bid Summary:                                              │     │
│  │  • Quantity: 1 item                                        │     │
│  │  • Amount per Item: 0.0001 BTC                            │     │
│  │  • Total: 0.0001 BTC                                      │     │
│  │                                                             │     │
│  │  Escrow Address:                                           │     │
│  │  tb1q...........  [Copy]                                   │     │
│  │                                                             │     │
│  │  [Show QR Code]                                            │     │
│  │                                                             │     │
│  │  Instructions:                                             │     │
│  │  1. Send 0.0001 BTC to escrow address                     │     │
│  │  2. Use your Bitcoin wallet                               │     │
│  │  3. Broadcast the transaction                             │     │
│  │  4. Enter transaction ID below                            │     │
│  │                                                             │     │
│  │  [I've Sent the Payment]                                  │     │
│  └───────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    User Clicks "I've Sent the Payment"
                              │
                              ▼
                    Prompt: "Enter transaction ID"
                              │
                              ▼
                    User enters: "abc123...def789"
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  POST /api/clearing/confirm-bid-payment                             │
│  Request: {                                                          │
│    bidId: "b123",                                                   │
│    transactionId: "abc123...def789"                                │
│  }                                                                   │
│                                                                      │
│  Response: { success: true }                                        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     PAYMENT PSBT MODAL                               │
│  ┌───────────────────────────────────────────────────────────┐     │
│  │  Step 2: Broadcasting                                      │     │
│  │                                                             │     │
│  │  [Loading Spinner]                                         │     │
│  │  Broadcasting Transaction                                  │     │
│  │  Please wait...                                            │     │
│  └───────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    Automatically transitions to...
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     PAYMENT PSBT MODAL                               │
│  ┌───────────────────────────────────────────────────────────┐     │
│  │  Step 3: Waiting for Confirmation                          │     │
│  │                                                             │     │
│  │  [Clock Icon]                                              │     │
│  │  Waiting for Confirmation                                  │     │
│  │                                                             │     │
│  │  Your payment has been broadcast.                          │     │
│  │  Waiting for on-chain confirmation...                      │     │
│  │                                                             │     │
│  │  Transaction ID:                                           │     │
│  │  abc123...def789                                           │     │
│  │                                                             │     │
│  │  ● Polling for confirmation...                             │     │
│  └───────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
           ┌──────────────────┴──────────────────┐
           │  Every 10 seconds:                  │
           │  GET /api/clearing/bid-payment-      │
           │      status/:bidId                   │
           │                                      │
           │  Check if status == 'payment_        │
           │  confirmed'                          │
           └──────────────────┬──────────────────┘
                              │
                              ▼
                When status == 'payment_confirmed'
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     PAYMENT PSBT MODAL                               │
│  ┌───────────────────────────────────────────────────────────┐     │
│  │  Step 4: Complete!                                         │     │
│  │                                                             │     │
│  │  [Checkmark Icon]                                          │     │
│  │  Payment Confirmed!                                        │     │
│  │                                                             │     │
│  │  Your bid payment has been confirmed.                      │     │
│  │  Your bid is now active in the auction.                   │     │
│  │                                                             │     │
│  │  Transaction ID:                                           │     │
│  │  abc123...def789                                           │     │
│  │                                                             │     │
│  │  [Done]                                                    │     │
│  └───────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    User Clicks "Done"
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Modal closes, returns to Auction View                              │
│                                                                      │
│  • Refresh bid list (GET /api/clearing/bids/:auctionId)            │
│  • Show bid in "Your Bids" section                                 │
│  • Display updated items remaining                                  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    UPDATED AUCTION VIEW                              │
│                                                                      │
│  Your Bids (1):                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ Bid #b123                     [Payment Confirmed]           │  │
│  │ Created: 2025-09-30 10:30 AM                               │  │
│  │                                                             │  │
│  │ Quantity: 1                                                 │  │
│  │ Bid Amount: 0.0001 BTC                                     │  │
│  │ Escrow: tb1q...x3y2                                        │  │
│  │ TX: abc123...def789                                        │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  All Bids (3):                                                      │
│  • tb1q...abc  1 × 0.0001 BTC  [Payment Confirmed]                │
│  • tb1q...def  2 × 0.00009 BTC [Payment Pending]                  │
│  • tb1q...ghi  1 × 0.00011 BTC [Payment Confirmed]                │
└─────────────────────────────────────────────────────────────────────┘
```

## State Transitions

### Bid Status Flow
```
placed/payment_pending
        │
        ▼
   (User sends payment)
        │
        ▼
payment_confirmed
        │
        ▼
   (Auction ends)
        │
        ▼
    settled
```

### Modal State Flow
```
payment
   │
   ▼
broadcasting
   │
   ▼
confirming ◄─┐
   │         │
   │    (Poll every 10s)
   │         │
   └─────────┘
   │
   ▼
complete
```

## Error Scenarios

### 1. Invalid Quantity
```
User enters quantity > itemsRemaining
   │
   ▼
Show error: "Invalid quantity. Available: X"
   │
   ▼
Disable "Place Bid" button
```

### 2. No Wallet Connected
```
User clicks "Place Bid" without wallet
   │
   ▼
Show error: "Please connect your wallet first"
   │
   ▼
Highlight wallet connection area
```

### 3. API Error
```
API call fails (network error, server error)
   │
   ▼
Show error modal with retry option
   │
   ▼
User can retry or cancel
```

### 4. Transaction Broadcast Failure
```
Confirm-bid-payment returns error
   │
   ▼
Show error state in modal
   │
   ▼
User can "Try Again" or "Cancel"
   │
   ▼
If retry: return to payment step
```

## Component Hierarchy

```
AuctionView
│
├── AuctionCard
│   └── [Auction summary display]
│
├── BiddingInterface (if clearing + active)
│   │
│   ├── Bid Form
│   │   ├── Quantity Input
│   │   ├── Price Display
│   │   └── Place Bid Button
│   │
│   ├── PaymentPSBTModal (conditional)
│   │   ├── Payment Step
│   │   ├── Broadcasting Step
│   │   ├── Confirming Step
│   │   ├── Complete Step
│   │   └── Error Step
│   │
│   ├── Your Bids Section
│   │   └── BidCard[] (filtered by userAddress)
│   │
│   └── All Bids Section
│       └── Bid List Items
│
└── Auction Details Section
    ├── Total Quantity
    ├── Items Remaining
    ├── Price Range
    └── Inscription IDs
```

## API Call Sequence

```
Page Load:
1. GET /api/auction/:auctionId
2. GET /api/clearing/status/:auctionId
3. GET /api/clearing/bids/:auctionId

Place Bid:
4. POST /api/clearing/create-bid-payment
5. (User action: send payment)
6. POST /api/clearing/confirm-bid-payment
7. GET /api/clearing/bid-payment-status/:bidId (poll)
8. GET /api/clearing/bids/:auctionId (refresh)

Settlement (after auction ends):
9. POST /api/clearing/process-settlement
10. POST /api/clearing/mark-settled
```

## Time Complexity Analysis

| Operation | Complexity | Notes |
|-----------|-----------|-------|
| Load auction | O(1) | Single DB lookup |
| Load bids | O(n) | n = number of bids |
| Filter user bids | O(n) | Linear scan |
| Calculate total | O(1) | Simple multiplication |
| Poll confirmation | O(1) per poll | Single bid lookup |
| Refresh bid list | O(n) | n = number of bids |

## Future Optimizations

1. **WebSocket Updates**: Replace polling with real-time push notifications
2. **Optimistic UI**: Show bid immediately before API confirmation
3. **Batch Loading**: Paginate bid list for auctions with many bids
4. **Caching**: Cache auction data with short TTL
5. **Debouncing**: Debounce quantity input changes
