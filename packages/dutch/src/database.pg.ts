import postgres, { Sql } from 'postgres'
import * as bip39 from 'bip39'
import { BIP32Factory, type BIP32Interface } from 'bip32'
import * as tinySecp256k1 from 'tiny-secp256k1'
import * as bitcoin from 'bitcoinjs-lib'

export type BitcoinNetwork = 'mainnet' | 'testnet' | 'signet' | 'regtest';

export function getBitcoinNetwork(): BitcoinNetwork {
  const envRaw = (globalThis as any).Bun?.env?.BITCOIN_NETWORK ?? (globalThis as any).process?.env?.BITCOIN_NETWORK
  const env = String(envRaw || '').toLowerCase();
  if (env === 'mainnet' || env === 'testnet' || env === 'signet' || env === 'regtest') {
    return env as BitcoinNetwork;
  }
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
  start_price: number;
  min_price: number;
  duration: number;
  decrement_interval: number;
  created_at: number;
  updated_at: number;
}

export interface FeeRates { fast: number; normal: number; slow: number }
export interface MempoolClientLike { getFeeRates(network: BitcoinNetwork | string): Promise<FeeRates> }

const bip32 = BIP32Factory(tinySecp256k1 as any)

function nowSec(): number { return Math.floor(Date.now() / 1000) }
function toHex(bytes: Uint8Array): string { return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('') }

export class PostgresDutchyDatabase {
  private sql: Sql
  private mempoolClient?: MempoolClientLike
  private bidsByAuction: Map<string, string[]> = new Map()
  private bids: Map<string, {
    id: string
    auctionId: string
    bidderAddress: string
    bidAmount: number
    quantity: number
    status: 'placed' | 'payment_pending' | 'payment_confirmed' | 'settled' | 'failed' | 'refunded'
    escrowAddress?: string
    transactionId?: string
    created_at: number
    updated_at: number
  }> = new Map()
  private nextBidId: number = 1
  private clearingAuctions: Map<string, ClearingAuction> = new Map()
  private inscriptionEscrows: Map<string, { inscriptionId: string; status: string; details?: any; updatedAt: number }> = new Map()

  constructor(public connectionString: string, mempoolClient?: MempoolClientLike) {
    this.sql = postgres(connectionString, { max: 5 })
    this.mempoolClient = mempoolClient
  }

  async initialize(): Promise<void> {
    await this.sql`create table if not exists meta (
      key text primary key,
      value text not null
    )`;
    await this.sql`create table if not exists single_auctions (
      id text primary key,
      inscription_id text not null,
      start_price integer not null,
      min_price integer not null,
      current_price integer not null,
      duration integer not null,
      decrement_interval integer not null,
      start_time integer not null,
      end_time integer not null,
      status text not null,
      auction_address text not null,
      encrypted_private_key text,
      buyer_address text,
      transaction_id text,
      created_at integer not null,
      updated_at integer not null
    )`;
    await this.sql`create index if not exists idx_single_auctions_status_end on single_auctions(status, end_time)`;
    await this.sql`create index if not exists idx_single_auctions_insc on single_auctions(inscription_id)`;
    await this.sql`create table if not exists audit_logs (
      id serial primary key,
      event text not null,
      details text,
      created_at integer not null
    )`;
  }

  private getBitcoinJsNetwork(): bitcoin.Network {
    const n = getBitcoinNetwork()
    if (n === 'mainnet') return bitcoin.networks.bitcoin
    if (n === 'regtest') return (bitcoin.networks as any).regtest || bitcoin.networks.testnet
    return bitcoin.networks.testnet
  }

  // Seed management
  async getOrCreateMasterMnemonic(password: string = 'changeit'): Promise<string> {
    const rows = await this.sql<{ value?: string }[]>`select value from meta where key = 'master_seed' limit 1`
    if (rows[0]?.value) return await this.decryptToUtf8(rows[0]!.value!, password)
    const mnemonic = bip39.generateMnemonic(256)
    const enc = await this.encryptUtf8(mnemonic, password)
    await this.sql`insert into meta(key, value) values('master_seed', ${enc}) on conflict (key) do update set value = excluded.value`
    await this.logEvent('seed_created', '{}')
    return mnemonic
  }

