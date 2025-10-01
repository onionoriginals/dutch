# Dutch Auction Implementation Review

**Date:** September 30, 2025  
**Review Scope:** Complete Dutch auction flow for live production auctions

---

## Executive Summary

The codebase has a solid foundation for Dutch auctions with two types:
1. **Single-item Dutch auctions** (buy-now style)
2. **Clearing price Dutch auctions** (uniform price, multiple items)

The backend infrastructure is **production-ready** with comprehensive testing, but the **frontend bidding/payment flow** is incomplete. The main gaps are:
- Wallet integration for signing transactions
- PSBT signing and broadcasting workflow
- Real-time price updates during live auctions
- Payment confirmation and escrow monitoring UI
- Inscription ownership verification UI

---

## Current Implementation Status

### ✅ **COMPLETE** - Backend Core
- [x] Database schema with SQLite and PostgreSQL support
- [x] Price calculation algorithms (linear decay)
- [x] Auction lifecycle management (active/sold/expired)
- [x] Clearing auction bid placement and settlement logic
- [x] Payment tracking (placed → payment_pending → payment_confirmed → settled)
- [x] Deterministic key derivation (BIP39/BIP32)
- [x] Private key encryption (AES-256-GCM with PBKDF2)
- [x] API endpoints for all auction operations
- [x] Comprehensive unit and integration tests

### ⚠️ **PARTIAL** - Frontend UI
- [x] Auction creation wizard with validation
- [x] Dutch price schedule editor with visualizations
- [x] Auction listing and filtering
- [x] Auction detail view
- [ ] **Missing:** Wallet connection for seller addresses
- [ ] **Missing:** Bidding interface with wallet integration
- [ ] **Missing:** PSBT signing workflow
- [ ] **Missing:** Payment confirmation tracking UI
- [ ] **Missing:** Real-time price updates

### ❌ **MISSING** - Transaction Broadcasting
- [ ] PSBT signing with Bitcoin wallet (Unisat, Leather, Xverse)
- [ ] Transaction broadcasting to Bitcoin network
- [ ] Mempool monitoring for confirmation
- [ ] Inscription transfer PSBTs
- [ ] Payment escrow PSBTs with proper inputs/outputs

### ❌ **MISSING** - Inscription Management
- [ ] Inscription ownership verification via mempool API
- [ ] Inscription UTXO tracking
- [ ] Inscription escrow PSBTs (currently placeholder)
- [ ] Transfer inscription to buyer after payment

---

## Task Breakdown for Completion

Below are discrete, well-scoped tasks that can be completed by separate agents:

---

## 🔴 **CRITICAL PATH TASKS** (Must have for live auctions)

### Task 1: Integrate Bitcoin Wallet Connection
**Priority:** P0 (Blocker)  
**Estimated Effort:** Medium  
**Dependencies:** None

**Description:**  
Add wallet connection support to enable users to connect their Bitcoin wallet (Unisat, Leather, or Xverse) for signing transactions.

**Requirements:**
- Install and configure a wallet adapter library (e.g., `sats-connect` for Unisat, or custom adapter)
- Create a React context/provider for wallet state management
- Add wallet connection button in the UI header
- Store connected wallet address and public key
- Handle wallet disconnection
- Display connected wallet address with truncation
- Support testnet and mainnet network switching

**Files to modify:**
- Create: `apps/web/src/lib/wallet/WalletContext.tsx`
- Create: `apps/web/src/lib/wallet/walletAdapter.ts`
- Create: `apps/web/src/components/ui/WalletButton.tsx`
- Modify: `apps/web/src/components/auction/CreateAuctionWizard.tsx` (line 106: replace hardcoded seller address)

**Acceptance criteria:**
- User can click "Connect Wallet" and select a wallet provider
- Wallet address is displayed in the UI when connected
- Seller address field in auction creation is auto-populated from connected wallet
- Wallet connection persists across page reloads (localStorage)
- Clear error messages for wallet connection failures

