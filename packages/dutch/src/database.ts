/*
 SQLite-backed SecureDutchyDatabase using bun:sqlite. Provides:
 - Master seed management (BIP39 + BIP32 with tiny-secp256k1)
 - Deterministic key/address derivation (p2wpkh default, p2tr optional)
 - AES-256-GCM encryption with PBKDF2 for private key storage
 - Audit logs for security events
 - Auctions CRUD, pricing utilities, expiration checks, clearing auctions
 - Fee estimation stubs and injectable mempool client wrapper
*/

import { Database } from 'bun:sqlite'
import * as bip39 from 'bip39'
import { BIP32Factory, BIP32Interface } from 'bip32'
import * as tinySecp256k1 from 'tiny-secp256k1'
import * as bitcoin from 'bitcoinjs-lib'

export type BitcoinNetwork = 'mainnet' | 'testnet' | 'signet' | 'regtest';

export function getBitcoinNetwork(): BitcoinNetwork {
  const env = String((globalThis as any).process?.env?.BITCOIN_NETWORK || '').toLowerCase();
  if (env === 'mainnet' || env === 'testnet' || env === 'signet' || env === 'regtest') {
    return env as BitcoinNetwork;
  }
  // Safe default for development
  return 'testnet';
}

export interface SingleAuction {
  id: string;
  inscription_id: string;
  start_price: number;
  min_price: number;
  current_price: number;
  duration: number;
  decrement_interval: number;
  start_time: number;
  end_time: number;
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
  inscription_id: string;
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

export interface FeeRates {
  fast: number;
  normal: number;
  slow: number;
}

export interface MempoolClientLike {
  getFeeRates(network: BitcoinNetwork | string): Promise<FeeRates>;
}

const bip32 = BIP32Factory(tinySecp256k1 as any)

function nowSec(): number {
  return Math.floor(Date.now() / 1000)
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

function fromHex(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2)
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(hex.substr(i * 2, 2), 16)
  return arr
}

export class SecureDutchyDatabase {
  private db: Database
  private mempoolClient?: MempoolClientLike

  constructor(public dbPath: string, mempoolClient?: MempoolClientLike) {
    this.db = new Database(dbPath)
    this.mempoolClient = mempoolClient
    this.initialize()
  }