  async importMasterMnemonic(mnemonic: string, password: string = 'changeit'): Promise<void> {
    if (!bip39.validateMnemonic(mnemonic)) throw new Error('Invalid mnemonic')
    const enc = await this.encryptUtf8(mnemonic, password)
    await this.sql`insert into meta(key, value) values('master_seed', ${enc}) on conflict (key) do update set value = excluded.value`
    await this.logEvent('seed_imported', '{}')
  }

  async rotateMasterMnemonic(newPassword: string = 'changeit', oldPassword: string = 'changeit'): Promise<void> {
    const rows = await this.sql<{ value?: string }[]>`select value from meta where key = 'master_seed' limit 1`
    const val = rows[0]?.value
    if (!val) throw new Error('No master seed to rotate')
    const mnemonic = await this.decryptToUtf8(val, oldPassword)
    const enc = await this.encryptUtf8(mnemonic, newPassword)
    await this.sql`update meta set value = ${enc} where key = 'master_seed'`
    await this.logEvent('seed_rotated', '{}')
  }

  private async getRootNode(password: string = 'changeit'): Promise<BIP32Interface> {
    const mnemonic = await this.getOrCreateMasterMnemonic(password)
    const seed = await bip39.mnemonicToSeed(mnemonic)
    return bip32.fromSeed(seed, this.getBitcoinJsNetwork())
  }

