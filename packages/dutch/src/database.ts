/*
 In-memory implementation for testing flows referenced by the Bun tests.
 This is a minimal, self-contained module that provides deterministic key/address
 generation, single-auction (buy-now) handling, simplified clearing-price auctions,
 expiration updates, fee estimation utilities, and pricing calculators.
*/

export type BitcoinNetwork = 'mainnet' | 'testnet' | 'signet' | 'regtest';

export function getBitcoinNetwork(): BitcoinNetwork {
  const env = String((globalThis as any).process?.env?.BITCOIN_NETWORK || '').toLowerCase();
  if (env === 'testnet' || env === 'signet' || env === 'regtest') return env as BitcoinNetwork;
  return 'mainnet';
}

export interface SingleAuction {
  id: string;
  inscription_id: string;
  start_price: number;
  min_price: number;
  current_price: number;
  duration: number; // seconds
  decrement_interval: number; // seconds
  start_time: number; // epoch seconds
  end_time: number; // epoch seconds
  status: 'active' | 'sold' | 'expired';
  auction_address: string;
  encrypted_private_key?: string;
  created_at: number;
  updated_at: number;
  buyer_address?: string;
  transaction_id?: string;
}

export interface CreateClearingAuctionInput {
  id: string;
  inscription_id: string; // representative id
  inscription_ids: string[];
  quantity: number;
  start_price: number;
  min_price: number;
  duration: number;
  decrement_interval: number;
  seller_address: string;
}

export interface ClearingAuction {
  id: string;
  inscription_id: string;
  inscription_ids: string[];
  quantity: number;
  itemsRemaining: number;
  status: 'active' | 'sold' | 'expired';
  created_at: number;
  updated_at: number;
}

export class SecureDutchyDatabase {
  private singleAuctions: Map<string, SingleAuction> = new Map();
  private clearingAuctions: Map<string, ClearingAuction> = new Map();

  constructor(public dbPath: string) {}

  // Deterministic pseudo address/key generation for a given auction id
  generateAuctionKeyPair(auctionId: string): { keyPair: { privateKey: string }; address: string } {
    // Create a deterministic, syntactically valid-ish testnet address-like string
    const hash = this.simpleHash(auctionId);
    const suffix = hash.slice(0, 38).padEnd(38, 'q');
    const address = `tb1q${suffix}`; // matches simple regex-style checks
    const privateKey = `priv_${hash}`;
    return { keyPair: { privateKey }, address };
  }

  storeAuction(auction: SingleAuction, encryptedPrivateKey: string): void {
    const stored: SingleAuction = { ...auction, encrypted_private_key: encryptedPrivateKey };
    this.singleAuctions.set(auction.id, stored);
  }

  getAuction(id: string): SingleAuction | undefined {
    return this.singleAuctions.get(id);
  }

  listAuctions(options?: {
    status?: SingleAuction['status'] | ClearingAuction['status'];
    type?: 'single' | 'clearing';
  }): Array<(SingleAuction & { auction_type: 'single' }) | (ClearingAuction & { auction_type: 'clearing' })> {
    const results: Array<any> = [];
    if (!options?.type || options.type === 'single') {
      for (const a of this.singleAuctions.values()) {
        if (!options?.status || a.status === options.status) {
          results.push({ ...a, auction_type: 'single' as const });
        }
      }
    }
    if (!options?.type || options.type === 'clearing') {
      for (const a of this.clearingAuctions.values()) {
        if (!options?.status || a.status === options.status) {
          results.push({ ...a, auction_type: 'clearing' as const });
        }
      }
    }
    return results;
  }

  updateAuctionStatus(auctionId: string, status: 'active' | 'sold' | 'expired'):
    | { success: true; auctionType: 'single' | 'clearing' }
    | { success: false; error: string } {
    const now = Math.floor(Date.now() / 1000);
    const single = this.singleAuctions.get(auctionId);
    if (single) {
      single.status = status;
      single.updated_at = now;
      this.singleAuctions.set(auctionId, single);
      return { success: true, auctionType: 'single' };
    }
    const clearing = this.clearingAuctions.get(auctionId);
    if (clearing) {
      clearing.status = status;
      clearing.updated_at = now;
      this.clearingAuctions.set(auctionId, clearing);
      return { success: true, auctionType: 'clearing' };
    }
    return { success: false, error: 'Auction not found' };
  }

  executeBuyNow(auctionId: string, buyerAddress: string): { success: boolean; auctionType: 'single'; transactionId: string } {
    const auction = this.singleAuctions.get(auctionId);
    if (!auction) throw new Error('Auction not found');
    if (auction.status !== 'active') throw new Error('Auction not active');
    auction.status = 'sold';
    auction.buyer_address = buyerAddress;
    auction.transaction_id = `tx_${this.simpleHash(auctionId + buyerAddress).slice(0, 16)}`;
    auction.updated_at = Math.floor(Date.now() / 1000);
    this.singleAuctions.set(auctionId, auction);
    return { success: true, auctionType: 'single', transactionId: auction.transaction_id };
  }

  checkAndUpdateExpiredAuctions(): { updatedCount: number } {
    const now = Math.floor(Date.now() / 1000);
    let updated = 0;
    for (const auction of this.singleAuctions.values()) {
      if (auction.status === 'active' && auction.end_time <= now) {
        auction.status = 'expired';
        auction.updated_at = now;
        updated++;
      }
    }
    return { updatedCount: updated };
  }

