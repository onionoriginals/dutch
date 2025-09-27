import { describe, it, expect, beforeAll } from 'bun:test';
import { SecureDutchyDatabase, type BitcoinNetwork } from '../database';

class FakeMempoolClient {
  async getFeeRates(network: BitcoinNetwork | string) {
    return { fast: 100, normal: 50, slow: 10 };
  }
}

describe('Mempool client injection', () => {
  let db: SecureDutchyDatabase;

  beforeAll(() => {
    process.env.BITCOIN_NETWORK = 'testnet';
    db = new SecureDutchyDatabase(':memory:', new FakeMempoolClient() as any);
  });

  it('uses injected mempool client for fee rates', async () => {
    const rates = await db.getFeeRates('testnet');
    expect(rates.fast).toBe(100);
    const calc = await db.calculateTransactionFee('transfer', 'fast', 'testnet');
    expect(calc.calculatedFee).toBeGreaterThan(0);
  });
});

