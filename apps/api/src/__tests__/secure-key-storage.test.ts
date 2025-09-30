import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { SecureDutchyDatabase } from '@originals/dutch'

describe('Secure private key handling in auction creation', () => {
  let db: SecureDutchyDatabase
  const testPassword = 'test-secure-password-123'

  beforeAll(() => {
    process.env.BITCOIN_NETWORK = 'testnet'
    db = new SecureDutchyDatabase(':memory:')
  })

  afterAll(() => {
    db.close()
  })

  it('encrypts private keys using AES-256-GCM, not symbolic placeholders', async () => {
    const auctionId = 'test-auction-1'
    
    // Generate a key pair
    const { keyPair, address } = await db.generateAuctionKeyPair(auctionId, { password: testPassword })
    
    // Encrypt the private key (this is what the API should do)
    const encryptedPrivateKey = await db.encryptUtf8(keyPair.privateKeyHex, testPassword)
    
    // Verify it's actually encrypted (JSON with crypto parameters, not just prefixed plaintext)
    expect(encryptedPrivateKey).toContain('"alg":"AES-256-GCM"')
    expect(encryptedPrivateKey).toContain('"kdf":"PBKDF2-SHA256"')
    expect(encryptedPrivateKey).toContain('"iv":')
    expect(encryptedPrivateKey).toContain('"salt":')
    expect(encryptedPrivateKey).toContain('"ct":')
    
    // Verify it does NOT contain the plaintext private key
    expect(encryptedPrivateKey).not.toContain(keyPair.privateKeyHex)
    
    // Verify it does NOT start with 'enc_' symbolic prefix
    expect(encryptedPrivateKey.startsWith('enc_')).toBe(false)
    
    // Store auction with encrypted key
    const now = Math.floor(Date.now() / 1000)
    const auction = {
      id: auctionId,
      inscription_id: 'test-inscription-id',
      start_price: 100000,
      min_price: 50000,
      current_price: 100000,
      duration: 3600,
      decrement_interval: 60,
      start_time: now,
      end_time: now + 3600,
      status: 'active' as const,
      auction_address: address,
      created_at: now,
      updated_at: now,
    }
    
    await db.storeAuction(auction, encryptedPrivateKey)
    
    // Retrieve and verify
    const retrieved = db.getAuction(auctionId)
    expect(retrieved).toBeDefined()
    expect(retrieved?.encrypted_private_key).toBe(encryptedPrivateKey)
    expect(retrieved?.encrypted_private_key).not.toContain(keyPair.privateKeyHex)
  })

  it('successfully decrypts the encrypted private key', async () => {
    const auctionId = 'test-auction-2'
    const { keyPair, address } = await db.generateAuctionKeyPair(auctionId, { password: testPassword })
    
    // Encrypt
    const encryptedPrivateKey = await db.encryptUtf8(keyPair.privateKeyHex, testPassword)
    
    // Decrypt and verify round-trip
    const decryptedPrivateKey = await db.decryptToUtf8(encryptedPrivateKey, testPassword)
    expect(decryptedPrivateKey).toBe(keyPair.privateKeyHex)
    
    // Store in database
    const now = Math.floor(Date.now() / 1000)
    await db.storeAuction({
      id: auctionId,
      inscription_id: 'test-inscription-2',
      start_price: 100000,
      min_price: 50000,
      current_price: 100000,
      duration: 3600,
      decrement_interval: 60,
      start_time: now,
      end_time: now + 3600,
      status: 'active' as const,
      auction_address: address,
      created_at: now,
      updated_at: now,
    }, encryptedPrivateKey)
    
    // Retrieve from database and decrypt
    const retrieved = db.getAuction(auctionId)
    expect(retrieved?.encrypted_private_key).toBeDefined()
    const decryptedFromDb = await db.decryptToUtf8(retrieved!.encrypted_private_key!, testPassword)
    expect(decryptedFromDb).toBe(keyPair.privateKeyHex)
  })

  it('fails to decrypt with wrong password', async () => {
    const auctionId = 'test-auction-3'
    const { keyPair } = await db.generateAuctionKeyPair(auctionId, { password: testPassword })
    
    const encryptedPrivateKey = await db.encryptUtf8(keyPair.privateKeyHex, testPassword)
    
    // Attempt to decrypt with wrong password should throw
    let threw = false
    try {
      await db.decryptToUtf8(encryptedPrivateKey, 'wrong-password')
    } catch (error) {
      threw = true
    }
    expect(threw).toBe(true)
  })

  it('produces different ciphertext for same plaintext (due to random IV and salt)', async () => {
    const plaintext = 'test-private-key-hex'
    
    const encrypted1 = await db.encryptUtf8(plaintext, testPassword)
    const encrypted2 = await db.encryptUtf8(plaintext, testPassword)
    
    // Different encrypted outputs (due to random IV and salt)
    expect(encrypted1).not.toBe(encrypted2)
    
    // But both decrypt to same plaintext
    const decrypted1 = await db.decryptToUtf8(encrypted1, testPassword)
    const decrypted2 = await db.decryptToUtf8(encrypted2, testPassword)
    expect(decrypted1).toBe(plaintext)
    expect(decrypted2).toBe(plaintext)
  })

  it('encrypted payload contains no plaintext key material', async () => {
    const { keyPair } = await db.generateAuctionKeyPair('test-check-leak', { password: testPassword })
    const encryptedPrivateKey = await db.encryptUtf8(keyPair.privateKeyHex, testPassword)
    
    // Parse the encrypted payload
    const payload = JSON.parse(encryptedPrivateKey)
    
    // Verify structure
    expect(payload.alg).toBe('AES-256-GCM')
    expect(payload.kdf).toBe('PBKDF2-SHA256')
    expect(payload.iter).toBe(100000)
    expect(typeof payload.iv).toBe('string')
    expect(typeof payload.salt).toBe('string')
    expect(typeof payload.ct).toBe('string')
    
    // Verify no plaintext leaks in any field
    expect(payload.iv).not.toContain(keyPair.privateKeyHex)
    expect(payload.salt).not.toContain(keyPair.privateKeyHex)
    expect(payload.ct).not.toContain(keyPair.privateKeyHex)
    
    // The base64 encoded ciphertext should not contain recognizable hex patterns
    const ctDecoded = atob(payload.ct)
    expect(ctDecoded).not.toContain(keyPair.privateKeyHex)
  })
})