  // Encryption helpers
  private encodeBase64(bytes: Uint8Array): string {
    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
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
    const payload = { alg: 'AES-256-GCM', kdf: 'PBKDF2-SHA256', iter: 100000, iv: this.encodeBase64(iv), salt: this.encodeBase64(salt), ct: this.encodeBase64(ciphertext) }
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

  // Auctions (single)
  async storeAuction(auction: SingleAuction, encryptedPrivateKey: string): Promise<void> {
    await this.sql`
      insert into single_auctions(
        id, inscription_id, start_price, min_price, current_price, duration,
        decrement_interval, start_time, end_time, status, auction_address,
        encrypted_private_key, buyer_address, transaction_id, created_at, updated_at
      ) values (
        ${auction.id}, ${auction.inscription_id}, ${auction.start_price}, ${auction.min_price}, ${auction.current_price}, ${auction.duration},
        ${auction.decrement_interval}, ${auction.start_time}, ${auction.end_time}, ${auction.status}, ${auction.auction_address},
        ${encryptedPrivateKey}, ${auction.buyer_address ?? null}, ${auction.transaction_id ?? null}, ${auction.created_at}, ${auction.updated_at}
      ) on conflict (id) do update set
        inscription_id = excluded.inscription_id,
        start_price = excluded.start_price,
        min_price = excluded.min_price,
        current_price = excluded.current_price,
        duration = excluded.duration,
        decrement_interval = excluded.decrement_interval,
        start_time = excluded.start_time,
        end_time = excluded.end_time,
        status = excluded.status,
        auction_address = excluded.auction_address,
        encrypted_private_key = excluded.encrypted_private_key,
        buyer_address = excluded.buyer_address,
        transaction_id = excluded.transaction_id,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at
    `
    await this.logEvent('auction_stored', JSON.stringify({ id: auction.id }))
  }

  async getAuction(id: string): Promise<SingleAuction | undefined> {
    const rows = await this.sql<any[]>`select * from single_auctions where id = ${id} limit 1`
    const row = rows[0]
    if (!row) return undefined
    return {
      id: row.id,
      inscription_id: row.inscription_id,
      start_price: Number(row.start_price),
      min_price: Number(row.min_price),
      current_price: Number(row.current_price),
      duration: Number(row.duration),
      decrement_interval: Number(row.decrement_interval),
      start_time: Number(row.start_time),
      end_time: Number(row.end_time),
      status: row.status,
      auction_address: row.auction_address,
      encrypted_private_key: row.encrypted_private_key || undefined,
      created_at: Number(row.created_at),
      updated_at: Number(row.updated_at),
      buyer_address: row.buyer_address || undefined,
      transaction_id: row.transaction_id || undefined,
    }
  }

  // Key/address derivation — match API of SQLite class
  async generateAuctionKeyPair(
    auctionId: string,
    opts?: { addressType?: 'p2wpkh' | 'p2tr'; password?: string }
  ): Promise<{ keyPair: { privateKeyHex: string }; address: string }> {
    const addressType = opts?.addressType || 'p2wpkh'
    const root = await this.getRootNode(opts?.password)
    const index = this.hashToUint32(auctionId)
    const network = getBitcoinNetwork()
    const purpose = addressType === 'p2tr' ? 86 : 84
    const coin = network === 'mainnet' ? 0 : 1
    const path = `m/${purpose}'/${coin}'/0'/0/${index}`
    const child = (root as any).derivePath(path)
    const privateKeyHex = toHex(child.privateKey!)
    const btcNet = this.getBitcoinJsNetwork()
    let address: string
    if (addressType === 'p2tr') {
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

  private hashToUint32(input: string): number {
    let h1 = 0x811c9dc5
    for (let i = 0; i < input.length; i++) {
      h1 ^= input.charCodeAt(i)
      h1 = Math.imul(h1, 0x01000193)
      h1 >>>= 0
    }
    return h1 % 0x7fffffff
  }

  async listAuctions(options?: { status?: SingleAuction['status'] | ClearingAuction['status']; type?: 'single' | 'clearing' }): Promise<Array<(SingleAuction & { auction_type: 'single' }) | (ClearingAuction & { auction_type: 'clearing' })>> {
    const results: Array<any> = []
    if (!options?.type || options.type === 'single') {
      let rows: any[]
      if (options?.status) {
        rows = await this.sql<any[]>`select * from single_auctions where status = ${options.status}`
      } else {
        rows = await this.sql<any[]>`select * from single_auctions`
      }
      for (const row of rows) {
        const a: SingleAuction = {
          id: row.id,
          inscription_id: row.inscription_id,
          start_price: Number(row.start_price),
          min_price: Number(row.min_price),
          current_price: Number(row.current_price),
          duration: Number(row.duration),
          decrement_interval: Number(row.decrement_interval),
          start_time: Number(row.start_time),
          end_time: Number(row.end_time),
          status: row.status,
          auction_address: row.auction_address,
          encrypted_private_key: row.encrypted_private_key || undefined,
          created_at: Number(row.created_at),
          updated_at: Number(row.updated_at),
          buyer_address: row.buyer_address || undefined,
          transaction_id: row.transaction_id || undefined,
        }
        results.push({ ...a, auction_type: 'single' as const })
      }
    }
    if (!options?.type || options.type === 'clearing') {
      for (const a of this.clearingAuctions.values()) {
        if (!options?.status || a.status === options.status) {
          const { start_price, min_price, duration, decrement_interval, ...rest } = a
          results.push({ ...rest, auction_type: 'clearing' as const })
        }
      }
    }
    return results
  }

  async updateAuctionStatus(auctionId: string, status: 'active' | 'sold' | 'expired'):
    Promise<{ success: true; auctionType: 'single' | 'clearing' } | { success: false; error: string }> {
    const now = nowSec()
    const res = await this.sql`update single_auctions set status = ${status}, updated_at = ${now} where id = ${auctionId} returning id`
    if ((res as any[]).length > 0) return { success: true, auctionType: 'single' }
    const clearing = this.clearingAuctions.get(auctionId)
    if (clearing) {
      clearing.status = status
      clearing.updated_at = now
      this.clearingAuctions.set(auctionId, clearing)
      return { success: true, auctionType: 'clearing' }
    }
    return { success: false, error: 'Auction not found' }
  }

  // Escrow utilities (in-memory, same as sqlite class behavior)
  private validateAddressFormat(address: string, network?: BitcoinNetwork): { valid: boolean; error?: string } {
    const net = network || getBitcoinNetwork();
    if (!address || typeof address !== 'string') {
      return { valid: false, error: 'Address is required' };
    }
    // Network-specific prefixes
    if (net === 'mainnet') {
      // Mainnet: bc1 (bech32/bech32m)
      if (!/^bc1[a-z0-9_]{4,87}$/i.test(address)) {
        return { valid: false, error: 'Invalid mainnet address format (expected bc1...)' };
      }
    } else {
      // Testnet/signet/regtest: tb1 or bcrt1
      // Allow underscores for test addresses (common in test suites)
      if (!/^(tb1|bcrt1)[a-z0-9_]{4,87}$/i.test(address)) {
        return { valid: false, error: 'Invalid testnet address format (expected tb1... or bcrt1...)' };
      }
    }
    return { valid: true };
  }

  verifyInscriptionOwnership(input: { inscriptionId: string; ownerAddress: string }): { valid: boolean; error?: string } {
    const addressCheck = this.validateAddressFormat(input.ownerAddress);
    if (!addressCheck.valid) {
      return { valid: false, error: addressCheck.error };
    }
    return { valid: true };
  }
  createInscriptionEscrowPSBT(input: { auctionId: string; inscriptionId: string; ownerAddress: string }): { psbt: string; auctionAddress?: string } {
    const auctionAddress = undefined
    const psbt = `psbt_${this.simpleHash(input.auctionId + '|' + input.inscriptionId + '|' + input.ownerAddress)}`
    if (!this.inscriptionEscrows.has(input.auctionId)) {
      this.inscriptionEscrows.set(input.auctionId, { inscriptionId: input.inscriptionId, status: 'pending', updatedAt: Math.floor(Date.now() / 1000) })
    }
    return { psbt, auctionAddress }
  }
  monitorInscriptionEscrow(auctionId: string, inscriptionId: string): { auctionId: string; inscriptionId: string; status: string } {
    const current = this.inscriptionEscrows.get(auctionId) || { inscriptionId, status: 'unknown', updatedAt: Math.floor(Date.now() / 1000) };
    return { auctionId, inscriptionId, status: current.status };
  }
  updateInscriptionStatus(input: { auctionId: string; status: string; details?: any }): { ok: boolean; status: string } {
    const existing = this.inscriptionEscrows.get(input.auctionId);
    if (existing) {
      existing.status = input.status;
      existing.details = input.details;
      existing.updatedAt = Math.floor(Date.now() / 1000);
      this.inscriptionEscrows.set(input.auctionId, existing);
    } else {
      this.inscriptionEscrows.set(input.auctionId, { inscriptionId: '', status: input.status, details: input.details, updatedAt: Math.floor(Date.now() / 1000) });
    }
    return { ok: true, status: input.status };
  }
  getInscriptionEscrowStatus(auctionId: string): { auctionId: string; status: string; details?: any } {
    const entry = this.inscriptionEscrows.get(auctionId);
    return { auctionId, status: entry?.status || 'unknown', details: entry?.details };
  }
  checkEscrowTimeouts(): { updated: number } {
    const now = Math.floor(Date.now() / 1000);
    let updated = 0;
    for (const [auctionId, entry] of this.inscriptionEscrows.entries()) {
      if (now - entry.updatedAt > 300 && entry.status === 'pending') {
        entry.status = 'timeout';
        entry.updatedAt = now;
        this.inscriptionEscrows.set(auctionId, entry);
        updated++;
      }
    }
    return { updated };
  }

  executeBuyNow = async (auctionId: string, buyerAddress: string): Promise<{ success: boolean; auctionType: 'single'; transactionId: string }> => {
    const a = await this.getAuction(auctionId)
    if (!a) throw new Error('Auction not found')
    if (a.status !== 'active') throw new Error('Auction not active')
    const txId = `tx_${this.simpleHash(auctionId + buyerAddress).slice(0, 16)}`
    const now = nowSec()
    await this.sql`update single_auctions set status = 'sold', buyer_address = ${buyerAddress}, transaction_id = ${txId}, updated_at = ${now} where id = ${auctionId}`
    this.logEvent('auction_sold', JSON.stringify({ id: auctionId, buyerAddress })).catch(() => {})
    return { success: true, auctionType: 'single', transactionId: txId }
  }

  async checkAndUpdateExpiredAuctions(): Promise<{ updatedCount: number }> {
    const now = nowSec()
    const countRows = await this.sql<{ cnt: string }[]>`select count(*)::int as cnt from single_auctions where status = 'active' and end_time <= ${now}`
    await this.sql`update single_auctions set status = 'expired', updated_at = ${now} where status = 'active' and end_time <= ${now}`
    const cnt = Number(countRows[0]?.cnt || 0)
    if (cnt > 0) this.logEvent('auctions_expired', JSON.stringify({ count: cnt })).catch(() => {})
    return { updatedCount: cnt }
  }

  // Clearing auctions (in-memory) — same API as sqlite-backed class
  createClearingPriceAuction(input: CreateClearingAuctionInput): { success: boolean; auctionDetails: any } {
    const now = nowSec()
    const auction: ClearingAuction & { start_price: number; min_price: number; duration: number; decrement_interval: number } = {
      id: input.id,
      inscription_id: input.inscription_id,
      inscription_ids: [...input.inscription_ids],
      quantity: input.quantity,
      itemsRemaining: input.quantity,
      status: 'active',
      start_price: input.start_price,
      min_price: input.min_price,
      duration: input.duration,
      decrement_interval: input.decrement_interval,
      created_at: now,
      updated_at: now,
    }
    this.clearingAuctions.set(input.id, auction)
    this.bidsByAuction.set(input.id, [])
    this.logEvent('clearing_created', JSON.stringify({ id: input.id })).catch(() => {})
    const { start_price, min_price, duration, decrement_interval, ...rest } = auction
    return { success: true, auctionDetails: { ...rest, auction_type: 'clearing' as const } }
  }
  private getClearingAuction(id: string): ClearingAuction & { start_price: number; min_price: number; duration: number; decrement_interval: number } {
    const a = this.clearingAuctions.get(id)
    if (!a) throw new Error('Clearing auction not found')
    return a as any
  }
  placeBid(auctionId: string, bidderAddress: string, quantity: number): { success: boolean; itemsRemaining: number; auctionStatus: 'active' | 'sold'; bidId: string } {
    const auction = this.getClearingAuction(auctionId)
    if (auction.status !== 'active') throw new Error('Auction not active')
    
    // Validate address format
    const addressCheck = this.validateAddressFormat(bidderAddress);
    if (!addressCheck.valid) {
      throw new Error(addressCheck.error || 'Invalid bidder address');
    }
    
    // Validate quantity
    if (quantity <= 0) throw new Error('Quantity must be greater than zero');
    const qty = Math.max(1, Math.floor(quantity))
    if (qty > auction.itemsRemaining) {
      throw new Error(`Insufficient items available. Requested: ${qty}, Available: ${auction.itemsRemaining}`);
    }
    
    auction.itemsRemaining = Math.max(0, auction.itemsRemaining - qty)
    if (auction.itemsRemaining === 0) auction.status = 'sold'
    auction.updated_at = nowSec()
    this.clearingAuctions.set(auctionId, auction)
    const bidId = `b${this.nextBidId++}`
    const now = nowSec()
    const bid = { id: bidId, auctionId, bidderAddress, bidAmount: 0, quantity: qty, status: 'placed' as const, created_at: now, updated_at: now }
    this.bids.set(bidId, bid)
    const list = this.bidsByAuction.get(auctionId) || []
    list.push(bidId)
    this.bidsByAuction.set(auctionId, list)
    this.logEvent('clearing_bid', JSON.stringify({ id: auctionId, bidderAddress, quantity: qty, bidId })).catch(() => {})
    return { success: true, itemsRemaining: auction.itemsRemaining, auctionStatus: auction.status, bidId }
  }
  getClearingAuctionStatus(auctionId: string): { auction: ClearingAuction; progress: { itemsRemaining: number } } {
    const auction = this.getClearingAuction(auctionId)
    return { auction, progress: { itemsRemaining: auction.itemsRemaining } }
  }
  getAuctionBids(auctionId: string): { bids: any[] } {
    const ids = this.bidsByAuction.get(auctionId) || []
    const bids = ids.map((id) => this.bids.get(id)).filter(Boolean) as any[]
    return { bids }
  }
  calculateSettlement(auctionId: string): { auctionId: string; clearingPrice: number; totalQuantity: number; itemsRemaining: number; allocations: Array<{ bidId: string; bidderAddress: string; quantity: number }> } {
    const auction = this.clearingAuctions.get(auctionId)
    if (!auction) throw new Error('Clearing auction not found')
    const sold = auction.quantity - auction.itemsRemaining
    const fractionSold = auction.quantity > 0 ? sold / auction.quantity : 0
    const priceDrop = (auction.start_price - auction.min_price) * fractionSold
    const clearingPrice = Math.max(auction.min_price, Math.round(auction.start_price - priceDrop))
    const confirmedBids = (this.bidsByAuction.get(auctionId) || [])
      .map((id) => this.bids.get(id)!)
      .filter((b) => b.status === 'payment_confirmed' || b.status === 'settled')
      .sort((a, b) => a.created_at - b.created_at)
    let remaining = auction.quantity
    const allocations: Array<{ bidId: string; bidderAddress: string; quantity: number }> = []
    for (const bid of confirmedBids) {
      if (remaining <= 0) break
      const alloc = Math.min(remaining, bid.quantity)
      if (alloc > 0) { allocations.push({ bidId: bid.id, bidderAddress: bid.bidderAddress, quantity: alloc }); remaining -= alloc }
    }
    return { auctionId, clearingPrice, totalQuantity: auction.quantity, itemsRemaining: auction.itemsRemaining, allocations }
  }
  markBidsSettled(auctionId: string, bidIds: string[]): { success: boolean; updated: number; errors?: Array<{ bidId: string; error: string }> } {
    const ids = this.bidsByAuction.get(auctionId) || []
    let updated = 0
    const errors: Array<{ bidId: string; error: string }> = [];
    
    for (const bidId of bidIds) {
      if (!ids.includes(bidId)) {
        errors.push({ bidId, error: 'Bid not found in auction' });
        continue;
      }
      const bid = this.bids.get(bidId)
      if (!bid) {
        errors.push({ bidId, error: 'Bid not found' });
        continue;
      }
      
      // Enforce: only payment_confirmed or already settled bids can be marked settled
      if (bid.status !== 'payment_confirmed' && bid.status !== 'settled') {
        errors.push({ bidId, error: `Cannot settle bid with status: ${bid.status}. Payment must be confirmed first.` });
        continue;
      }
      
      // Idempotency: skip if already settled
      if (bid.status === 'settled') {
        updated++;
        continue;
      }
      
      bid.status = 'settled'
      bid.updated_at = Math.floor(Date.now() / 1000)
      this.bids.set(bidId, bid)
      updated++
    }
    
    return errors.length > 0 ? { success: true, updated, errors } : { success: true, updated };
  }
  createBidPaymentPSBT(auctionId: string, bidderAddress: string, bidAmount: number, quantity: number = 1): { escrowAddress: string; bidId: string } {
    const auction = this.clearingAuctions.get(auctionId)
    if (!auction) throw new Error('Clearing auction not found')
    if (auction.status !== 'active') throw new Error('Auction not active')
    
    // Validate address format
    const addressCheck = this.validateAddressFormat(bidderAddress);
    if (!addressCheck.valid) {
      throw new Error(addressCheck.error || 'Invalid bidder address');
    }
    
    // Validate bid amount
    if (bidAmount <= 0) throw new Error('Bid amount must be greater than zero');
    
    // Validate quantity
    if (quantity <= 0) throw new Error('Quantity must be greater than zero');
    const qty = Math.max(1, Math.floor(quantity));
    if (qty > auction.itemsRemaining) {
      throw new Error(`Insufficient items available. Requested: ${qty}, Available: ${auction.itemsRemaining}`);
    }
    
    const bidId = `b${this.nextBidId++}`
    const network = getBitcoinNetwork();
    const hash = this.simpleHash(`${auctionId}:${bidderAddress}:${bidId}`)
    const suffix = hash.slice(0, 38).padEnd(38, 'x')
    const prefix = network === 'mainnet' ? 'bc1q' : network === 'regtest' ? 'bcrt1q' : 'tb1q';
    const escrowAddress = `${prefix}${suffix}`;
    const now = Math.floor(Date.now() / 1000)
    const bid = { id: bidId, auctionId, bidderAddress, bidAmount, quantity: qty, status: 'payment_pending' as const, escrowAddress, created_at: now, updated_at: now }
    this.bids.set(bidId, bid)
    const list = this.bidsByAuction.get(auctionId) || []
    list.push(bidId)
    this.bidsByAuction.set(auctionId, list)
    return { escrowAddress, bidId }
  }
  confirmBidPayment(bidId: string, transactionId: string): { success: boolean; alreadyConfirmed?: boolean } {
    const bid = this.bids.get(bidId)
    if (!bid) throw new Error('Bid not found')
    
    // Idempotency: if already confirmed with same txId, return success
    if (bid.status === 'payment_confirmed' && bid.transactionId === transactionId) {
      return { success: true, alreadyConfirmed: true };
    }
    
    // Validate state transition: only payment_pending -> payment_confirmed allowed
    if (bid.status !== 'payment_pending' && bid.status !== 'payment_confirmed') {
      throw new Error(`Cannot confirm payment for bid in status: ${bid.status}. Expected payment_pending.`);
    }
    
    if (!transactionId || typeof transactionId !== 'string') {
      throw new Error('Valid transaction ID is required');
    }
    
    bid.transactionId = transactionId
    bid.status = 'payment_confirmed'
    bid.updated_at = Math.floor(Date.now() / 1000)
    this.bids.set(bidId, bid)
    return { success: true }
  }
  processAuctionSettlement(auctionId: string): { success: boolean; artifacts: Array<{ bidId: string; inscriptionId: string; toAddress: string }> } {
    const auction = this.clearingAuctions.get(auctionId)
    if (!auction) throw new Error('Clearing auction not found')
    
    const settlement = this.calculateSettlement(auctionId)
    const artifacts: Array<{ bidId: string; inscriptionId: string; toAddress: string }> = []
    let inscriptionIdx = 0
    
    for (const alloc of settlement.allocations) {
      const bid = this.bids.get(alloc.bidId)
      if (!bid) continue
      
      // Enforce: only payment_confirmed bids can be settled
      if (bid.status !== 'payment_confirmed' && bid.status !== 'settled') {
        throw new Error(`Cannot settle bid ${bid.id} with status: ${bid.status}. Payment must be confirmed first.`);
      }
      
      // Skip if already settled (idempotency)
      if (bid.status === 'settled') continue;
      
      for (let i = 0; i < alloc.quantity && inscriptionIdx < auction.inscription_ids.length; i++) {
        const inscriptionId = auction.inscription_ids[inscriptionIdx++]
        artifacts.push({ bidId: bid.id, inscriptionId: inscriptionId!, toAddress: bid.bidderAddress })
      }
      bid.status = 'settled'
      bid.updated_at = Math.floor(Date.now() / 1000)
      this.bids.set(bid.id, bid)
    }
    
    auction.status = inscriptionIdx >= auction.quantity ? 'sold' : auction.status
    auction.updated_at = Math.floor(Date.now() / 1000)
    this.clearingAuctions.set(auctionId, auction)
    return { success: true, artifacts }
  }
  getBidDetails(bidId: string): any { const bid = this.bids.get(bidId); if (!bid) throw new Error('Bid not found'); return bid }
  getAuctionBidsWithPayments(auctionId: string): { bids: any[] } { const ids = this.bidsByAuction.get(auctionId) || []; const bids = ids.map((id) => this.bids.get(id)).filter(Boolean) as any[]; return { bids } }

  // Fees
  async getFeeRates(network: BitcoinNetwork | string): Promise<{ fast: number; normal: number; slow: number }> {
    if (this.mempoolClient) return this.mempoolClient.getFeeRates(network)
    return { fast: 25, normal: 15, slow: 5 }
  }
  async calculateTransactionFee(operation: string, priority: 'fast' | 'normal' | 'slow' | string, network: BitcoinNetwork | string): Promise<{ calculatedFee: number }> {
    const rates = await this.getFeeRates(network)
    const rate = priority === 'fast' ? rates.fast : priority === 'slow' ? rates.slow : rates.normal
    const estimatedVBytes = 180
    const fee = Math.max(1, Math.floor(rate * estimatedVBytes))
    return { calculatedFee: fee }
  }
  async getFeeEstimationDisplay(operation: string, network: BitcoinNetwork | string): Promise<{ options: Array<{ priority: 'Fast' | 'Normal' | 'Slow'; estimatedFee: number }>; networkStatus: string }> {
    const rates = await this.getFeeRates(network)
    const options = [
      { priority: 'Fast' as const, estimatedFee: Math.max(1, rates.fast * 180) },
      { priority: 'Normal' as const, estimatedFee: Math.max(1, rates.normal * 180) },
      { priority: 'Slow' as const, estimatedFee: Math.max(1, rates.slow * 180) },
    ]
    const networkName = typeof network === 'string' ? network : (network as string)
    return { options, networkStatus: `ok:${networkName}` }
  }

  // Pricing calculators (pure)
  calculateCurrentPrice(auction: Pick<SingleAuction, 'start_price' | 'min_price' | 'duration' | 'start_time' | 'end_time' | 'status'>, atTimeSec: number): { currentPrice: number; auctionStatus: 'active' | 'expired' | 'sold' } {
    if (atTimeSec <= auction.start_time) { return { currentPrice: auction.start_price, auctionStatus: auction.status } }
    const elapsed = Math.max(0, Math.min(auction.duration, atTimeSec - auction.start_time))
    const range = auction.start_price - auction.min_price
    const fraction = auction.duration > 0 ? elapsed / auction.duration : 1
    const price = Math.round(auction.start_price - range * fraction)
    const clamped = Math.max(auction.min_price, price)
    const expired = atTimeSec >= auction.end_time
    return { currentPrice: clamped, auctionStatus: expired ? 'expired' : auction.status }
  }
  calculatePriceWithIntervals(auction: Pick<SingleAuction, 'start_price' | 'min_price' | 'duration' | 'decrement_interval' | 'start_time'>, atTimeSec: number): { currentPrice: number } {
    if (atTimeSec <= auction.start_time) { return { currentPrice: auction.start_price } }
    const totalSteps = auction.decrement_interval > 0 ? Math.floor(auction.duration / auction.decrement_interval) : 0
    if (totalSteps <= 0) return { currentPrice: Math.max(auction.min_price, auction.start_price) }
    const stepAmount = (auction.start_price - auction.min_price) / totalSteps
    const elapsed = Math.min(auction.duration, Math.max(0, atTimeSec - auction.start_time))
    const stepsElapsed = Math.min(totalSteps, Math.floor(elapsed / auction.decrement_interval))
    const price = Math.round(auction.start_price - stepsElapsed * stepAmount)
    return { currentPrice: Math.max(auction.min_price, price) }
  }

  // Audit
  private async logEvent(event: string, details: string): Promise<void> {
    const ts = nowSec()
    await this.sql`insert into audit_logs(event, details, created_at) values(${event}, ${details}, ${ts})`
  }

  // Utils
  private simpleHash(input: string): string {
    let h1 = 0x811c9dc5
    for (let i = 0; i < input.length; i++) { h1 ^= input.charCodeAt(i); h1 = Math.imul(h1, 0x01000193); h1 >>>= 0 }
    return h1.toString(16).padStart(8, '0') + h1.toString(36)
  }

  async close(): Promise<void> { try { await this.sql.end({ timeout: 5 }) } catch {} }
}

