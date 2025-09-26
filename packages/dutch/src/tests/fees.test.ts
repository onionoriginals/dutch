import { describe, it, expect, beforeAll } from 'bun:test';
import { SecureDutchyDatabase } from '../database';

describe('Fee calculations', () => {
  let db: SecureDutchyDatabase;

  beforeAll(() => {
    process.env.BITCOIN_NETWORK = 'testnet';
    db = new SecureDutchyDatabase(':memory:');
  });

  it('provides fee rates and calculates fees', async () => {
    const rates = await db.getFeeRates('testnet');
    expect(rates.fast).toBeGreaterThan(0);

    const calc = await db.calculateTransactionFee('inscription_transfer', 'normal', 'testnet');
    expect(calc.calculatedFee).toBeGreaterThan(0);

    const est = await db.getFeeEstimationDisplay('inscription_transfer', 'testnet');
    expect(Array.isArray(est.options)).toBe(true);
    expect(est.options.length).toBeGreaterThan(0);
    const normalOption = est.options.find(o => o.priority === 'Normal');
    expect(normalOption?.estimatedFee).toBeGreaterThan(0);
    expect(est.networkStatus).toBeDefined();
  });
});