---

### Task 2: Implement PSBT Signing Workflow for Auction Creation
**Priority:** P0 (Blocker)  
**Estimated Effort:** Large  
**Dependencies:** Task 1

**Description:**  
Build the complete PSBT (Partially Signed Bitcoin Transaction) signing workflow so sellers can escrow their inscription into the auction address.

**Requirements:**
- After auction creation API call, display the returned PSBT to the seller
- Use wallet adapter to request PSBT signature from connected wallet
- Broadcast the signed transaction to the Bitcoin network (via mempool.space API)
- Poll for transaction confirmation (at least 1 confirmation)
- Update auction status to "active" only after inscription is escrowed
- Display transaction ID and mempool link
- Handle signing failures with retry mechanism

**Files to modify:**
- Create: `apps/web/src/lib/bitcoin/psbtSigner.ts`
- Create: `apps/web/src/lib/bitcoin/broadcastTransaction.ts`
- Modify: `apps/web/src/components/auction/CreateAuctionWizard.tsx` (onSubmit handler)
- Modify: `apps/api/src/index.ts` (POST `/api/create-auction` - enhance with real PSBT generation)

**API Enhancements needed:**
- `POST /api/create-auction` should return a valid PSBT with inscription input and auction address output
- Currently generates placeholder PSBT - needs real implementation using `bitcoinjs-lib`

**Acceptance criteria:**
- Seller sees "Sign with wallet" prompt after auction creation
- PSBT is properly constructed with inscription UTXO as input
- Wallet popup displays PSBT details for approval
- Transaction is broadcast to Bitcoin network (testnet for testing)
- UI polls mempool API and shows "Waiting for confirmation..." status
- Auction becomes active after 1 confirmation
- Transaction hash is stored in auction record

---

### Task 3: Build Bidding Interface with Payment Flow
**Priority:** P0 (Blocker)  
**Estimated Effort:** Large  
**Dependencies:** Task 1, Task 2

**Description:**  
Create the bidding interface for clearing auctions where users can place bids and make payments via PSBT.

**Requirements:**
- Add "Place Bid" button on auction detail page (only for clearing auctions)
- Show form to enter bid quantity
- Call `POST /api/clearing/create-bid-payment` to get escrow address and bidId
- Generate payment PSBT sending bid amount from user's wallet to escrow address
- User signs payment PSBT with wallet
- Broadcast payment transaction
- Poll for confirmation and call `POST /api/clearing/confirm-bid-payment` after 1 confirmation
- Display bid status (payment_pending → payment_confirmed → settled)

**Files to modify:**
- Create: `apps/web/src/components/auction/BiddingInterface.tsx`
- Create: `apps/web/src/components/auction/PaymentPSBTModal.tsx`
- Modify: `apps/web/src/react/auctions/View.tsx` (add bidding UI)
- Modify: `apps/api/src/index.ts` (enhance payment PSBT generation)

**API Enhancements needed:**
- `POST /api/clearing/create-bid-payment` should generate real payment PSBT (currently returns mock escrow address)
- PSBT should have user's UTXO(s) as inputs and escrow address as output

**Acceptance criteria:**
- Bidder can enter quantity and see total bid amount
- "Place Bid" generates payment PSBT with correct inputs/outputs
- Wallet prompts user to sign payment transaction
- Transaction broadcasts successfully
- UI polls and shows "Payment pending confirmation..."
- Bid status updates to "payment_confirmed" after 1 confirmation
- Bidder can see their bid in the auction's bid list

---

### Task 4: Implement Real-Time Price Updates
**Priority:** P0 (Blocker)  
**Estimated Effort:** Medium  
**Dependencies:** None

**Description:**  
Add real-time price updates to auction detail pages so users see the current Dutch auction price decreasing over time.

**Requirements:**
- Use `setInterval` or `requestAnimationFrame` to update price display every second
- Calculate current price using `priceAtTime` from `@originals/dutch/schedule`
- Display countdown timer showing time until next price drop
- Show price history sparkline chart
- Highlight price changes with animation
- Stop updates when auction ends or is sold