  private initialize(): void {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS single_auctions (
        id TEXT PRIMARY KEY,
        inscription_id TEXT NOT NULL,
        start_price INTEGER NOT NULL,
        min_price INTEGER NOT NULL,
        current_price INTEGER NOT NULL,
        duration INTEGER NOT NULL,
        decrement_interval INTEGER NOT NULL,
        start_time INTEGER NOT NULL,
        end_time INTEGER NOT NULL,
        status TEXT NOT NULL,
        auction_address TEXT NOT NULL,
        encrypted_private_key TEXT,
        buyer_address TEXT,
        transaction_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS clearing_auctions (
        id TEXT PRIMARY KEY,
        inscription_id TEXT NOT NULL,
        inscription_ids TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        items_remaining INTEGER NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event TEXT NOT NULL,
        details TEXT,
        created_at INTEGER NOT NULL
      );
    `)
  }

  // --- Network helpers ---
  private getBitcoinJsNetwork(): bitcoin.Network {
    const n = getBitcoinNetwork()
    if (n === 'mainnet') return bitcoin.networks.bitcoin
    if (n === 'testnet') return bitcoin.networks.testnet
    // bitcoinjs-lib doesn't have signet/regtest separately typed here; testnet params are acceptable for our usage
    return bitcoin.networks.testnet
  }

  // --- Seed management ---
  async getOrCreateMasterMnemonic(password: string = 'changeit'): Promise<string> {
    const row = this.db.query(`SELECT value FROM meta WHERE key = 'master_seed'`).get() as { value?: string } | undefined
    if (row && row.value) return await this.decryptToUtf8(row.value, password)
    const mnemonic = bip39.generateMnemonic(256)
    const enc = await this.encryptUtf8(mnemonic, password)
    this.db.query(`INSERT OR REPLACE INTO meta(key, value) VALUES('master_seed', ?)`).run(enc)
    await this.logEvent('seed_created', '{}')
    return mnemonic
  }

  async importMasterMnemonic(mnemonic: string, password: string = 'changeit'): Promise<void> {
    if (!bip39.validateMnemonic(mnemonic)) throw new Error('Invalid mnemonic')
    const enc = await this.encryptUtf8(mnemonic, password)
    this.db.query(`INSERT OR REPLACE INTO meta(key, value) VALUES('master_seed', ?)`).run(enc)
    await this.logEvent('seed_imported', '{}')
  }

  async rotateMasterMnemonic(newPassword: string = 'changeit', oldPassword: string = 'changeit'): Promise<void> {
    const row = this.db.query(`SELECT value FROM meta WHERE key = 'master_seed'`).get() as { value?: string } | undefined
    if (!row || !row.value) throw new Error('No master seed to rotate')
    const mnemonic = await this.decryptToUtf8(row.value, oldPassword)
    const enc = await this.encryptUtf8(mnemonic, newPassword)
    this.db.query(`UPDATE meta SET value = ? WHERE key = 'master_seed'`).run(enc)
    await this.logEvent('seed_rotated', '{}')
  }

  private async getRootNode(password: string = 'changeit'): Promise<BIP32Interface> {
    const mnemonic = await this.getOrCreateMasterMnemonic(password)
    const seed = await bip39.mnemonicToSeed(mnemonic)
    return bip32.fromSeed(seed, this.getBitcoinJsNetwork())
  }

  // --- Encryption helpers ---
  private encodeBase64(bytes: Uint8Array): string {
    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    return btoa(binary)
  }

  private decodeBase64(b64: string): Uint8Array {
    const binary = atob(b64)
    const out = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
    return out
  }

  async encryptUtf8(plaintext: string, password: string): Promise<string> {
    const encoder = new TextEncoder()
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), { name: 'PBKDF2' }, false, ['deriveKey'])
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    )
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(plaintext)))
    const payload = {
      alg: 'AES-256-GCM',
      kdf: 'PBKDF2-SHA256',
      iter: 100000,
      iv: this.encodeBase64(iv),
      salt: this.encodeBase64(salt),
      ct: this.encodeBase64(ciphertext)
    }
    return JSON.stringify(payload)
  }

  async decryptToUtf8(payload: string, password: string): Promise<string> {
    const data = JSON.parse(payload)
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()
    const salt = this.decodeBase64(data.salt)
    const iv = this.decodeBase64(data.iv)
    const ct = this.decodeBase64(data.ct)
    const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), { name: 'PBKDF2' }, false, ['deriveKey'])
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: data.iter || 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    )
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
    return decoder.decode(pt)
  }

  // --- Key/address derivation ---
  async generateAuctionKeyPair(
    auctionId: string,
    opts?: { addressType?: 'p2wpkh' | 'p2tr'; password?: string }
  ): Promise<{ keyPair: { privateKeyHex: string }; address: string }> {
    const addressType = opts?.addressType || 'p2wpkh'
    const root = await this.getRootNode(opts?.password)
    // Derive a deterministic index from auctionId
    const index = this.hashToUint32(auctionId)
    // Use a derivation path space for auctions: m/86'/1'/0'/0/index (p2tr) or 84' for p2wpkh
    const network = getBitcoinNetwork()
    const purpose = addressType === 'p2tr' ? 86 : 84
    const coin = network === 'mainnet' ? 0 : 1
    const path = `m/${purpose}'/${coin}'/0'/0/${index}`
    const child = root.derivePath(path)
    const privateKeyHex = toHex(child.privateKey!)
    const btcNet = this.getBitcoinJsNetwork()
    let address: string
    if (addressType === 'p2tr') {
      // Taproot payment
      const pub = Buffer.isBuffer(child.publicKey) ? child.publicKey : Buffer.from(child.publicKey)
      const xOnly = Buffer.from(pub.slice(1, 33))
      const p2tr = bitcoin.payments.p2tr({ internalPubkey: xOnly, network: btcNet })
      address = p2tr.address!
    } else {
      const pub = Buffer.isBuffer(child.publicKey) ? child.publicKey : Buffer.from(child.publicKey)
      const p2wpkh = bitcoin.payments.p2wpkh({ pubkey: pub, network: btcNet })
      address = p2wpkh.address!
    }
    return { keyPair: { privateKeyHex }, address }
  }

  // --- Auctions: single (buy-now) ---
  async storeAuction(auction: SingleAuction, encryptedPrivateKey: string): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO single_auctions(
        id, inscription_id, start_price, min_price, current_price, duration,
        decrement_interval, start_time, end_time, status, auction_address,
        encrypted_private_key, buyer_address, transaction_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      auction.id,
      auction.inscription_id,
      auction.start_price,
      auction.min_price,
      auction.current_price,
      auction.duration,
      auction.decrement_interval,
      auction.start_time,
      auction.end_time,
      auction.status,
      auction.auction_address,
      encryptedPrivateKey,
      auction.buyer_address || null,
      auction.transaction_id || null,
      auction.created_at,
      auction.updated_at,
    )
    await this.logEvent('auction_stored', JSON.stringify({ id: auction.id }))
  }

