import { describe, it, expect, beforeAll } from 'bun:test';
import { SecureDutchyDatabase } from '../database';

describe('Deterministic key generation', () => {
  let db: SecureDutchyDatabase;

  beforeAll(() => {
    process.env.BITCOIN_NETWORK = 'testnet';
    db = new SecureDutchyDatabase(':memory:');
  });

  it('generates the same address for the same auctionId', async () => {
    const a = await db.generateAuctionKeyPair('repeat-id');
    const b = await db.generateAuctionKeyPair('repeat-id');
    expect(a.address).toBe(b.address);
  });

  it('is stable across instances given same seed', async () => {
    const password = 'pw';
    const db1 = new SecureDutchyDatabase(':memory:');
    const m = await db1.getOrCreateMasterMnemonic(password);
    const db2 = new SecureDutchyDatabase(':memory:');
    await db2.importMasterMnemonic(m, password);

    const a = await db1.generateAuctionKeyPair('repeat-id', { password });
    const b = await db2.generateAuctionKeyPair('repeat-id', { password });
    expect(a.address).toBe(b.address);

    db1.close();
    db2.close();
  });
});