**Files to modify:**
- Create: `apps/web/src/components/auction/LivePriceDisplay.tsx`
- Create: `apps/web/src/hooks/useLivePrice.ts`
- Modify: `apps/web/src/react/auctions/View.tsx`
- Modify: `apps/web/src/components/auction/AuctionCard.tsx`

**Acceptance criteria:**
- Price updates every second without page refresh
- Countdown timer shows "Next drop in: 5s"
- Price changes are animated/highlighted
- Sparkline shows price history over last 5 minutes
- Updates stop when auction ends
- No unnecessary API calls (calculate client-side)

---

## 🟡 **HIGH PRIORITY TASKS** (Important for production)

### Task 5: Add Inscription Ownership Verification
**Priority:** P1  
**Estimated Effort:** Medium  
**Dependencies:** None

**Description:**  
Integrate with mempool.space API to verify that the seller actually owns the inscription before allowing auction creation.

**Requirements:**
- When seller submits auction, extract txid and vout from inscription ID
- Query mempool.space API: `GET /tx/{txid}` to get transaction details
- Verify the output at vout matches seller's address
- Query `GET /tx/{txid}/outspends` to ensure the output is unspent
- Show clear error if seller doesn't own inscription or if already spent
- Add loading state during verification

**Files to modify:**
- Modify: `apps/api/src/index.ts` (POST `/api/create-auction` - already has basic implementation, enhance error handling)
- Create: `apps/web/src/lib/bitcoin/verifyInscription.ts` (client-side verification)
- Modify: `apps/web/src/components/auction/CreateAuctionWizard.tsx` (add pre-submission verification)

**Acceptance criteria:**
- API returns 403 error if seller doesn't own inscription
- API returns 403 error if inscription UTXO is already spent
- Frontend shows user-friendly error messages
- Verification happens before PSBT generation
- Works on testnet and mainnet

---

### Task 6: Build Settlement Dashboard for Auction Creators
**Priority:** P1  
**Estimated Effort:** Medium  
**Dependencies:** Task 3

**Description:**  
Create a dashboard for auction creators to monitor bids and execute settlement for clearing auctions.

**Requirements:**
- Display all bids for the auction with status
- Show clearing price calculation
- Show allocation plan (which bidders get items)
- "Process Settlement" button to call `POST /api/clearing/process-settlement`
- Generate inscription transfer PSBTs for each winning bidder
- Seller signs each transfer PSBT
- Broadcast transfers to Bitcoin network
- Mark bids as settled via `POST /api/clearing/mark-settled`

**Files to modify:**
- Create: `apps/web/src/components/auction/SettlementDashboard.tsx`
- Create: `apps/web/src/pages/auctions/settlement.astro`
- Modify: `apps/api/src/index.ts` (enhance settlement to generate real transfer PSBTs)

**API Enhancements needed:**
- `POST /api/clearing/process-settlement` should return array of PSBTs for inscription transfers
- Each PSBT moves an inscription from auction address to bidder's address

**Acceptance criteria:**
- Seller can view all bids and their payment status
- Dashboard shows clearing price and allocation
- Seller can click "Settle Auction"
- PSBTs generated for each inscription transfer
- Seller signs each PSBT in sequence
- Transactions broadcast successfully
- Bids marked as settled in database

---

### Task 7: Add Auction Status Monitoring Background Job
**Priority:** P1  
**Estimated Effort:** Small  
**Dependencies:** None

**Description:**  
Create a background job that automatically updates auction statuses (expire old auctions, check for payments, etc.)

**Requirements:**
- Create a scheduled job that runs every 60 seconds
- Call `POST /api/admin/check-expired` to expire ended auctions
- Poll mempool API for pending payment confirmations
- Update bid payment statuses automatically
- Log all status changes for audit
- Handle API errors gracefully

