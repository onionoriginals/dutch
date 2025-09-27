import { Elysia, t } from 'elysia'
import { swagger } from '@elysiajs/swagger'
import { cors } from '@elysiajs/cors'
import { db, getBitcoinNetwork, version } from '@originals/dutch'

function withNetworkOverride<T>(networkParam: string | undefined, handler: () => T): T {
  const original = (globalThis as any).process?.env?.BITCOIN_NETWORK
  if (networkParam) (globalThis as any).process.env.BITCOIN_NETWORK = String(networkParam)
  try {
    return handler()
  } finally {
    if (networkParam) (globalThis as any).process.env.BITCOIN_NETWORK = original
  }
}

export function createApp() {
  const app = new Elysia()
    .use(cors())
    .use(swagger())
    // Health and root
    .get('/', ({ query }) =>
      withNetworkOverride(query?.network as any, () => ({
        ok: true,
        network: getBitcoinNetwork(),
        version,
      })),
      {
        query: t.Object({ network: t.Optional(t.String()) }),
      },
    )
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

  return app
}

if (import.meta.main) {
  const app = createApp()
  const hostname = Bun.env.HOST ?? '::'
  let port = Bun.env.PORT ? parseInt(Bun.env.PORT, 10) : 3000
  if (isNaN(port)) {
    console.error('Invalid PORT environment variable. Using default port 3000.')
    port = 3000
  }
  const server = app.listen({ port, hostname })
  const advertisedHost = hostname === '::' ? '[::1]' : hostname
  console.log(`API listening on http://${advertisedHost}:${(server as any)?.server?.port ?? port}`)
}