  getAuction(id: string): SingleAuction | undefined {
    const row = this.db.query(`SELECT * FROM single_auctions WHERE id = ?`).get(id) as any
    if (!row) return undefined
    return {
      id: row.id,
      inscription_id: row.inscription_id,
      start_price: row.start_price,
      min_price: row.min_price,
      current_price: row.current_price,
      duration: row.duration,
      decrement_interval: row.decrement_interval,
      start_time: row.start_time,
      end_time: row.end_time,
      status: row.status,
      auction_address: row.auction_address,
      encrypted_private_key: row.encrypted_private_key || undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
      buyer_address: row.buyer_address || undefined,
      transaction_id: row.transaction_id || undefined,
    }
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
    const a = this.getAuction(auctionId)
    if (!a) throw new Error('Auction not found')
    if (a.status !== 'active') throw new Error('Auction not active')
    const txId = `tx_${this.simpleHash(auctionId + buyerAddress).slice(0, 16)}`
    const now = nowSec()
    this.db.query(`
      UPDATE single_auctions
      SET status = 'sold', buyer_address = ?, transaction_id = ?, updated_at = ?
      WHERE id = ?
    `).run(buyerAddress, txId, now, auctionId)
    this.logEvent('auction_sold', JSON.stringify({ id: auctionId, buyerAddress })).catch(() => {})
    return { success: true, auctionType: 'single', transactionId: txId }
  }

  checkAndUpdateExpiredAuctions(): { updatedCount: number } {
    const now = nowSec()
    const res = this.db.query(`
      SELECT COUNT(*) as cnt FROM single_auctions WHERE status = 'active' AND end_time <= ?
    `).get(now) as { cnt: number }
    this.db.query(`
      UPDATE single_auctions SET status = 'expired', updated_at = ? WHERE status = 'active' AND end_time <= ?
    `).run(now, now)
    if (res && res.cnt > 0) this.logEvent('auctions_expired', JSON.stringify({ count: res.cnt })).catch(() => {})
    return { updatedCount: res?.cnt || 0 }
  }

  // --- Clearing auctions ---
  createClearingPriceAuction(input: CreateClearingAuctionInput): { success: boolean; auctionDetails: any } {
    const now = nowSec()
    this.db.query(`
      INSERT OR REPLACE INTO clearing_auctions(
        id, inscription_id, inscription_ids, quantity, items_remaining, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
    `).run(
      input.id,
      input.inscription_id,
      JSON.stringify(input.inscription_ids),
      input.quantity,
      input.quantity,
      now,
      now,
    )
    this.logEvent('clearing_created', JSON.stringify({ id: input.id })).catch(() => {})
    const auction = this.getClearingAuction(input.id)
    return { success: true, auctionDetails: { ...auction, auction_type: 'clearing' } }
  }

  private getClearingAuction(id: string): ClearingAuction {
    const row = this.db.query(`SELECT * FROM clearing_auctions WHERE id = ?`).get(id) as any
    if (!row) throw new Error('Clearing auction not found')
    return {
      id: row.id,
      inscription_id: row.inscription_id,
      inscription_ids: JSON.parse(row.inscription_ids || '[]'),
      quantity: row.quantity,
      itemsRemaining: row.items_remaining,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }
  }

  placeBid(auctionId: string, bidderAddress: string, quantity: number): { success: boolean; itemsRemaining: number; auctionStatus: 'active' | 'sold' } {
    // bidderAddress currently unused; included for auditing later
    const auction = this.getClearingAuction(auctionId)
    if (auction.status !== 'active') throw new Error('Auction not active')
    const qty = Math.max(1, Math.floor(quantity))
    const remaining = Math.max(0, auction.itemsRemaining - qty)
    const status = remaining === 0 ? 'sold' : 'active'
    const now = nowSec()
    this.db.query(`
      UPDATE clearing_auctions SET items_remaining = ?, status = ?, updated_at = ? WHERE id = ?
    `).run(remaining, status, now, auctionId)
    this.logEvent('clearing_bid', JSON.stringify({ id: auctionId, bidderAddress, quantity: qty })).catch(() => {})
    return { success: true, itemsRemaining: remaining, auctionStatus: status }
  }

  getClearingAuctionStatus(auctionId: string): { auction: ClearingAuction; progress: { itemsRemaining: number } } {
    const auction = this.getClearingAuction(auctionId)
    return { auction, progress: { itemsRemaining: auction.itemsRemaining } }
  }