**Files to modify:**
- Create: `apps/api/src/jobs/auctionMonitor.ts`
- Modify: `apps/api/src/index.ts` (initialize job on server start)
- Modify: `packages/dutch/src/database.ts` (add method to check pending payments)

**Acceptance criteria:**
- Job runs automatically every 60 seconds
- Auctions past end_time are marked as expired
- Pending payments are checked for confirmations
- Job logs activity to console
- Job recovers from errors without crashing

---

## 🟢 **NICE-TO-HAVE TASKS** (Polish and UX)

### Task 8: Add Email Notifications
**Priority:** P2  
**Estimated Effort:** Medium  
**Dependencies:** None

**Description:**  
Send email notifications for key auction events (auction started, bid placed, auction ending soon, won auction).

**Requirements:**
- Integrate email service (SendGrid, Mailgun, or AWS SES)
- Send "Auction Started" email to seller
- Send "Bid Placed" email to bidder
- Send "Auction Ending Soon" email (24h, 1h before end)
- Send "Auction Won" email to winning bidders
- Allow users to opt-out of notifications

**Files to modify:**
- Create: `apps/api/src/services/email.ts`
- Create: `apps/api/src/templates/` (email HTML templates)
- Modify: `packages/dutch/src/database.ts` (add email addresses to auctions/bids)
- Modify: `apps/api/src/index.ts` (trigger emails on events)

---

### Task 9: Improve Auction Discovery with Filters and Search
**Priority:** P2  
**Estimated Effort:** Small  
**Dependencies:** None

**Description:**  
Enhance the auction listing page with better filtering, sorting, and search capabilities.

**Requirements:**
- Add price range filter (min/max BTC)
- Add date range filter (start date, end date)
- Add search by inscription ID or title
- Add sorting: ending soon, newest, highest price, lowest price
- Add pagination
- Persist filters in URL query params

**Files to modify:**
- Create: `apps/web/src/components/auction/AuctionFilters.tsx`
- Modify: `apps/web/src/pages/auctions/index.astro`
- Modify: `apps/web/src/lib/auctions/apiAdapter.ts`

---

### Task 10: Add Auction Analytics Dashboard
**Priority:** P2  
**Estimated Effort:** Medium  
**Dependencies:** None

**Description:**  
Build an analytics dashboard showing auction performance metrics.

**Requirements:**
- Total auctions created, active, sold, expired
- Total volume (BTC) traded
- Average sale price
- Average time to sale
- Charts showing volume over time
- Top sellers by volume

**Files to modify:**
- Create: `apps/web/src/pages/analytics.astro`
- Create: `apps/web/src/components/analytics/VolumeChart.tsx`
- Create: `apps/api/src/services/analytics.ts`
- Add API endpoint: `GET /api/analytics/summary`

---

## 🔧 **TECHNICAL DEBT & IMPROVEMENTS**

### Task 11: Add Comprehensive Error Handling
**Priority:** P1  
**Estimated Effort:** Small  

**Description:**  
Improve error handling across the application with user-friendly messages.

**Requirements:**
- Add error boundary components in React
- Standardize API error responses
- Add retry logic for failed API calls
- Display toast notifications for errors
- Log errors to monitoring service (Sentry)

---

### Task 12: Add E2E Tests for Full Auction Flow
**Priority:** P1  
**Estimated Effort:** Large  

**Description:**  
Write end-to-end tests covering the complete auction lifecycle from creation to settlement.

**Requirements:**
- Test auction creation with wallet integration (mocked)
- Test bidding flow with payment confirmation
- Test settlement and inscription transfer
- Use Playwright or Cypress
- Run tests in CI/CD pipeline

**Files to create:**
- `apps/web/tests/e2e/create-auction.spec.ts`
- `apps/web/tests/e2e/bidding-flow.spec.ts`
- `apps/web/tests/e2e/settlement.spec.ts`

---

