import { describe, it, expect, beforeAll } from 'bun:test';
import { SecureDutchyDatabase } from '../database';

describe('Deterministic key generation', () => {
  let db: SecureDutchyDatabase;

  beforeAll(() => {
    process.env.BITCOIN_NETWORK = 'testnet';
    db = new SecureDutchyDatabase(':memory:');
  });

  it('generates the same address for the same auctionId', () => {
    const a = db.generateAuctionKeyPair('repeat-id');
    const b = db.generateAuctionKeyPair('repeat-id');
    expect(a.address).toBe(b.address);
  });
});

