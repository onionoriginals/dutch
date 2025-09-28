import { Elysia, t } from 'elysia'
import { swagger } from '@elysiajs/swagger'
import { cors } from '@elysiajs/cors'
import { db, getBitcoinNetwork, version, helloDutch, SecureDutchyDatabase } from '@originals/dutch'

function withNetworkOverride<T>(networkParam: string | undefined, handler: () => T): T {
  const original = (globalThis as any).process?.env?.BITCOIN_NETWORK
  if (networkParam) (globalThis as any).process.env.BITCOIN_NETWORK = String(networkParam)
  try {
    return handler()
  } finally {
    if (networkParam) (globalThis as any).process.env.BITCOIN_NETWORK = original
  }
}

export function createApp(dbInstance?: SecureDutchyDatabase) {
  const database = dbInstance ?? new SecureDutchyDatabase(':memory:')
  const app = new Elysia()
    .use(cors())
    .use(swagger())
    // Health and root
    .get('/', ({ query }) =>
      withNetworkOverride(query?.network as any, () => ({
        ok: true,
        network: getBitcoinNetwork?.(),
        version,
      })),
      {
        query: t.Object({ network: t.Optional(t.String()) }),
      },
    )
    .get('/hello', () => ({ message: helloDutch('World') }))
    .get('/health', ({ query }) =>
      withNetworkOverride(query?.network as any, () => {
        const auctions = db.listAuctions()
        const active = auctions.filter((a: any) => a.status === 'active').length
        const sold = auctions.filter((a: any) => a.status === 'sold').length
        const expired = auctions.filter((a: any) => a.status === 'expired').length
        return {
          ok: true,
          network: getBitcoinNetwork(),
          version,
          counts: { active, sold, expired, total: auctions.length },
        }
      }),
      {
        query: t.Object({ network: t.Optional(t.String()) }),
      },
    )
    // Listings
    .get(
      '/auctions',
      ({ query }) =>
        withNetworkOverride(query?.network as any, () => {
          const now = Math.floor(Date.now() / 1000)
          const list = db.listAuctions({
            status: (query.status as any) || undefined,
            type: (query.type as any) || undefined,
          })
          const enriched = list.map((a: any) => {
            if (a.auction_type === 'single') {
              const linear = db.calculateCurrentPrice(a, now)
              const stepped = db.calculatePriceWithIntervals(a, now)
              return {
                ...a,
                pricing: {
                  currentPriceLinear: linear.currentPrice,
                  currentPriceStepped: stepped.currentPrice,
                  at: now,
                },
              }
            }
            return { ...a, pricing: null }
          })
          return { ok: true, network: getBitcoinNetwork(), items: enriched }
        }),
      {
        query: t.Object({
          status: t.Optional(t.Union([t.Literal('active'), t.Literal('sold'), t.Literal('expired')])),
          type: t.Optional(t.Union([t.Literal('single'), t.Literal('clearing')])) ,
          network: t.Optional(t.String()),
        }),
      },
    )
    // Auction details
    .get('/auction/:auctionId', ({ params, query }) =>
      withNetworkOverride(query?.network as any, () => {
        const now = Math.floor(Date.now() / 1000)
        const a = db.getAuction(params.auctionId)
        if (a) {
          if (a.status === 'active' && a.end_time <= now) {
            db.updateAuctionStatus(a.id, 'expired')
            a.status = 'expired'
          }
          const linear = db.calculateCurrentPrice(a, now)
          const stepped = db.calculatePriceWithIntervals(a, now)
          return {
            ok: true,
            network: getBitcoinNetwork(),
            auction: { ...a, auction_type: 'single' as const },
            pricing: { currentPriceLinear: linear.currentPrice, currentPriceStepped: stepped.currentPrice, at: now },
          }
        }
        // Try clearing auction status
        try {
          const s = (db as any).getClearingAuctionStatus(params.auctionId)
          return { ok: true, network: getBitcoinNetwork(), auction: { ...s.auction, auction_type: 'clearing' as const }, pricing: null }
        } catch {
          return { ok: false, error: 'Auction not found' }
        }
      }),
      {
        params: t.Object({ auctionId: t.String() }),
        query: t.Object({ network: t.Optional(t.String()) }),
      },
    )
    // Pricing endpoints
    .get('/price/:auctionId', ({ params, query }) =>
      withNetworkOverride(query?.network as any, () => {
        const now = Math.floor(Date.now() / 1000)
        const a = db.getAuction(params.auctionId)
        if (!a) return { ok: false, error: 'Auction not found' }
        if (a.status === 'active' && a.end_time <= now) {
          db.updateAuctionStatus(a.id, 'expired')
          a.status = 'expired'
        }
        const linear = db.calculateCurrentPrice(a, now)
        return { ok: true, network: getBitcoinNetwork(), auctionId: a.id, price: linear.currentPrice, status: linear.auctionStatus, at: now }
      }),
      { params: t.Object({ auctionId: t.String() }), query: t.Object({ network: t.Optional(t.String()) }) },
    )
    .get('/price/:auctionId/stepped', ({ params, query }) =>
      withNetworkOverride(query?.network as any, () => {
        const now = Math.floor(Date.now() / 1000)
        const a = db.getAuction(params.auctionId)
        if (!a) return { ok: false, error: 'Auction not found' }
        if (a.status === 'active' && a.end_time <= now) {
          db.updateAuctionStatus(a.id, 'expired')
          a.status = 'expired'
        }
        const stepped = db.calculatePriceWithIntervals(a, now)
        return { ok: true, network: getBitcoinNetwork(), auctionId: a.id, price: stepped.currentPrice, status: a.status, at: now }
      }),
      { params: t.Object({ auctionId: t.String() }), query: t.Object({ network: t.Optional(t.String()) }) },
    )
    // Admin endpoints
    .post('/admin/check-expired', ({ query }) =>
      withNetworkOverride(query?.network as any, () => {
        const result = db.checkAndUpdateExpiredAuctions()
        return { ok: true, ...result, network: getBitcoinNetwork() }
      }),
      { query: t.Object({ network: t.Optional(t.String()) }) },
    )
    .post('/auction/:auctionId/status', ({ params, body, query }) =>
      withNetworkOverride(query?.network as any, () => {
        const allowed = ['active', 'sold', 'expired']
        if (!allowed.includes((body as any).status)) {
          return { ok: false, error: 'Invalid status' }
        }
        const res = db.updateAuctionStatus(params.auctionId, (body as any).status)
        if (!('success' in res) || !res.success) return { ok: false, error: 'Auction not found' }
        return { ok: true, auctionId: params.auctionId, newStatus: (body as any).status }
      }),
      { params: t.Object({ auctionId: t.String() }), body: t.Object({ status: t.String() }), query: t.Object({ network: t.Optional(t.String()) }) },
    )
    // Clearing price Dutch auction endpoints
    .post('/clearing/create-auction', async ({ body, set }) => {
      try {
        const {
          auctionId,
          inscriptionIds,
          quantity,
          startPrice,
          minPrice,
          duration,
          decrementInterval,
          sellerAddress,
        } = body as any
        if (!inscriptionIds || !Array.isArray(inscriptionIds) || inscriptionIds.length === 0) {
          set.status = 400
          return { error: 'inscriptionIds[] required' }
        }
        if (!quantity || !startPrice || !minPrice || !duration || !sellerAddress) {
          set.status = 400
          return { error: 'quantity, startPrice, minPrice, duration, sellerAddress required' }
        }
        const id = String(auctionId ?? `auc_${Date.now()}`)
        const input = {
          id,
          inscription_id: String(inscriptionIds[0]),
          inscription_ids: inscriptionIds.map(String),
          quantity: Number(quantity),
          start_price: Number(startPrice),
          min_price: Number(minPrice),
          duration: Number(duration),
          decrement_interval: Number(decrementInterval ?? 60),
          seller_address: String(sellerAddress),
        }
        const res = database.createClearingPriceAuction(input)
        return res
      } catch (err: any) {
        set.status = 500
        return { error: err?.message || 'internal_error' }
      }
    })
    .post('/clearing/place-bid', async ({ body, set }) => {
      try {
        const { auctionId, bidderAddress, quantity } = body as any
        if (!auctionId || !bidderAddress) {
          set.status = 400
          return { error: 'auctionId and bidderAddress required' }
        }
        const res = database.placeBid(String(auctionId), String(bidderAddress), Number(quantity ?? 1))
        return res
      } catch (err: any) {
        set.status = 500
        return { error: err?.message || 'internal_error' }
      }
    })
    .get('/clearing/status/:auctionId', ({ params, set }) => {
      try {
        return database.getClearingAuctionStatus(String(params.auctionId))
      } catch (err: any) {
        set.status = 404
        return { error: err?.message || 'not_found' }
      }
    })
    .get('/clearing/bids/:auctionId', ({ params, set }) => {
      try {
        return database.getAuctionBids(String(params.auctionId))
      } catch (err: any) {
        set.status = 404
        return { error: err?.message || 'not_found' }
      }
    })
    .get('/clearing/settlement/:auctionId', ({ params, set }) => {
      try {
        return database.calculateSettlement(String(params.auctionId))
      } catch (err: any) {
        set.status = 404
        return { error: err?.message || 'not_found' }
      }
    })
    .post('/clearing/mark-settled', ({ body, set }) => {
      try {
        const { auctionId, bidIds } = body as any
        if (!auctionId || !Array.isArray(bidIds)) {
          set.status = 400
          return { error: 'auctionId and bidIds[] required' }
        }
        return database.markBidsSettled(String(auctionId), bidIds.map(String))
      } catch (err: any) {
        set.status = 500
        return { error: err?.message || 'internal_error' }
      }
    })
    .post('/clearing/create-bid-payment', ({ body, set }) => {
      try {
        const { auctionId, bidderAddress, bidAmount, quantity } = body as any
        if (!auctionId || !bidderAddress || bidAmount == null) {
          set.status = 400
          return { error: 'auctionId, bidderAddress, bidAmount required' }
        }
        return database.createBidPaymentPSBT(String(auctionId), String(bidderAddress), Number(bidAmount), Number(quantity ?? 1))
      } catch (err: any) {
        set.status = 500
        return { error: err?.message || 'internal_error' }
      }
    })
    .post('/clearing/confirm-bid-payment', ({ body, set }) => {
      try {
        const { bidId, transactionId } = body as any
        if (!bidId || !transactionId) {
          set.status = 400
          return { error: 'bidId and transactionId required' }
        }
        return database.confirmBidPayment(String(bidId), String(transactionId))
      } catch (err: any) {
        set.status = 500
        return { error: err?.message || 'internal_error' }
      }
    })
    .post('/clearing/process-settlement', ({ body, set }) => {
      try {
        const { auctionId } = body as any
        if (!auctionId) {
          set.status = 400
          return { error: 'auctionId required' }
        }
        return database.processAuctionSettlement(String(auctionId))
      } catch (err: any) {
        set.status = 500
        return { error: err?.message || 'internal_error' }
      }
    })
    .get('/clearing/bid-payment-status/:bidId', ({ params, set }) => {
      try {
        return database.getBidDetails(String(params.bidId))
      } catch (err: any) {
        set.status = 404
        return { error: err?.message || 'not_found' }
      }
    })
    .get('/clearing/auction-payments/:auctionId', ({ params, set }) => {
      try {
        return database.getAuctionBidsWithPayments(String(params.auctionId))
      } catch (err: any) {
        set.status = 404
        return { error: err?.message || 'not_found' }
      }
    })
    // Demo helper
    .post('/demo/create-clearing-auction', ({ body }) => {
      const id = String((body as any)?.auctionId ?? `demo_${Date.now()}`)
      const inscriptionIds = (body as any)?.inscriptionIds ?? ['insc-0', 'insc-1', 'insc-2']
      return database.createClearingPriceAuction({
        id,
        inscription_id: String(inscriptionIds[0]),
        inscription_ids: inscriptionIds.map(String),
        quantity: Number((body as any)?.quantity ?? 3),
        start_price: Number((body as any)?.startPrice ?? 30000),
        min_price: Number((body as any)?.minPrice ?? 10000),
        duration: Number((body as any)?.duration ?? 3600),
        decrement_interval: Number((body as any)?.decrementInterval ?? 600),
        seller_address: String((body as any)?.sellerAddress ?? 'tb1p_seller'),
      })
    })

  return app
}

export const app = createApp()

if (import.meta.main) {
  const hostname = Bun.env.HOST ?? '::'
  let port = Bun.env.PORT ? parseInt(Bun.env.PORT, 10) : 3000
  if (isNaN(port)) {
    console.error('Invalid PORT environment variable. Using default port 3000.')
    port = 3000
  }
  app.listen({ port, hostname })
  const advertisedHost = hostname === '::' ? '[::1]' : hostname
  console.log(`API listening on http://${advertisedHost}:${port}`)
}
}