### Task 13: Optimize Database Queries and Add Caching
**Priority:** P2  
**Estimated Effort:** Medium  

**Description:**  
Optimize slow database queries and add caching for frequently accessed data.

**Requirements:**
- Add database indexes on commonly queried fields
- Implement Redis caching for auction listings
- Cache mempool API responses (fee rates)
- Add connection pooling for PostgreSQL

---

### Task 14: Add Rate Limiting and DDoS Protection
**Priority:** P1  
**Estimated Effort:** Small  

**Description:**  
Protect API endpoints from abuse and DDoS attacks.

**Requirements:**
- Add rate limiting middleware (e.g., 100 requests/minute per IP)
- Add API key authentication for write operations
- Add CAPTCHA for auction creation
- Monitor suspicious activity

---

## 📋 **SUMMARY OF CRITICAL BLOCKERS**

To launch live auctions, you **must** complete these 4 tasks:

1. ✅ **Task 1:** Integrate Bitcoin Wallet Connection
2. ✅ **Task 2:** Implement PSBT Signing Workflow for Auction Creation  
3. ✅ **Task 3:** Build Bidding Interface with Payment Flow
4. ✅ **Task 4:** Implement Real-Time Price Updates

After these are complete, you'll have a functional MVP. The remaining tasks (5-14) improve production readiness, security, and user experience.

---

## 🎯 **RECOMMENDED EXECUTION ORDER**

**Week 1:** Core functionality
- Day 1-2: Task 1 (Wallet Connection)
- Day 3-4: Task 2 (PSBT Signing for Auction Creation)
- Day 5: Task 4 (Real-Time Price Updates)

**Week 2:** Bidding and payments
- Day 1-3: Task 3 (Bidding Interface)
- Day 4: Task 5 (Inscription Verification)
- Day 5: Task 7 (Background Job)

**Week 3:** Settlement and polish
- Day 1-2: Task 6 (Settlement Dashboard)
- Day 3: Task 11 (Error Handling)
- Day 4-5: Task 12 (E2E Tests)

**Week 4+:** Nice-to-haves
- Task 8 (Email Notifications)
- Task 9 (Search/Filters)
- Task 10 (Analytics)
- Task 13 (Performance)
- Task 14 (Security)

---

## 📚 **ADDITIONAL RESOURCES**

**Bitcoin Wallet Integration:**
- Unisat Wallet API: https://docs.unisat.io/dev/unisat-developer-service/unisat-wallet
- Sats Connect (unified adapter): https://github.com/SecretSatoshis/sats-connect

**PSBT Construction:**
- BitcoinJS-lib docs: https://github.com/bitcoinjs/bitcoinjs-lib
- PSBT explainer: https://github.com/bitcoin/bips/blob/master/bip-0174.mediawiki

**Mempool API:**
- Testnet API: https://mempool.space/testnet/docs/api
- Mainnet API: https://mempool.space/docs/api

**Current codebase strengths:**
- Excellent test coverage (11 test files covering core logic)
- Clean separation of concerns (database, API, UI)
- Type-safe schemas with Zod validation
- Secure key management with encryption

**Current codebase gaps:**
- No wallet integration
- PSBTs are placeholders
- No transaction broadcasting
- Missing UI for bidding

---

## ✅ **TESTING CHECKLIST** (For production launch)

Before going live, verify:

- [ ] Wallet connects successfully on testnet
- [ ] Inscription ownership verified via mempool API
- [ ] Auction creation PSBT signs and broadcasts
- [ ] Price updates in real-time
- [ ] Bidder can place bid and make payment
- [ ] Payment confirmation detected automatically
- [ ] Settlement generates valid transfer PSBTs
- [ ] Inscriptions transfer to winning bidders
- [ ] Expired auctions auto-update status
- [ ] Error handling prevents user confusion
- [ ] All E2E tests pass
- [ ] Security audit completed (rate limiting, input validation)

---

**Generated:** September 30, 2025  
**Next Review:** After completion of Tasks 1-4
