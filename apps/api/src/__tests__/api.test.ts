import { expect, test, beforeAll, afterAll, describe } from 'bun:test'
import { createApp } from '../index'
import { db } from '@originals/dutch'

let baseURL: string
let close: (() => void) | undefined

function startServer() {
  const app = createApp()
  const server = app.listen({ port: 0, hostname: '127.0.0.1' })
  const port = (server as any)?.server?.port ?? 0
  baseURL = `http://127.0.0.1:${port}`
  close = () => server.stop()
}

function nowSec() {
  return Math.floor(Date.now() / 1000)
}

beforeAll(() => {
  ;(globalThis as any).process ||= { env: {} as any }
  ;(globalThis as any).process.env.BITCOIN_NETWORK = 'mainnet'
  // reset and seed database
  ;(db as any).reset?.()
  const t0 = nowSec()
  // Active single auction
  db.storeAuction(
    {
      id: 'a1',
      inscription_id: 'insc1',
      start_price: 1000,
      min_price: 100,
      current_price: 1000,
      duration: 600,
      decrement_interval: 60,
      start_time: t0 - 120,
      end_time: t0 + 480,
      status: 'active',
      auction_address: 'tb1qexampleaddress1',
      created_at: t0 - 130,
      updated_at: t0 - 120,
    },
    'enc_key_1',
  )

  // Expired single auction
  db.storeAuction(
    {
      id: 'a2',
      inscription_id: 'insc2',
      start_price: 2000,
      min_price: 200,
      current_price: 2000,
      duration: 60,
      decrement_interval: 10,
      start_time: t0 - 600,
      end_time: t0 - 540,
      status: 'active',
      auction_address: 'tb1qexampleaddress2',
      created_at: t0 - 650,
      updated_at: t0 - 600,
    },
    'enc_key_2',
  )

  // Clearing auction
  db.createClearingPriceAuction({
    id: 'c1',
    inscription_id: 'inscClearing',
    inscription_ids: ['x1', 'x2', 'x3'],
    quantity: 3,
    start_price: 3000,
    min_price: 300,
    duration: 900,
    decrement_interval: 30,
    seller_address: 'tb1qseller',
  })

  startServer()
})

afterAll(() => {
  if (close) close()
})

describe('health endpoints', () => {
  test('GET /health returns ok and counts', async () => {
    const res = await fetch(`${baseURL}/health`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.version).toBeDefined()
    expect(body.counts.total).toBeGreaterThan(0)
  })

  test('network override with query param', async () => {
    const res = await fetch(`${baseURL}/?network=regtest`)
    const body = await res.json()
    expect(body.network).toBe('regtest')
    // env should remain mainnet after request
    expect((globalThis as any).process.env.BITCOIN_NETWORK).toBe('mainnet')
  })
})

describe('listings and filters', () => {
  test('GET /auctions returns array', async () => {
    const res = await fetch(`${baseURL}/auctions`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.items.length).toBeGreaterThan(0)
  })

  test('filter by status', async () => {
    const res = await fetch(`${baseURL}/auctions?status=active`)
    const body = await res.json()
    expect(body.items.every((i: any) => i.status === 'active')).toBe(true)
  })

  test('filter by type=clearing', async () => {
    const res = await fetch(`${baseURL}/auctions?type=clearing`)
    const body = await res.json()
    expect(body.items.every((i: any) => i.auction_type === 'clearing')).toBe(true)
  })
})

describe('pricing endpoints and expiration', () => {
  test('GET /auction/:id returns details and pricing', async () => {
    const res = await fetch(`${baseURL}/auction/a1`)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.auction.id).toBe('a1')
    expect(body.pricing.currentPriceLinear).toBeGreaterThan(0)
  })

  test('GET /price/:id marks expired if past end_time', async () => {
    // a2 was in the past and should be expired by calling price
    const res = await fetch(`${baseURL}/price/a2`)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.status).toBe('expired')
    // follow-up: details reflect expired
    const res2 = await fetch(`${baseURL}/auction/a2`)
    const body2 = await res2.json()
    expect(body2.auction.status).toBe('expired')
  })

  test('GET /price/:id/stepped returns stepped price', async () => {
    const res = await fetch(`${baseURL}/price/a1/stepped`)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.price).toBeGreaterThan(0)
  })
})

describe('manual status updates', () => {
  test('reject invalid status', async () => {
    const res = await fetch(`${baseURL}/auction/a1/status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'invalid' }),
    })
    const body = await res.json()
    expect(body.ok).toBe(false)
  })

  test('accept valid status', async () => {
    const res = await fetch(`${baseURL}/auction/a1/status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'sold' }),
    })
    const body = await res.json()
    expect(body.ok).toBe(true)
    const res2 = await fetch(`${baseURL}/auction/a1`)
    const body2 = await res2.json()
    expect(body2.auction.status).toBe('sold')
  })
})

