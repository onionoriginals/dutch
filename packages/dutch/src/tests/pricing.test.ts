import { describe, it, expect, beforeAll } from 'bun:test';
import { SecureDutchyDatabase, getBitcoinNetwork } from '../database';

describe('Dutch auction pricing', () => {
  let db: SecureDutchyDatabase;
  const nowSec = Math.floor(Date.now() / 1000);

  beforeAll(() => {
    process.env.BITCOIN_NETWORK = 'testnet';
    // Use in-memory DB by passing a temp filename that Bun will create; tests are independent
    db = new SecureDutchyDatabase(':memory:');
  });

  it('calculates linear current price over time', () => {
    const auction = {
      id: 'a1',
      inscription_id: 'demo-insc',
      start_price: 100_000,
      min_price: 10_000,
      current_price: 100_000,
      duration: 1000,
      decrement_interval: 100,
      start_time: nowSec,
      end_time: nowSec + 1000,
      status: 'active',
      auction_address: 'tb1ptest',
      encrypted_private_key: 'x',
      created_at: nowSec,
      updated_at: nowSec,
    } as any;

    const { currentPrice: atStart } = db.calculateCurrentPrice(auction, auction.start_time);
    expect(atStart).toBe(100_000);

    const { currentPrice: mid } = db.calculateCurrentPrice(auction, auction.start_time + 500);
    // halfway from 100k to 10k is ~55k
    expect(mid).toBeCloseTo(55_000, -2);

    const { currentPrice: atEnd, auctionStatus } = db.calculateCurrentPrice(auction, auction.start_time + 1000);
    expect(atEnd).toBe(10_000);
    expect(auctionStatus).toBe('expired');
  });

  it('calculates stepped price respecting decrement_interval', () => {
    const auction = {
      id: 'a2',
      inscription_id: 'demo-insc',
      start_price: 100_000,
      min_price: 0,
      current_price: 100_000,
      duration: 1000,
      decrement_interval: 250,
      start_time: nowSec,
      end_time: nowSec + 1000,
      status: 'active',
      auction_address: 'tb1ptest',
      encrypted_private_key: 'x',
      created_at: nowSec,
      updated_at: nowSec,
    } as any;

    const s0 = db.calculatePriceWithIntervals(auction, auction.start_time).currentPrice;
    expect(s0).toBe(100_000);

    const s1 = db.calculatePriceWithIntervals(auction, auction.start_time + 250).currentPrice;
    expect(s1).toBe(75_000);

    const s2 = db.calculatePriceWithIntervals(auction, auction.start_time + 500).currentPrice;
    expect(s2).toBe(50_000);

    const s3 = db.calculatePriceWithIntervals(auction, auction.start_time + 750).currentPrice;
    expect(s3).toBe(25_000);

    const s4 = db.calculatePriceWithIntervals(auction, auction.start_time + 1000).currentPrice;
    expect(s4).toBe(0);
  });
});

