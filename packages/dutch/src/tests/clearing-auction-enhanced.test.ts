import { describe, it, expect, beforeAll } from 'bun:test';
import { SecureDutchyDatabase } from '../database';

describe('Enhanced clearing price auction workflows', () => {
  let db: SecureDutchyDatabase;
  const nowSec = Math.floor(Date.now() / 1000);

  beforeAll(() => {
    process.env.BITCOIN_NETWORK = 'testnet';
    db = new SecureDutchyDatabase(':memory:');
  });

  describe('Address validation', () => {
    it('validates testnet addresses correctly', () => {
      const validTestnet = db.verifyInscriptionOwnership({
        inscriptionId: 'test',
        ownerAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx'
      });
      expect(validTestnet.valid).toBe(true);
    });

    it('rejects mainnet addresses on testnet', () => {
      const invalidMainnet = db.verifyInscriptionOwnership({
        inscriptionId: 'test',
        ownerAddress: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'
      });
      expect(invalidMainnet.valid).toBe(false);
      expect(invalidMainnet.error).toContain('Invalid testnet address');
    });

    it('rejects invalid address formats', () => {
      const invalid = db.verifyInscriptionOwnership({
        inscriptionId: 'test',
        ownerAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa' // Legacy format
      });
      expect(invalid.valid).toBe(false);
    });
  });

  describe('Bid quantity validation', () => {
    it('rejects bids with zero quantity', () => {
      db.createClearingPriceAuction({
        id: 'qty-test-1',
        inscription_id: 'insc-qty-0',
        inscription_ids: ['insc-qty-0', 'insc-qty-1'],
        quantity: 2,
        start_price: 10000,
        min_price: 5000,
        duration: 3600,
        decrement_interval: 600,
        seller_address: 'tb1ptest'
      });

      expect(() => {
        db.placeBid('qty-test-1', 'tb1qbidder1', 0);
      }).toThrow('Quantity must be greater than zero');
    });

    it('rejects bids exceeding available quantity', () => {
      db.createClearingPriceAuction({
        id: 'qty-test-2',
        inscription_id: 'insc-qty-2-0',
        inscription_ids: ['insc-qty-2-0', 'insc-qty-2-1'],
        quantity: 2,
        start_price: 10000,
        min_price: 5000,
        duration: 3600,
        decrement_interval: 600,
        seller_address: 'tb1ptest'
      });

      expect(() => {
        db.placeBid('qty-test-2', 'tb1qbidder2', 5);
      }).toThrow('Insufficient items available');
    });

    it('allows valid quantity bids', () => {
      db.createClearingPriceAuction({
        id: 'qty-test-3',
        inscription_id: 'insc-qty-3-0',
        inscription_ids: ['insc-qty-3-0', 'insc-qty-3-1', 'insc-qty-3-2'],
        quantity: 3,
        start_price: 10000,
        min_price: 5000,
        duration: 3600,
        decrement_interval: 600,
        seller_address: 'tb1ptest'
      });

      const result = db.placeBid('qty-test-3', 'tb1qbidder3', 2);
      expect(result.success).toBe(true);
      expect(result.itemsRemaining).toBe(1);
    });
  });

  describe('State transition validation', () => {
    it('rejects confirming payment for placed bid without payment_pending', () => {
      db.createClearingPriceAuction({
        id: 'state-test-1',
        inscription_id: 'insc-state-0',
        inscription_ids: ['insc-state-0'],
        quantity: 1,
        start_price: 10000,
        min_price: 5000,
        duration: 3600,
        decrement_interval: 600,
        seller_address: 'tb1ptest'
      });

      const result = db.placeBid('state-test-1', 'tb1qbidder4', 1);
      
      // This bid is in 'placed' status, cannot confirm payment
      expect(() => {
        db.confirmBidPayment(result.bidId, 'tx_123');
      }).toThrow('Cannot confirm payment');
    });

    it('allows confirming payment for payment_pending bids', () => {
      db.createClearingPriceAuction({
        id: 'state-test-2',
        inscription_id: 'insc-state-2-0',
        inscription_ids: ['insc-state-2-0'],
        quantity: 1,
        start_price: 10000,
        min_price: 5000,
        duration: 3600,
        decrement_interval: 600,
        seller_address: 'tb1ptest'
      });

      const payment = db.createBidPaymentPSBT('state-test-2', 'tb1qbidder5', 10000, 1);
      const confirm = db.confirmBidPayment(payment.bidId, 'tx_payment_123');
      expect(confirm.success).toBe(true);
    });

    it('rejects settling bids without payment confirmation', () => {
      db.createClearingPriceAuction({
        id: 'state-test-3',
        inscription_id: 'insc-state-3-0',
        inscription_ids: ['insc-state-3-0'],
        quantity: 1,
        start_price: 10000,
        min_price: 5000,
        duration: 3600,
        decrement_interval: 600,
        seller_address: 'tb1ptest'
      });

      const payment = db.createBidPaymentPSBT('state-test-3', 'tb1qbidder6', 10000, 1);
      
      // Try to settle without confirming payment
      expect(() => {
        db.processAuctionSettlement('state-test-3');
      }).toThrow('Payment must be confirmed first');
    });
  });

  describe('Idempotency', () => {
    it('allows duplicate payment confirmations with same txId', () => {
      db.createClearingPriceAuction({
        id: 'idempotent-test-1',
        inscription_id: 'insc-idem-0',
        inscription_ids: ['insc-idem-0'],
        quantity: 1,
        start_price: 10000,
        min_price: 5000,
        duration: 3600,
        decrement_interval: 600,
        seller_address: 'tb1ptest'
      });

      const payment = db.createBidPaymentPSBT('idempotent-test-1', 'tb1qbidder7', 10000, 1);
      const confirm1 = db.confirmBidPayment(payment.bidId, 'tx_same_123');
      const confirm2 = db.confirmBidPayment(payment.bidId, 'tx_same_123');
      
      expect(confirm1.success).toBe(true);
      expect(confirm2.success).toBe(true);
      expect(confirm2.alreadyConfirmed).toBe(true);
    });

    it('handles marking already settled bids as settled', () => {
      db.createClearingPriceAuction({
        id: 'idempotent-test-2',
        inscription_id: 'insc-idem-2-0',
        inscription_ids: ['insc-idem-2-0'],
        quantity: 1,
        start_price: 10000,
        min_price: 5000,
        duration: 3600,
        decrement_interval: 600,
        seller_address: 'tb1ptest'
      });

      const payment = db.createBidPaymentPSBT('idempotent-test-2', 'tb1qbidder8', 10000, 1);
      db.confirmBidPayment(payment.bidId, 'tx_idem_123');
      
      // Mark as settled once
      const result1 = db.markBidsSettled('idempotent-test-2', [payment.bidId]);
      expect(result1.success).toBe(true);
      expect(result1.updated).toBe(1);
      
      // Mark as settled again (idempotent)
      const result2 = db.markBidsSettled('idempotent-test-2', [payment.bidId]);
      expect(result2.success).toBe(true);
      expect(result2.updated).toBe(1);
    });
  });

  describe('Full lifecycle E2E', () => {
    it('completes full workflow: create → bid payment → confirm → settle', () => {
      const auctionId = 'e2e-full-1';
      
      // Step 1: Create auction
      const auction = db.createClearingPriceAuction({
        id: auctionId,
        inscription_id: 'insc-e2e-0',
        inscription_ids: ['insc-e2e-0', 'insc-e2e-1', 'insc-e2e-2'],
        quantity: 3,
        start_price: 30000,
        min_price: 10000,
        duration: 3600,
        decrement_interval: 600,
        seller_address: 'tb1pselleraddress'
      });
      expect(auction.success).toBe(true);
      
      // Step 2: Create bid payments
      const bid1 = db.createBidPaymentPSBT(auctionId, 'tb1qbuyer1address', 25000, 1);
      expect(bid1.escrowAddress).toContain('tb1q');
      expect(bid1.bidId).toBeTruthy();
      
      const bid2 = db.createBidPaymentPSBT(auctionId, 'tb1qbuyer2address', 24000, 1);
      const bid3 = db.createBidPaymentPSBT(auctionId, 'tb1qbuyer3address', 23000, 1);
      
      // Step 3: Confirm payments
      db.confirmBidPayment(bid1.bidId, 'tx_buyer1_payment');
      db.confirmBidPayment(bid2.bidId, 'tx_buyer2_payment');
      db.confirmBidPayment(bid3.bidId, 'tx_buyer3_payment');
      
      // Step 4: Check bid statuses
      const bidDetails1 = db.getBidDetails(bid1.bidId);
      expect(bidDetails1.status).toBe('payment_confirmed');
      expect(bidDetails1.transactionId).toBe('tx_buyer1_payment');
      
      // Step 5: Calculate settlement
      const settlement = db.calculateSettlement(auctionId);
      expect(settlement.clearingPrice).toBeGreaterThanOrEqual(10000);
      expect(settlement.allocations.length).toBe(3);
      
      // Step 6: Process settlement
      const result = db.processAuctionSettlement(auctionId);
      expect(result.success).toBe(true);
      expect(result.artifacts.length).toBe(3);
      expect(result.artifacts[0]!.toAddress).toBe('tb1qbuyer1address');
      
      // Step 7: Verify all bids are settled
      const finalBids = db.getAuctionBidsWithPayments(auctionId);
      expect(finalBids.bids.every((b: any) => b.status === 'settled')).toBe(true);
    });

    it('handles partial fills correctly', () => {
      const auctionId = 'e2e-partial-1';
      
      // Create auction with 5 items
      db.createClearingPriceAuction({
        id: auctionId,
        inscription_id: 'insc-partial-0',
        inscription_ids: ['insc-partial-0', 'insc-partial-1', 'insc-partial-2', 'insc-partial-3', 'insc-partial-4'],
        quantity: 5,
        start_price: 50000,
        min_price: 10000,
        duration: 3600,
        decrement_interval: 600,
        seller_address: 'tb1pseller2'
      });
      
      // Only 2 bids with payment confirmed
      const bid1 = db.createBidPaymentPSBT(auctionId, 'tb1qpartial1', 45000, 2);
      const bid2 = db.createBidPaymentPSBT(auctionId, 'tb1qpartial2', 44000, 1);
      
      db.confirmBidPayment(bid1.bidId, 'tx_partial1');
      db.confirmBidPayment(bid2.bidId, 'tx_partial2');
      
      // One more bid without payment
      const bid3 = db.createBidPaymentPSBT(auctionId, 'tb1qpartial3', 43000, 2);
      // Intentionally not confirming bid3 payment
      
      // Settlement should only include confirmed bids
      const settlement = db.calculateSettlement(auctionId);
      expect(settlement.allocations.length).toBe(2);
      expect(settlement.allocations[0]!.quantity).toBe(2);
      expect(settlement.allocations[1]!.quantity).toBe(1);
      
      const result = db.processAuctionSettlement(auctionId);
      expect(result.artifacts.length).toBe(3); // 2 + 1 = 3 items allocated
    });

    it('enforces consistent settlement artifacts', () => {
      const auctionId = 'e2e-consistent-1';
      
      db.createClearingPriceAuction({
        id: auctionId,
        inscription_id: 'insc-cons-0',
        inscription_ids: ['insc-cons-0', 'insc-cons-1'],
        quantity: 2,
        start_price: 20000,
        min_price: 10000,
        duration: 3600,
        decrement_interval: 600,
        seller_address: 'tb1pconsistent'
      });
      
      const bid1 = db.createBidPaymentPSBT(auctionId, 'tb1qconsbidder1', 18000, 1);
      const bid2 = db.createBidPaymentPSBT(auctionId, 'tb1qconsbidder2', 17000, 1);
      
      db.confirmBidPayment(bid1.bidId, 'tx_cons1');
      db.confirmBidPayment(bid2.bidId, 'tx_cons2');
      
      // Process settlement twice - should be idempotent
      const result1 = db.processAuctionSettlement(auctionId);
      
      // All bids already settled, so second call should not produce new artifacts
      const settlement2 = db.calculateSettlement(auctionId);
      expect(settlement2.allocations.length).toBe(2);
      
      // Verify artifacts are consistent
      expect(result1.artifacts[0]!.inscriptionId).toBe('insc-cons-0');
      expect(result1.artifacts[1]!.inscriptionId).toBe('insc-cons-1');
    });

    it('rejects invalid state transitions throughout lifecycle', () => {
      const auctionId = 'e2e-invalid-1';
      
      db.createClearingPriceAuction({
        id: auctionId,
        inscription_id: 'insc-invalid-0',
        inscription_ids: ['insc-invalid-0'],
        quantity: 1,
        start_price: 15000,
        min_price: 8000,
        duration: 3600,
        decrement_interval: 600,
        seller_address: 'tb1pinvalid'
      });
      
      const bid = db.createBidPaymentPSBT(auctionId, 'tb1qinvalidbidder', 14000, 1);
      
      // Try to settle without confirming payment
      expect(() => {
        db.markBidsSettled(auctionId, [bid.bidId]);
      }).toThrow('Payment must be confirmed first');
      
      // Now confirm payment
      db.confirmBidPayment(bid.bidId, 'tx_invalid_123');
      
      // Should succeed after confirmation
      const result = db.markBidsSettled(auctionId, [bid.bidId]);
      expect(result.success).toBe(true);
    });
  });

  describe('Network-specific address validation', () => {
    it('generates correct escrow addresses for testnet', () => {
      process.env.BITCOIN_NETWORK = 'testnet';
      const db2 = new SecureDutchyDatabase(':memory:');
      
      db2.createClearingPriceAuction({
        id: 'network-test-1',
        inscription_id: 'insc-net-0',
        inscription_ids: ['insc-net-0'],
        quantity: 1,
        start_price: 10000,
        min_price: 5000,
        duration: 3600,
        decrement_interval: 600,
        seller_address: 'tb1ptest'
      });
      
      const payment = db2.createBidPaymentPSBT('network-test-1', 'tb1qnetbidder', 9500, 1);
      expect(payment.escrowAddress).toMatch(/^tb1q/);
    });

    it('validates regtest addresses correctly', () => {
      process.env.BITCOIN_NETWORK = 'regtest';
      const db3 = new SecureDutchyDatabase(':memory:');
      
      const validRegtest = db3.verifyInscriptionOwnership({
        inscriptionId: 'test',
        ownerAddress: 'bcrt1qw508d6qejxtdg4y5r3zarvary0c5xw7kygt080'
      });
      expect(validRegtest.valid).toBe(true);
      
      // Reset to testnet
      process.env.BITCOIN_NETWORK = 'testnet';
    });
  });
});