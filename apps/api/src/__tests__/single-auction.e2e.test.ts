import { beforeAll, expect, test, describe } from 'bun:test'
import { createApp } from '../index'

let app: ReturnType<typeof createApp>

beforeAll(() => {
  ;(globalThis as any).process ||= { env: {} as any }
  ;(globalThis as any).process.env.BITCOIN_NETWORK = 'regtest'
  app = createApp()
})

function mockFetchSequence(cases: Array<{ urlIncludes: string; ok: boolean; json: any }>) {
  const original = globalThis.fetch
  globalThis.fetch = (async (input: any) => {
    const url = typeof input === 'string' ? input : String(input?.url || '')
    const found = cases
      .filter(c => url.includes(c.urlIncludes))
      .sort((a, b) => b.urlIncludes.length - a.urlIncludes.length)[0]
    if (found) {
      return new Response(JSON.stringify(found.json), { status: found.ok ? 200 : 404 }) as any
    }
    return new Response(JSON.stringify({}), { status: 404 }) as any
  }) as any
  return () => {
    globalThis.fetch = original
  }
}

describe('Single auction lifecycle', () => {
  test('create -> get auction -> get price', async () => {
    const txid = 'c'.repeat(64)
    const vout = 2
    const sellerAddress = 'tb1qselleraddress0000000000000000000000'
    const restore = mockFetchSequence([
      {
        urlIncludes: `/tx/${txid}`,
        ok: true,
        json: {
          vout: [
            { scriptpubkey_address: 'tb1qother', value: 1111, scriptpubkey: '0014dead' },
            { scriptpubkey_address: 'tb1qother2', value: 2222, scriptpubkey: '0014beef' },
            { scriptpubkey_address: sellerAddress, value: 3333, scriptpubkey: '0014cafe' },
          ],
        },
      },
      { urlIncludes: `/tx/${txid}/outspends`, ok: true, json: [{ spent: false }, { spent: false }, { spent: false }] },
    ])

    // POST /create-auction
    const createRes = await app.handle(new Request('http://localhost/api/create-auction', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        asset: `${txid}i${vout}`,
        startPrice: 5000,
        minPrice: 1000,
        duration: 120,
        decrementInterval: 10,
        sellerAddress,
      }),
    }))
    expect(createRes.status).toBe(200)
    const created = (await createRes.json()) as any
    expect(created.id).toBeTruthy()
    const auctionId = created.id as string

    // GET /auction/:id
    const aRes = await app.handle(new Request(`http://localhost/api/auction/${encodeURIComponent(auctionId)}`))
    expect(aRes.status).toBe(200)
    const aJson = (await aRes.json()) as any
    expect(aJson.ok).toBe(true)
    expect(aJson.auction.id).toBe(auctionId)

    // GET /price/:id
    const pRes = await app.handle(new Request(`http://localhost/api/price/${encodeURIComponent(auctionId)}`))
    expect(pRes.status).toBe(200)
    const pJson = (await pRes.json()) as any
    expect(pJson.ok).toBe(true)
    expect(typeof pJson.price).toBe('number')

    restore()
  })
})

