import { describe, it, expect, beforeAll } from 'bun:test';
import { SecureDutchyDatabase } from '../database';

describe('Taproot address derivation', () => {
  let db: SecureDutchyDatabase;

  beforeAll(() => {
    process.env.BITCOIN_NETWORK = 'testnet';
    db = new SecureDutchyDatabase(':memory:');
  });

  it('derives a valid-looking testnet p2tr address', async () => {
    const { address } = await db.generateAuctionKeyPair('tr-1', { addressType: 'p2tr' });
    expect(address.startsWith('tb1p')).toBe(true);
    expect(address.length).toBeGreaterThan(20);
  });
});