  // Clearing price auctions (very simplified for tests)
  createClearingPriceAuction(input: CreateClearingAuctionInput): { success: boolean; auctionDetails: any } {
    const now = Math.floor(Date.now() / 1000);
    const auction: ClearingAuction = {
      id: input.id,
      inscription_id: input.inscription_id,
      inscription_ids: [...input.inscription_ids],
      quantity: input.quantity,
      itemsRemaining: input.quantity,
      status: 'active',
      created_at: now,
      updated_at: now,
    };
    this.clearingAuctions.set(input.id, auction);
    return {
      success: true,
      auctionDetails: { ...auction, auction_type: 'clearing' },
    };
  }

  placeBid(auctionId: string, bidderAddress: string, quantity: number): { success: boolean; itemsRemaining: number; auctionStatus: 'active' | 'sold' } {
    const auction = this.clearingAuctions.get(auctionId);
    if (!auction) throw new Error('Clearing auction not found');
    if (auction.status !== 'active') throw new Error('Auction not active');
    const qty = Math.max(1, Math.floor(quantity));
    auction.itemsRemaining = Math.max(0, auction.itemsRemaining - qty);
    if (auction.itemsRemaining === 0) {
      auction.status = 'sold';
    }
    auction.updated_at = Math.floor(Date.now() / 1000);
    this.clearingAuctions.set(auctionId, auction);
    return { success: true, itemsRemaining: auction.itemsRemaining, auctionStatus: auction.status };
  }

  getClearingAuctionStatus(auctionId: string): { auction: ClearingAuction; progress: { itemsRemaining: number } } {
    const auction = this.clearingAuctions.get(auctionId);
    if (!auction) throw new Error('Clearing auction not found');
    return { auction, progress: { itemsRemaining: auction.itemsRemaining } };
  }

  // Fee utilities (stubbed with positive values for tests)
  async getFeeRates(network: BitcoinNetwork | string): Promise<{ fast: number; normal: number; slow: number }> {
    // Return non-zero mock values
    return { fast: 25, normal: 15, slow: 5 };
  }

  async calculateTransactionFee(
    operation: string,
    priority: 'fast' | 'normal' | 'slow' | string,
    network: BitcoinNetwork | string,
  ): Promise<{ calculatedFee: number }> {
    const rates = await this.getFeeRates(network);
    const rate = priority === 'fast' ? rates.fast : priority === 'slow' ? rates.slow : rates.normal;
    // Simple size estimate (vbytes) multiplied by rate (sat/vB)
    const estimatedVBytes = 180; // arbitrary but reasonable
    const fee = Math.max(1, Math.floor(rate * estimatedVBytes));
    return { calculatedFee: fee };
  }

  async getFeeEstimationDisplay(operation: string, network: BitcoinNetwork | string): Promise<{
    options: Array<{ priority: 'Fast' | 'Normal' | 'Slow'; estimatedFee: number }>;
    networkStatus: string;
  }> {
    const rates = await this.getFeeRates(network);
    const options = [
      { priority: 'Fast' as const, estimatedFee: Math.max(1, rates.fast * 180) },
      { priority: 'Normal' as const, estimatedFee: Math.max(1, rates.normal * 180) },
      { priority: 'Slow' as const, estimatedFee: Math.max(1, rates.slow * 180) },
    ];
    const networkName = typeof network === 'string' ? network : (network as string);
    return { options, networkStatus: `ok:${networkName}` };
  }

  // Pricing calculators
  calculateCurrentPrice(
    auction: Pick<SingleAuction, 'start_price' | 'min_price' | 'duration' | 'start_time' | 'end_time' | 'status'>,
    atTimeSec: number,
  ): { currentPrice: number; auctionStatus: 'active' | 'expired' | 'sold' } {
    if (atTimeSec <= auction.start_time) {
      return { currentPrice: auction.start_price, auctionStatus: auction.status };
    }
    const elapsed = Math.max(0, Math.min(auction.duration, atTimeSec - auction.start_time));
    const range = auction.start_price - auction.min_price;
    const fraction = auction.duration > 0 ? elapsed / auction.duration : 1;
    const price = Math.round(auction.start_price - range * fraction);
    const clamped = Math.max(auction.min_price, price);
    const expired = atTimeSec >= auction.end_time;
    return { currentPrice: clamped, auctionStatus: expired ? 'expired' : auction.status };
  }

  calculatePriceWithIntervals(
    auction: Pick<SingleAuction, 'start_price' | 'min_price' | 'duration' | 'decrement_interval' | 'start_time'>,
    atTimeSec: number,
  ): { currentPrice: number } {
    if (atTimeSec <= auction.start_time) {
      return { currentPrice: auction.start_price };
    }
    const totalSteps = auction.decrement_interval > 0 ? Math.floor(auction.duration / auction.decrement_interval) : 0;
    if (totalSteps <= 0) return { currentPrice: Math.max(auction.min_price, auction.start_price) };
    const stepAmount = (auction.start_price - auction.min_price) / totalSteps;
    const elapsed = Math.min(auction.duration, Math.max(0, atTimeSec - auction.start_time));
    const stepsElapsed = Math.min(totalSteps, Math.floor(elapsed / auction.decrement_interval));
    const price = Math.round(auction.start_price - stepsElapsed * stepAmount);
    return { currentPrice: Math.max(auction.min_price, price) };
  }

  private simpleHash(input: string): string {
    let h1 = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
      h1 ^= input.charCodeAt(i);
      h1 = Math.imul(h1, 0x01000193);
      h1 >>>= 0;
    }
    return h1.toString(16).padStart(8, '0') + h1.toString(36);
  }

  reset(): void {
    this.singleAuctions.clear();
    this.clearingAuctions.clear();
  }
}

