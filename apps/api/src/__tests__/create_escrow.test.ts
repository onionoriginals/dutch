import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { app } from '../../src/index'

function mockFetchSequence(cases: Array<{ urlIncludes: string; ok: boolean; json: any }>) {
  const original = globalThis.fetch
  globalThis.fetch = (async (input: any, init?: any) => {
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

describe('auction creation and inscription escrow endpoints', () => {
  let restoreFetch: () => void

  afterAll(() => {
    if (restoreFetch) restoreFetch()
  })

  it('returns 400 on invalid inscription format', async () => {
    const res = await app.handle(new Request('http://localhost/create-auction', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        asset: 'badformat',
        startPrice: 1000,
        minPrice: 100,
        duration: 60,
        decrementInterval: 10,
        sellerAddress: 'tb1qseller'
      })
    }))
    expect(res.status).toBe(400)
  })

  it('creates auction and returns psbt, then escrow status flows', async () => {
    const txid = 'a'.repeat(64)
    const vout = 1
    const sellerAddress = 'tb1qselleraddress0000000000000000000000'
    restoreFetch = mockFetchSequence([
      {
        urlIncludes: `/tx/${txid}`,
        ok: true,
        json: {
          vout: [
            { scriptpubkey_address: 'tb1qother', value: 12345, scriptpubkey: '0014deadbeef' },
            { scriptpubkey_address: sellerAddress, value: 10000, scriptpubkey: '0014cafebabe' }
          ]
        }
      },
      {
        urlIncludes: `/tx/${txid}/outspends`,
        ok: true,
        json: [ { spent: false }, { spent: false } ]
      }
    ])

    // Create auction
    const res = await app.handle(new Request('http://localhost/create-auction', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        asset: `${txid}i${vout}`,
        startPrice: 1000,
        minPrice: 100,
        duration: 60,
        decrementInterval: 10,
        sellerAddress,
      })
    }))
    expect(res.status).toBe(200)
    const json = await res.json() as any
    expect(json.id).toBeTruthy()
    expect(json.address).toMatch(/^tb1q/)
    expect(json.psbt).toMatch(/^cHNidP/)
    expect(json.inscriptionInfo.vout).toBe(vout)

    const auctionId = json.id

    // Escrow verification
    const verifyRes = await app.handle(new Request('http://localhost/escrow/verify-ownership', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ inscriptionId: `${txid}i${vout}`, ownerAddress: sellerAddress })
    }))
    expect(verifyRes.status).toBe(200)
    const verify = await verifyRes.json() as any
    expect(verify.valid).toBeTrue()

    // Create escrow PSBT
    const escrowRes = await app.handle(new Request('http://localhost/escrow/create-psbt', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ auctionId, inscriptionId: `${txid}i${vout}`, ownerAddress: sellerAddress })
    }))
    expect(escrowRes.status).toBe(200)
    const escrow = await escrowRes.json() as any
    expect(typeof escrow.psbt).toBe('string')

    // Monitor
    const monitorRes = await app.handle(new Request(`http://localhost/escrow/monitor/${encodeURIComponent(auctionId)}/${txid}i${vout}`))
    expect(monitorRes.status).toBe(200)
    const monitor = await monitorRes.json() as any
    expect(monitor.status).toBeDefined()

    // Update status
    const updRes = await app.handle(new Request('http://localhost/escrow/update-status', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ auctionId, status: 'confirmed', details: { txid: 'tx123' } })
    }))
    expect(updRes.status).toBe(200)
    const upd = await updRes.json() as any
    expect(upd.ok).toBeTrue()

    // Get status
    const statusRes = await app.handle(new Request(`http://localhost/escrow/status/${encodeURIComponent(auctionId)}`))
    expect(statusRes.status).toBe(200)
    const status = await statusRes.json() as any
    expect(status.status).toBe('confirmed')

    // Check timeouts (no change expected immediately)
    const chkRes = await app.handle(new Request('http://localhost/admin/check-escrow-timeouts', { method: 'POST' }))
    expect(chkRes.status).toBe(200)
    const chk = await chkRes.json() as any
    expect(typeof chk.updated).toBe('number')
  })

  it('fails when ownership mismatch or spent', async () => {
    const txid = 'b'.repeat(64)
    const vout = 0
    const sellerAddress = 'tb1qselleraddress0000000000000000000000'
    // First: ownership mismatch
    let restore = mockFetchSequence([
      {
        urlIncludes: `/tx/${txid}`,
        ok: true,
        json: { vout: [ { scriptpubkey_address: 'tb1qother', value: 5000, scriptpubkey: '0014aaaa' } ] }
      },
      {
        urlIncludes: `/tx/${txid}/outspends`,
        ok: true,
        json: [ { spent: false } ]
      }
    ])
    let res = await app.handle(new Request('http://localhost/create-auction', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ asset: `${txid}i${vout}`, startPrice: 1000, minPrice: 100, duration: 60, decrementInterval: 10, sellerAddress })
    }))
    expect(res.status).toBe(403)
    restore()

    // Second: spent
    restore = mockFetchSequence([
      {
        urlIncludes: `/tx/${txid}`,
        ok: true,
        json: { vout: [ { scriptpubkey_address: sellerAddress, value: 5000, scriptpubkey: '0014bbbb' } ] }
      },
      {
        urlIncludes: `/tx/${txid}/outspends`,
        ok: true,
        json: [ { spent: true } ]
      }
    ])
    res = await app.handle(new Request('http://localhost/create-auction', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ asset: `${txid}i${vout}`, startPrice: 1000, minPrice: 100, duration: 60, decrementInterval: 10, sellerAddress })
    }))
    expect(res.status).toBe(403)
    restore()
  })
})

