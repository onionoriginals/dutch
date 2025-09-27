import { describe, it, expect, beforeAll } from 'bun:test';
import { SecureDutchyDatabase } from '../database';

describe('Automatic expiration handling', () => {
  let db: SecureDutchyDatabase;
  const nowSec = Math.floor(Date.now() / 1000);

  beforeAll(() => {
    process.env.BITCOIN_NETWORK = 'testnet';
    db = new SecureDutchyDatabase(':memory:');
  });

  it('marks auctions expired when end_time passed', async () => {
    const { keyPair, address } = await db.generateAuctionKeyPair('exp1');
    db.storeAuction({
      id: 'exp1',
      inscription_id: 'insc-exp',
      start_price: 10_000,
      min_price: 1_000,
      current_price: 10_000,
      duration: 1, // short duration
      decrement_interval: 1,
      start_time: nowSec - 10, // started 10s ago
      end_time: nowSec - 9, // ended 9s ago
      status: 'active',
      auction_address: address,
      created_at: nowSec - 10,
      updated_at: nowSec - 10,
    } as any, keyPair.privateKeyHex!);

    const res = db.checkAndUpdateExpiredAuctions();
    expect(res.updatedCount).toBeGreaterThanOrEqual(1);

    const updated = db.getAuction('exp1');
    expect(updated?.status).toBe('expired');
  });
});

