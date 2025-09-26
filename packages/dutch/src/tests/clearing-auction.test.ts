import { describe, it, expect, beforeAll } from 'bun:test';
import { SecureDutchyDatabase } from '../database';

describe('Clearing price auction flow', () => {
  let db: SecureDutchyDatabase;
  const nowSec = Math.floor(Date.now() / 1000);

  beforeAll(() => {
    process.env.BITCOIN_NETWORK = 'testnet';
    db = new SecureDutchyDatabase(':memory:');
  });

  it('creates a clearing auction and places bids until sold', () => {
    const createRes = db.createClearingPriceAuction({
      id: 'c1',
      inscription_id: 'insc-c1-0',
      inscription_ids: ['insc-c1-0', 'insc-c1-1', 'insc-c1-2'],
      quantity: 3,
      start_price: 30_000,
      min_price: 10_000,
      duration: 3600,
      decrement_interval: 600,
      seller_address: 'tb1ptest'
    });

    expect(createRes.success).toBe(true);
    expect(createRes.auctionDetails?.auction_type || 'clearing').toBeDefined();

    const b1 = db.placeBid('c1', 'tb1p_bidder_1', 1);
    expect(b1.success).toBe(true);
    expect(b1.itemsRemaining).toBe(2);

    const b2 = db.placeBid('c1', 'tb1p_bidder_2', 1);
    expect(b2.success).toBe(true);
    expect(b2.itemsRemaining).toBe(1);

    const b3 = db.placeBid('c1', 'tb1p_bidder_3', 1);
    expect(b3.success).toBe(true);
    expect(b3.auctionStatus).toBe('sold');

    const status = db.getClearingAuctionStatus('c1');
    expect(status.auction.status).toBe('sold');
    expect(status.progress.itemsRemaining).toBe(0);
  });
});

