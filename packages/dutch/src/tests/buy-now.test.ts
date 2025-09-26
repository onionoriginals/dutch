import { describe, it, expect, beforeAll } from 'bun:test';
import { SecureDutchyDatabase } from '../database';

describe('Buy-now flow (single auction)', () => {
  let db: SecureDutchyDatabase;
  const nowSec = Math.floor(Date.now() / 1000);

  beforeAll(() => {
    process.env.BITCOIN_NETWORK = 'testnet';
    db = new SecureDutchyDatabase(':memory:');
  });

  it('executes buy-now and marks auction sold', () => {
    // Create a minimal single auction directly using storeAuction
    const { keyPair, address } = db.generateAuctionKeyPair('s1');
    db.storeAuction({
      id: 's1',
      inscription_id: 'insc-s1-0',
      start_price: 50_000,
      min_price: 10_000,
      current_price: 50_000,
      duration: 3600,
      decrement_interval: 60,
      start_time: nowSec,
      end_time: nowSec + 3600,
      status: 'active',
      auction_address: address,
      created_at: nowSec,
      updated_at: nowSec,
    } as any, keyPair.privateKey!);

    // Use a syntactically valid testnet Bech32 address (regex-only validation in code)
    const buyer = 'tb1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';
    const res = db.executeBuyNow('s1', buyer);
    expect(res.success).toBe(true);
    expect(res.auctionType).toBe('single');
    expect(res.transactionId).toBeTruthy();

    const updated = db.getAuction('s1');
    expect(updated?.status).toBe('sold');
    expect(updated?.buyer_address).toBe(buyer);
    expect(updated?.transaction_id).toBeTruthy();
  });
});

