import { db } from '@originals/dutch'

async function main() {
  const now = Math.floor(Date.now() / 1000)
  const auction = {
    id: 'auc_seed_1',
    inscription_id: '0'.repeat(64) + 'i0',
    start_price: 100000,
    min_price: 10000,
    current_price: 100000,
    duration: 3600,
    decrement_interval: 60,
    start_time: now,
    end_time: now + 3600,
    status: 'active' as const,
    auction_address: 'tb1qseedaddressxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    created_at: now,
    updated_at: now,
  }
  await db.storeAuction(auction as any, 'enc_seed_dummy')
  console.log('Seeded auction', auction.id)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