  // --- Fees and mempool ---
  async getFeeRates(network: BitcoinNetwork | string): Promise<FeeRates> {
    if (this.mempoolClient) return this.mempoolClient.getFeeRates(network)
    // Stub default non-zero values for tests
    return { fast: 25, normal: 15, slow: 5 }
  }

  async calculateTransactionFee(
    operation: string,
    priority: 'fast' | 'normal' | 'slow' | string,
    network: BitcoinNetwork | string,
  ): Promise<{ calculatedFee: number }> {
    const rates = await this.getFeeRates(network)
    const rate = priority === 'fast' ? rates.fast : priority === 'slow' ? rates.slow : rates.normal
    const estimatedVBytes = 180
    const fee = Math.max(1, Math.floor(rate * estimatedVBytes))
    return { calculatedFee: fee }
  }

  async getFeeEstimationDisplay(operation: string, network: BitcoinNetwork | string): Promise<{
    options: Array<{ priority: 'Fast' | 'Normal' | 'Slow'; estimatedFee: number }>;
    networkStatus: string;
  }> {
    const rates = await this.getFeeRates(network)
    const options = [
      { priority: 'Fast' as const, estimatedFee: Math.max(1, rates.fast * 180) },
      { priority: 'Normal' as const, estimatedFee: Math.max(1, rates.normal * 180) },
      { priority: 'Slow' as const, estimatedFee: Math.max(1, rates.slow * 180) },
    ]
    const networkName = typeof network === 'string' ? network : (network as string)
    return { options, networkStatus: `ok:${networkName}` }
  }

  // --- Pricing calculators ---
  calculateCurrentPrice(
    auction: Pick<SingleAuction, 'start_price' | 'min_price' | 'duration' | 'start_time' | 'end_time' | 'status'>,
    atTimeSec: number,
  ): { currentPrice: number; auctionStatus: 'active' | 'expired' | 'sold' } {
    if (atTimeSec <= auction.start_time) {
      return { currentPrice: auction.start_price, auctionStatus: auction.status }
    }
    const elapsed = Math.max(0, Math.min(auction.duration, atTimeSec - auction.start_time))
    const range = auction.start_price - auction.min_price
    const fraction = auction.duration > 0 ? elapsed / auction.duration : 1
    const price = Math.round(auction.start_price - range * fraction)
    const clamped = Math.max(auction.min_price, price)
    const expired = atTimeSec >= auction.end_time
    return { currentPrice: clamped, auctionStatus: expired ? 'expired' : auction.status }
  }

  calculatePriceWithIntervals(
    auction: Pick<SingleAuction, 'start_price' | 'min_price' | 'duration' | 'decrement_interval' | 'start_time'>,
    atTimeSec: number,
  ): { currentPrice: number } {
    if (atTimeSec <= auction.start_time) {
      return { currentPrice: auction.start_price }
    }
    const totalSteps = auction.decrement_interval > 0 ? Math.floor(auction.duration / auction.decrement_interval) : 0
    if (totalSteps <= 0) return { currentPrice: Math.max(auction.min_price, auction.start_price) }
    const stepAmount = (auction.start_price - auction.min_price) / totalSteps
    const elapsed = Math.min(auction.duration, Math.max(0, atTimeSec - auction.start_time))
    const stepsElapsed = Math.min(totalSteps, Math.floor(elapsed / auction.decrement_interval))
    const price = Math.round(auction.start_price - stepsElapsed * stepAmount)
    return { currentPrice: Math.max(auction.min_price, price) }
  }

  // --- Audit ---
  private async logEvent(event: string, details: string): Promise<void> {
    const ts = nowSec()
    this.db.query(`INSERT INTO audit_logs(event, details, created_at) VALUES(?, ?, ?)`).run(event, details, ts)
  }

  // --- Utils ---
  private simpleHash(input: string): string {
    let h1 = 0x811c9dc5
    for (let i = 0; i < input.length; i++) {
      h1 ^= input.charCodeAt(i)
      h1 = Math.imul(h1, 0x01000193)
      h1 >>>= 0
    }
    return h1.toString(16).padStart(8, '0') + h1.toString(36)
  }

  private hashToUint32(input: string): number {
    // Simple FNV-1a 32-bit to index space
    let h1 = 0x811c9dc5
    for (let i = 0; i < input.length; i++) {
      h1 ^= input.charCodeAt(i)
      h1 = Math.imul(h1, 0x01000193)
      h1 >>>= 0
    }
    // avoid hardened index overflow; cap within non-hardened child range
    return h1 % 0x7fffffff
  }

  reset(): void {
    this.singleAuctions.clear();
    this.clearingAuctions.clear();
  }
}

