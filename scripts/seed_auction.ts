import { db } from '@originals/dutch'

async function main() {
  const now = Math.floor(Date.now() / 1000)
  const auctionId = 'auc_seed_1'
  
  // Get encryption password from environment or use default
  const encryptionPassword = process.env.AUCTION_ENCRYPTION_PASSWORD || process.env.ENCRYPTION_PASSWORD || 'changeit'
  
  // Generate a proper key pair and encrypt it
  const { keyPair, address } = await db.generateAuctionKeyPair(auctionId, { password: encryptionPassword })
  const encryptedPrivateKey = await db.encryptUtf8(keyPair.privateKeyHex, encryptionPassword)
  
  const auction = {
    id: auctionId,
    inscription_id: '0'.repeat(64) + 'i0',
    start_price: 100000,
    min_price: 10000,
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
  await db.storeAuction(auction as any, encryptedPrivateKey)
  console.log('Seeded auction', auction.id, 'with address', address)
  console.log('Private key encrypted and stored securely')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

