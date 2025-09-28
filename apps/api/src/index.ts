import { Elysia, t } from 'elysia'
import { swagger } from '@elysiajs/swagger'
import { cors } from '@elysiajs/cors'
import { helloDutch } from '@originals/dutch'
import { db as packageDb, getBitcoinNetwork, version, SecureDutchyDatabase } from '@originals/dutch'
import { db as svcDb } from './services/db'

// Utility for reading JSON bodies (for endpoints using Request)
async function readJson(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('application/json')) return await request.json()
    const text = await request.text()
    if (!text) return {}
    try {
      return JSON.parse(text)
    } catch {
      return {}
    }
  } catch {
    return {}
  }
}

// Utility for network override (from the "HEAD" branch)
function withNetworkOverride<T>(networkParam: string | undefined, handler: () => T): T {
  const original = (globalThis as any).process?.env?.BITCOIN_NETWORK
  if (networkParam) (globalThis as any).process.env.BITCOIN_NETWORK = String(networkParam)
  try {
    return handler()
  } finally {
    if (networkParam) (globalThis as any).process.env.BITCOIN_NETWORK = original
  }
}

// Compose the app, combining both sets of endpoints
export function createApp(dbInstance?: SecureDutchyDatabase) {
  const database = dbInstance ?? packageDb
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
    .get('/hello', () => ({ message: helloDutch('World') }))
    .get('/health', ({ query }) =>
      withNetworkOverride(query?.network as any, () => {
        const auctions = database.listAuctions()
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
          const list = database.listAuctions({
            status: (query.status as any) || undefined,
            type: (query.type as any) || undefined,
          })
          const enriched = list.map((a: any) => {
            if (a.auction_type === 'single') {
              const linear = database.calculateCurrentPrice(a, now)
              const stepped = database.calculatePriceWithIntervals(a, now)
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
        const a = database.getAuction(params.auctionId)
        if (a) {
          if (a.status === 'active' && a.end_time <= now) {
            database.updateAuctionStatus(a.id, 'expired')
            a.status = 'expired'
          }
          const linear = database.calculateCurrentPrice(a, now)
          const stepped = database.calculatePriceWithIntervals(a, now)
          return {
            ok: true,
            network: getBitcoinNetwork(),
            auction: { ...a, auction_type: 'single' as const },
            pricing: { currentPriceLinear: linear.currentPrice, currentPriceStepped: stepped.currentPrice, at: now },
          }
        }
        // Try clearing auction status
        try {
          const s = database.getClearingAuctionStatus(params.auctionId)
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
        const a = database.getAuction(params.auctionId)
        if (!a) return { ok: false, error: 'Auction not found' }
        if (a.status === 'active' && a.end_time <= now) {
          database.updateAuctionStatus(a.id, 'expired')
          a.status = 'expired'
        }
        const linear = database.calculateCurrentPrice(a, now)
        return { ok: true, network: getBitcoinNetwork(), auctionId: a.id, price: linear.currentPrice, status: linear.auctionStatus, at: now }
      }),
      { params: t.Object({ auctionId: t.String() }), query: t.Object({ network: t.Optional(t.String()) }) },
    )
    .get('/price/:auctionId/stepped', ({ params, query }) =>
      withNetworkOverride(query?.network as any, () => {
        const now = Math.floor(Date.now() / 1000)
        const a = database.getAuction(params.auctionId)
        if (!a) return { ok: false, error: 'Auction not found' }
        if (a.status === 'active' && a.end_time <= now) {
          database.updateAuctionStatus(a.id, 'expired')
          a.status = 'expired'
        }
        const stepped = database.calculatePriceWithIntervals(a, now)
        return { ok: true, network: getBitcoinNetwork(), auctionId: a.id, price: stepped.currentPrice, status: a.status, at: now }
      }),
      { params: t.Object({ auctionId: t.String() }), query: t.Object({ network: t.Optional(t.String()) }) },
    )
    // Admin endpoints
    .post('/admin/check-expired', ({ query }) =>
      withNetworkOverride(query?.network as any, () => {
        const result = database.checkAndUpdateExpiredAuctions()
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
        const res = database.updateAuctionStatus(params.auctionId, (body as any).status)
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

    // Recovery endpoints (proxy to in-process service db)
    .get('/recovery/auction/:auctionId', ({ params }) => svcDb.recoverAuctionFromSeed(params.auctionId))
    .get('/recovery/all', () => svcDb.recoverAllAuctionsFromSeed())
    .get('/recovery/verify/:auctionId', ({ params }) => svcDb.verifyAuctionRecovery(params.auctionId))
    .post('/api/recovery/simulate-disaster', () => svcDb.simulateDisasterRecovery())
    .get('/api/recovery/status', () => svcDb.getRecoveryStatus())
    .get('/api/recovery/documentation', () => ({
      title: 'Disaster Recovery Procedures',
      version: 1,
      procedures: [
        { step: 1, action: 'Verify master seed presence', endpoint: '/seed/status' },
        { step: 2, action: 'Recover specific auction from seed', endpoint: '/recovery/auction/:auctionId' },
        { step: 3, action: 'Recover all auctions from seed', endpoint: '/recovery/all' },
        { step: 4, action: 'Verify recovery integrity for auction', endpoint: '/recovery/verify/:auctionId' },
        { step: 5, action: 'Monitor transactions and reconcile', endpoint: '/admin/update-all-from-blockchain' }
      ]
    }))
    // Seed endpoints
    .post('/seed/validate', async ({ request }) => {
      const body = await readJson(request)
      return svcDb.validateSeedPhrase((body as any)?.seed)
    })
    .post('/seed/import', async ({ request }) => {
      const body = await readJson(request)
      return svcDb.importMasterSeed((body as any)?.seed)
    })
    .post('/seed/rotate', async ({ request }) => {
      const body = await readJson(request)
      return svcDb.rotateMasterSeed((body as any)?.newSeed)
    })
    .get('/seed/backup-with-warnings', () => svcDb.getMasterSeedWithWarnings())
    .get('/seed/status', () => svcDb.getSeedManagementStatus())
    // Security minimal (not used by tests but harmless)
    .get('/security/audit-logs', ({ query }) => svcDb.getAuditLogs(query?.limit ? Number(query.limit) : undefined, query?.operation as string | undefined))
    .post('/security/test-encryption', async ({ request }) => {
      const body = await readJson(request)
      return svcDb.testEncryptionRoundTrip((body as any)?.plaintext)
    })
    // Fee endpoints
    .get('/fees/rates', ({ query }) => svcDb.getFeeRates((query?.network as string) || undefined, query?.refresh === 'true'))
    .post('/fees/calculate', async ({ request }) => {
      const body = await readJson(request)
      return svcDb.calculateTransactionFee(body as any)
    })
    .get('/fees/estimation/:transactionType', ({ params, query }) => svcDb.getFeeEstimationDisplay(params.transactionType, (query?.network as string) || undefined))
    .post('/fees/escalate', async ({ request }) => {
      const body = await readJson(request)
      return svcDb.escalateTransactionFee(body as any)
    })
    .post('/fees/test-calculations', () => svcDb.testFeeCalculations())
    .get('/auction/:auctionId/fee-info', ({ params, query }) => svcDb.getAuctionFeeInfo(params.auctionId, (query?.network as string) || undefined))
    // Monitoring endpoints
    .get('/transaction/:transactionId/status', ({ params, query }) => svcDb.monitorTransaction(params.transactionId, (query?.auctionId as string) || undefined))
    .get('/transaction/:transactionId/monitor', ({ params, query }) => svcDb.monitorTransactionReal(params.transactionId, (query?.auctionId as string) || undefined, (query?.network as string) || undefined))
    .post('/auction/:auctionId/update-from-blockchain', ({ params }) => svcDb.updateAuctionFromBlockchain(params.auctionId))
    .post('/admin/update-all-from-blockchain', () => svcDb.updateAllAuctionsFromBlockchain())
    .get('/admin/detect-failed-transactions', () => svcDb.detectFailedTransactions())
    .get('/auction/:auctionId/transaction-history', ({ params }) => svcDb.getTransactionHistory(params.auctionId))
    .post('/transaction/handle-failure', async ({ request }) => {
      const body = await readJson(request)
      return svcDb.handleTransactionFailure((body as any)?.transactionId, (body as any)?.reason)
    })
    // Error handler
    .onError(({ error, set }) => {
      const message = (error as Error)?.message || 'Internal Error'
      if (/not\s*found/i.test(message)) {
        set.status = 404
        return { error: 'Not Found' }
      }
      if (/required/i.test(message)) {
        set.status = 400
        return { error: message }
      }
      set.status = 500
      return { error: message }
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
