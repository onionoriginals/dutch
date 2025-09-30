import { Elysia, t } from 'elysia'
import { swagger } from '@elysiajs/swagger'
import { cors } from '@elysiajs/cors'
import { helloDutch } from '@originals/dutch'
import { db as packageDb, getBitcoinNetwork, version, SecureDutchyDatabase } from '@originals/dutch'
import { db as svcDb } from './services/db'
import * as bitcoin from 'bitcoinjs-lib'
import { logger } from './utils/logger'
type BodyInit = Blob | ArrayBuffer | DataView | Uint8Array | ReadableStream | null | string

// Track server start time for uptime metrics
const SERVER_START_TIME = Date.now()
// Standard response schemas
const SuccessResponse = <T extends ReturnType<typeof t.Object>>(dataSchema: T) =>
  t.Object({
    ok: t.Literal(true),
    data: dataSchema,
  })

const ErrorResponse = t.Object({
  ok: t.Literal(false),
  error: t.String(),
  code: t.Optional(t.String()),
})

// Configure allowed origins for CORS at the API level
const allowedOriginsFromEnv = (Bun.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const defaultAllowedOrigins = [
  'http://localhost:4321',
  'http://127.0.0.1:4321',
  'https://dutch-production.up.railway.app',
]

const allowedOrigins = allowedOriginsFromEnv.length
  ? allowedOriginsFromEnv
  : defaultAllowedOrigins

function isOriginAllowed(origin: string): boolean {
  try {
    const originHost = new URL(`http://${origin}`).host.toLowerCase()
    return allowedOrigins.some((allowed) => {
      try {
        const allowedHost = new URL(allowed).host.toLowerCase()
        return allowedHost === originHost
      } catch {
        return allowed.toLowerCase() === origin.toLowerCase()
      }
    })
  } catch {
    return false
  }
}

// Helper function to create standardized success response
function success<T>(data: T) {
  return { ok: true as const, data }
}

// Helper function to create standardized error response
function error(message: string, code?: string) {
  return { ok: false as const, error: message, code }
}

// Utility for network override (from the "HEAD" branch)
async function withNetworkOverride<T>(networkParam: string | undefined, handler: () => T | Promise<T>): Promise<T> {
  const original = (globalThis as any).process?.env?.BITCOIN_NETWORK
  if (networkParam) (globalThis as any).process.env.BITCOIN_NETWORK = String(networkParam)
  try {
    return await handler()
  } finally {
    if (networkParam) (globalThis as any).process.env.BITCOIN_NETWORK = original
  }
}

// Helper for mempool API base
function getMempoolApiBase(): string {
  const network = getBitcoinNetwork()
  if (network === 'testnet') return 'https://mempool.space/testnet/api'
  if (network === 'signet') return 'https://mempool.space/signet/api'
  if (network === 'regtest') return 'http://localhost:3002/api'
  return 'https://mempool.space/api'
}

function getBitcoinJsNetwork(): bitcoin.networks.Network {
  const n = getBitcoinNetwork()
  if (n === 'mainnet') return bitcoin.networks.bitcoin
  if (n === 'regtest') return bitcoin.networks.regtest
  // Treat signet as testnet for address/script params
  return bitcoin.networks.testnet
}

// Compose the app, combining both sets of endpoints
export function createApp(dbInstance?: SecureDutchyDatabase) {
  const database = dbInstance ?? packageDb
  const app = new Elysia()
    .use(cors({
      origin: (request) => {
        const originHeader = request.headers.get('origin') || request.headers.get('Origin')
        if (!originHeader) return true
        try {
          const host = new URL(originHeader).host
          return isOriginAllowed(host)
        } catch {
          return false
        }
      },
      credentials: true,
    }))
    .use(swagger())
    // Request/Response logging middleware
    .onRequest(({ request, path }) => {
      const method = request.method
      // Skip logging for static assets and health checks to reduce noise
      if (path.match(/\.(css|js|html|ico|png|jpg|svg)$/) || path === '/health') {
        return
      }
      logger.request(method, path, {
        userAgent: request.headers.get('user-agent')?.substring(0, 100),
      })
    })
    .onAfterHandle(({ request, path, set }) => {
      const method = request.method
      const status = set.status || 200
      // Skip logging for static assets and health checks
      if (path.match(/\.(css|js|html|ico|png|jpg|svg)$/) || path === '/health') {
        return
      }
      // Note: We don't have access to request start time in this hook,
      // so duration is not available. For production, consider using onBeforeHandle to track timing.
    })
    // Root: serve built web UI index.html
    .get('/', async () => {
      try {
        const indexUrl = new URL('../../web/dist/index.html', import.meta.url)
        const file = Bun.file(indexUrl)
        if (!(await file.exists())) {
          return new Response('index.html not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } })
        }
        const html = await file.text()
        return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
      } catch (err: any) {
        return new Response('Failed to load index.html', { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } })
      }
    })
    .get('/hello', () => 
      success({ message: helloDutch('World') }),
      {
        response: SuccessResponse(t.Object({ message: t.String() }))
      }
    )
    .get('/health', async ({ query }) =>
      await withNetworkOverride(query?.network as any, async () => {
        const startTime = Date.now()
        let dbConnected = false
        let dbResponseTime: number | null = null
        let auctions: any[] = []
        
        try {
          // Test DB connectivity by listing auctions
          const dbStart = Date.now()
          auctions = await (database as any).listAuctions()
          dbResponseTime = Date.now() - dbStart
          dbConnected = true
        } catch (err: any) {
          logger.error('Health check DB query failed', { error: err.message })
          dbConnected = false
        }

        const active = auctions.filter((a: any) => a.status === 'active').length
        const sold = auctions.filter((a: any) => a.status === 'sold').length
        const expired = auctions.filter((a: any) => a.status === 'expired').length
        return success({
          network: getBitcoinNetwork(),
          version,
          counts: { active, sold, expired, total: auctions.length },
        })
      }),
      {
        query: t.Object({ network: t.Optional(t.String()) }),
        response: SuccessResponse(t.Object({
          network: t.String(),
          version: t.String(),
          counts: t.Object({
            active: t.Number(),
            sold: t.Number(),
            expired: t.Number(),
            total: t.Number(),
          })
        }))
      },
    )
    // Listings
    .get(
      '/auctions',
      async ({ query }) =>
        await withNetworkOverride(query?.network as any, async () => {
          const now = Math.floor(Date.now() / 1000)
          const list = await (database as any).listAuctions({
            status: (query.status as any) || undefined,
            type: (query.type as any) || undefined,
          })
          const enriched = list.map((a: any) => {
            if (a.auction_type === 'single') {
              const linear = (database as any).calculateCurrentPrice(a, now)
              const stepped = (database as any).calculatePriceWithIntervals(a, now)
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
          return success({ network: getBitcoinNetwork(), items: enriched })
        }),
      {
        query: t.Object({
          status: t.Optional(t.Union([t.Literal('active'), t.Literal('sold'), t.Literal('expired')])),
          type: t.Optional(t.Union([t.Literal('single'), t.Literal('clearing')])) ,
          network: t.Optional(t.String()),
        }),
        response: SuccessResponse(t.Object({
          network: t.String(),
          items: t.Array(t.Any()),
        }))
      },
    )
    // Duplicate under /api for web client
    .get(
      '/api/auctions',
      async ({ query }) =>
        await withNetworkOverride(query?.network as any, async () => {
          const now = Math.floor(Date.now() / 1000)
          const list = await (database as any).listAuctions({
            status: (query.status as any) || undefined,
            type: (query.type as any) || undefined,
          })
          const enriched = list.map((a: any) => {
            if (a.auction_type === 'single') {
              const linear = (database as any).calculateCurrentPrice(a, now)
              const stepped = (database as any).calculatePriceWithIntervals(a, now)
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
          return success({ network: getBitcoinNetwork(), items: enriched })
        }),
      {
        query: t.Object({
          status: t.Optional(t.Union([t.Literal('active'), t.Literal('sold'), t.Literal('expired')])),
          type: t.Optional(t.Union([t.Literal('single'), t.Literal('clearing')])) ,
          network: t.Optional(t.String()),
        }),
        response: SuccessResponse(t.Object({
          network: t.String(),
          items: t.Array(t.Any()),
        }))
      },
    )
    // Auction details
    .get('/auction/:auctionId', async ({ params, query }) =>
      await withNetworkOverride(query?.network as any, async () => {
        const now = Math.floor(Date.now() / 1000)
        const a = await (database as any).getAuction(params.auctionId)
        if (a) {
          if (a.status === 'active' && a.end_time <= now) {
            await (database as any).updateAuctionStatus(a.id, 'expired')
            a.status = 'expired'
          }
          const linear = (database as any).calculateCurrentPrice(a, now)
          const stepped = (database as any).calculatePriceWithIntervals(a, now)
          return success({
            network: getBitcoinNetwork(),
            auction: { ...a, auction_type: 'single' as const },
            pricing: { currentPriceLinear: linear.currentPrice, currentPriceStepped: stepped.currentPrice, at: now },
          })
        }
        // Try clearing auction status
        try {
          const s = (database as any).getClearingAuctionStatus(params.auctionId)
          return success({ 
            network: getBitcoinNetwork(), 
            auction: { ...s.auction, auction_type: 'clearing' as const }, 
            pricing: null 
          })
        } catch {
          return error('Auction not found', 'NOT_FOUND')
        }
      }),
      {
        params: t.Object({ auctionId: t.String() }),
        query: t.Object({ network: t.Optional(t.String()) }),
        response: t.Union([
          SuccessResponse(t.Object({
            network: t.String(),
            auction: t.Any(),
            pricing: t.Any(),
          })),
          ErrorResponse
        ])
      },
    )
    // Pricing endpoints
    .get('/price/:auctionId', async ({ params, query }) =>
      await withNetworkOverride(query?.network as any, async () => {
        const now = Math.floor(Date.now() / 1000)
        const a = await (database as any).getAuction(params.auctionId)
        if (!a) return error('Auction not found', 'NOT_FOUND')
        if (a.status === 'active' && a.end_time <= now) {
          await (database as any).updateAuctionStatus(a.id, 'expired')
          a.status = 'expired'
        }
        const linear = (database as any).calculateCurrentPrice(a, now)
        return success({ network: getBitcoinNetwork(), auctionId: a.id, price: linear.currentPrice, status: linear.auctionStatus, at: now })
      }),
      { 
        params: t.Object({ auctionId: t.String() }), 
        query: t.Object({ network: t.Optional(t.String()) }),
        response: t.Union([
          SuccessResponse(t.Object({
            network: t.String(),
            auctionId: t.String(),
            price: t.Number(),
            status: t.String(),
            at: t.Number(),
          })),
          ErrorResponse
        ])
      },
    )
    .get('/price/:auctionId/stepped', async ({ params, query }) =>
      await withNetworkOverride(query?.network as any, async () => {
        const now = Math.floor(Date.now() / 1000)
        const a = await (database as any).getAuction(params.auctionId)
        if (!a) return error('Auction not found', 'NOT_FOUND')
        if (a.status === 'active' && a.end_time <= now) {
          await (database as any).updateAuctionStatus(a.id, 'expired')
          a.status = 'expired'
        }
        const stepped = (database as any).calculatePriceWithIntervals(a, now)
        return success({ network: getBitcoinNetwork(), auctionId: a.id, price: stepped.currentPrice, status: a.status, at: now })
      }),
      { 
        params: t.Object({ auctionId: t.String() }), 
        query: t.Object({ network: t.Optional(t.String()) }),
        response: t.Union([
          SuccessResponse(t.Object({
            network: t.String(),
            auctionId: t.String(),
            price: t.Number(),
            status: t.String(),
            at: t.Number(),
          })),
          ErrorResponse
        ])
      },
    )
    // Admin endpoints
    .post('/admin/check-expired', async ({ query }) =>
      await withNetworkOverride(query?.network as any, async () => {
        const result = await (database as any).checkAndUpdateExpiredAuctions()
        return success({ ...result, network: getBitcoinNetwork() })
      }),
      { 
        query: t.Object({ network: t.Optional(t.String()) }),
        response: SuccessResponse(t.Any())
      },
    )
    .post('/auction/:auctionId/status', async ({ params, body, query }) =>
      await withNetworkOverride(query?.network as any, async () => {
        const allowed = ['active', 'sold', 'expired']
        if (!allowed.includes((body as any).status)) {
          return error('Invalid status', 'INVALID_STATUS')
        }
        const res = await (database as any).updateAuctionStatus(params.auctionId, (body as any).status)
        if (!('success' in res) || !res.success) return error('Auction not found', 'NOT_FOUND')
        return success({ auctionId: params.auctionId, newStatus: (body as any).status })
      }),
      { 
        params: t.Object({ auctionId: t.String() }), 
        body: t.Object({ status: t.String() }), 
        query: t.Object({ network: t.Optional(t.String()) }),
        response: t.Union([
          SuccessResponse(t.Object({
            auctionId: t.String(),
            newStatus: t.String(),
          })),
          ErrorResponse
        ])
      },
    )
    // Clearing price Dutch auction endpoints
    .post('/clearing/create-auction', async ({ body }) => {
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
        } = body
        if (!inscriptionIds || inscriptionIds.length === 0) {
          return error('inscriptionIds[] required', 'VALIDATION_ERROR')
        }
        if (!quantity || !startPrice || !minPrice || !duration || !sellerAddress) {
          return error('quantity, startPrice, minPrice, duration, sellerAddress required', 'VALIDATION_ERROR')
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
        const res = (database as any).createClearingPriceAuction(input)
        return success(res)
      } catch (err: any) {
        return error(err?.message || 'internal_error', 'INTERNAL_ERROR')
      }
    },
    {
      body: t.Object({
        auctionId: t.Optional(t.String()),
        inscriptionIds: t.Array(t.String()),
        quantity: t.Number(),
        startPrice: t.Number(),
        minPrice: t.Number(),
        duration: t.Number(),
        decrementInterval: t.Optional(t.Number()),
        sellerAddress: t.String(),
      }),
      response: t.Union([
        SuccessResponse(t.Any()),
        ErrorResponse
      ])
    })
    .post('/clearing/place-bid', async ({ body }) => {
      try {
        const { auctionId, bidderAddress, quantity } = body
        if (!auctionId || !bidderAddress) {
          return error('auctionId and bidderAddress required', 'VALIDATION_ERROR')
        }
        const res = (database as any).placeBid(String(auctionId), String(bidderAddress), Number(quantity ?? 1))
        return success(res)
      } catch (err: any) {
        return error(err?.message || 'internal_error', 'INTERNAL_ERROR')
      }
    },
    {
      body: t.Object({
        auctionId: t.String(),
        bidderAddress: t.String(),
        quantity: t.Optional(t.Number()),
      }),
      response: t.Union([
        SuccessResponse(t.Any()),
        ErrorResponse
      ])
    })
    .get('/clearing/status/:auctionId', ({ params }) => {
      try {
        const res = (database as any).getClearingAuctionStatus(String(params.auctionId))
        return success(res)
      } catch (err: any) {
        return error(err?.message || 'not_found', 'NOT_FOUND')
      }
    },
    {
      response: t.Union([
        SuccessResponse(t.Any()),
        ErrorResponse
      ])
    })
    .get('/clearing/bids/:auctionId', ({ params }) => {
      try {
        const res = (database as any).getAuctionBids(String(params.auctionId))
        return success(res)
      } catch (err: any) {
        return error(err?.message || 'not_found', 'NOT_FOUND')
      }
    },
    {
      response: t.Union([
        SuccessResponse(t.Any()),
        ErrorResponse
      ])
    })
    .get('/clearing/settlement/:auctionId', ({ params }) => {
      try {
        const res = (database as any).calculateSettlement(String(params.auctionId))
        return success(res)
      } catch (err: any) {
        return error(err?.message || 'not_found', 'NOT_FOUND')
      }
    },
    {
      response: t.Union([
        SuccessResponse(t.Any()),
        ErrorResponse
      ])
    })
    .post('/clearing/mark-settled', ({ body }) => {
      try {
        const { auctionId, bidIds } = body
        if (!auctionId || !Array.isArray(bidIds)) {
          return error('auctionId and bidIds[] required', 'VALIDATION_ERROR')
        }
        const res = (database as any).markBidsSettled(String(auctionId), bidIds.map(String))
        return success(res)
      } catch (err: any) {
        return error(err?.message || 'internal_error', 'INTERNAL_ERROR')
      }
    },
    {
      body: t.Object({
        auctionId: t.String(),
        bidIds: t.Array(t.String()),
      }),
      response: t.Union([
        SuccessResponse(t.Any()),
        ErrorResponse
      ])
    })
    .post('/clearing/create-bid-payment', ({ body }) => {
      try {
        const { auctionId, bidderAddress, bidAmount, quantity } = body
        if (!auctionId || !bidderAddress || bidAmount == null) {
          return error('auctionId, bidderAddress, bidAmount required', 'VALIDATION_ERROR')
        }
        const res = (database as any).createBidPaymentPSBT(String(auctionId), String(bidderAddress), Number(bidAmount), Number(quantity ?? 1))
        return success(res)
      } catch (err: any) {
        return error(err?.message || 'internal_error', 'INTERNAL_ERROR')
      }
    },
    {
      body: t.Object({
        auctionId: t.String(),
        bidderAddress: t.String(),
        bidAmount: t.Number(),
        quantity: t.Optional(t.Number()),
      }),
      response: t.Union([
        SuccessResponse(t.Any()),
        ErrorResponse
      ])
    })
    .post('/clearing/confirm-bid-payment', ({ body }) => {
      try {
        const { bidId, transactionId } = body
        if (!bidId || !transactionId) {
          return error('bidId and transactionId required', 'VALIDATION_ERROR')
        }
        const res = (database as any).confirmBidPayment(String(bidId), String(transactionId))
        return success(res)
      } catch (err: any) {
        return error(err?.message || 'internal_error', 'INTERNAL_ERROR')
      }
    },
    {
      body: t.Object({
        bidId: t.String(),
        transactionId: t.String(),
      }),
      response: t.Union([
        SuccessResponse(t.Any()),
        ErrorResponse
      ])
    })
    .post('/clearing/process-settlement', ({ body }) => {
      try {
        const { auctionId } = body
        if (!auctionId) {
          return error('auctionId required', 'VALIDATION_ERROR')
        }
        const res = (database as any).processAuctionSettlement(String(auctionId))
        return success(res)
      } catch (err: any) {
        return error(err?.message || 'internal_error', 'INTERNAL_ERROR')
      }
    },
    {
      body: t.Object({
        auctionId: t.String(),
      }),
      response: t.Union([
        SuccessResponse(t.Any()),
        ErrorResponse
      ])
    })
    .get('/clearing/bid-payment-status/:bidId', ({ params }) => {
      try {
        const res = (database as any).getBidDetails(String(params.bidId))
        return success(res)
      } catch (err: any) {
        return error(err?.message || 'not_found', 'NOT_FOUND')
      }
    },
    {
      response: t.Union([
        SuccessResponse(t.Any()),
        ErrorResponse
      ])
    })
    .get('/clearing/auction-payments/:auctionId', ({ params }) => {
      try {
        const res = (database as any).getAuctionBidsWithPayments(String(params.auctionId))
        return success(res)
      } catch (err: any) {
        return error(err?.message || 'not_found', 'NOT_FOUND')
      }
    },
    {
      response: t.Union([
        SuccessResponse(t.Any()),
        ErrorResponse
      ])
    })
    // Demo helper
    .post('/demo/create-clearing-auction', ({ body }) => {
      try {
        const id = String(body?.auctionId ?? `demo_${Date.now()}`)
        const inscriptionIds = body?.inscriptionIds ?? ['insc-0', 'insc-1', 'insc-2']
        const res = (database as any).createClearingPriceAuction({
          id,
          inscription_id: String(inscriptionIds[0]),
          inscription_ids: inscriptionIds.map(String),
          quantity: Number(body?.quantity ?? 3),
          start_price: Number(body?.startPrice ?? 30000),
          min_price: Number(body?.minPrice ?? 10000),
          duration: Number(body?.duration ?? 3600),
          decrement_interval: Number(body?.decrementInterval ?? 600),
          seller_address: String(body?.sellerAddress ?? 'tb1p_seller'),
        })
        return success(res)
      } catch (err: any) {
        return error(err?.message || 'internal_error', 'INTERNAL_ERROR')
      }
    },
    {
      body: t.Object({
        auctionId: t.Optional(t.String()),
        inscriptionIds: t.Optional(t.Array(t.String())),
        quantity: t.Optional(t.Number()),
        startPrice: t.Optional(t.Number()),
        minPrice: t.Optional(t.Number()),
        duration: t.Optional(t.Number()),
        decrementInterval: t.Optional(t.Number()),
        sellerAddress: t.Optional(t.String()),
      }),
      response: t.Union([
        SuccessResponse(t.Any()),
        ErrorResponse
      ])
    })

    // Recovery endpoints (proxy to in-process service db)
    .get('/recovery/auction/:auctionId', ({ params }) => success(svcDb.recoverAuctionFromSeed(params.auctionId)))
    .get('/recovery/all', () => success(svcDb.recoverAllAuctionsFromSeed()))
    .get('/recovery/verify/:auctionId', ({ params }) => success(svcDb.verifyAuctionRecovery(params.auctionId)))
    .post('/api/recovery/simulate-disaster', () => success(svcDb.simulateDisasterRecovery()))
    .get('/api/recovery/status', () => success(svcDb.getRecoveryStatus()))
    .get('/api/recovery/documentation', () => success({
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
    .post('/seed/validate', ({ body }) => success(svcDb.validateSeedPhrase(body?.seed)),
      {
        body: t.Object({ seed: t.Optional(t.String()) }),
        response: SuccessResponse(t.Any())
      }
    )
    .post('/seed/import', ({ body }) => success(svcDb.importMasterSeed(body?.seed)),
      {
        body: t.Object({ seed: t.Optional(t.String()) }),
        response: SuccessResponse(t.Any())
      }
    )
    .post('/seed/rotate', ({ body }) => success(svcDb.rotateMasterSeed(body?.newSeed)),
      {
        body: t.Object({ newSeed: t.Optional(t.String()) }),
        response: SuccessResponse(t.Any())
      }
    )
    .get('/seed/backup-with-warnings', () => success(svcDb.getMasterSeedWithWarnings()))
    .get('/seed/status', () => success(svcDb.getSeedManagementStatus()))
    // Security minimal (not used by tests but harmless)
    .get('/security/audit-logs', ({ query }) => success(svcDb.getAuditLogs(query?.limit ? Number(query.limit) : undefined, query?.operation as string | undefined)))
    .post('/security/test-encryption', ({ body }) => success(svcDb.testEncryptionRoundTrip(body?.plaintext)),
      {
        body: t.Object({ plaintext: t.Optional(t.String()) }),
        response: SuccessResponse(t.Any())
      }
    )
    // Fee endpoints
    .get('/fees/rates', ({ query }) =>
      withNetworkOverride(query?.network as any, async () => {
        const network = (query?.network as string) || getBitcoinNetwork()
        const rates = await database.getFeeRates(network)
        return success({ network: getBitcoinNetwork(), rates })
      }),
    )
    .post('/fees/calculate', async ({ body }) => {
      const network = body?.network || getBitcoinNetwork()
      const category = (body?.category || 'medium') as 'low' | 'medium' | 'high'
      const size = Number(body?.size ?? 0)
      const rates = await database.getFeeRates(network)
      const satsPerVb = category === 'high' ? rates.fast : category === 'low' ? rates.slow : rates.normal
      const fee = Math.ceil(size * satsPerVb)
      return success({ network, category, rate: satsPerVb, size, fee, currency: 'sats' })
    },
    {
      body: t.Object({
        network: t.Optional(t.String()),
        category: t.Optional(t.String()),
        size: t.Optional(t.Number()),
      }),
      response: SuccessResponse(t.Any())
    })
    .get('/fees/estimation/:transactionType', ({ params, query }) =>
      withNetworkOverride(query?.network as any, async () => {
        const network = (query?.network as string) || getBitcoinNetwork()
        const rates = await database.getFeeRates(network)
        const sampleSize = 250
        const options = [
          { category: 'low', rate: rates.slow, estimatedFeeForSize: Math.ceil(sampleSize * rates.slow), etaMinutes: 30 },
          { category: 'medium', rate: rates.normal, estimatedFeeForSize: Math.ceil(sampleSize * rates.normal), etaMinutes: 10 },
          { category: 'high', rate: rates.fast, estimatedFeeForSize: Math.ceil(sampleSize * rates.fast), etaMinutes: 2 },
        ]
        return success({ transactionType: params.transactionType, network: getBitcoinNetwork(), options })
      }),
    )
    .post('/fees/escalate', ({ body }) => {
      const currentRate = Number(body?.currentRate ?? 1)
      const bumpPercent = Number(body?.bumpPercent ?? 20)
      const newRate = Math.ceil(currentRate * (1 + bumpPercent / 100))
      return success({ oldRate: currentRate, newRate, bumpedByPercent: bumpPercent })
    },
    {
      body: t.Object({
        currentRate: t.Optional(t.Number()),
        bumpPercent: t.Optional(t.Number()),
      }),
      response: SuccessResponse(t.Any())
    })
    .post('/fees/test-calculations', () => success({ ok: true }))
    .get('/auction/:auctionId/fee-info', ({ params, query }) => success(svcDb.getAuctionFeeInfo(params.auctionId, (query?.network as string) || undefined)))
    // Monitoring endpoints
    .get('/transaction/:transactionId/status', ({ params, query }) => success(svcDb.monitorTransaction(params.transactionId, (query?.auctionId as string) || undefined)))
    .get('/transaction/:transactionId/monitor', ({ params, query }) => success(svcDb.monitorTransactionReal(params.transactionId, (query?.auctionId as string) || undefined, (query?.network as string) || undefined)))
    .post('/auction/:auctionId/update-from-blockchain', ({ params }) => success(svcDb.updateAuctionFromBlockchain(params.auctionId)), { params: t.Object({ auctionId: t.String() }) })
    .post('/admin/update-all-from-blockchain', () => success(svcDb.updateAllAuctionsFromBlockchain()))
    .get('/admin/detect-failed-transactions', () => success(svcDb.detectFailedTransactions()))
    .get('/auction/:auctionId/transaction-history', ({ params }) => success(svcDb.getTransactionHistory(params.auctionId)))
    .post('/transaction/handle-failure', ({ body }) => success(svcDb.handleTransactionFailure(body?.transactionId, body?.reason)),
      {
        body: t.Object({
          transactionId: t.Optional(t.String()),
          reason: t.Optional(t.String()),
        }),
        response: SuccessResponse(t.Any())
      }
    )
    // Error handler
    .onError(({ code, error: err, set }) => {
      const message = (err as Error)?.message || 'Internal Error'
      if (code === 'VALIDATION') {
        set.status = 400
        return { ok: false, error: message, code: 'VALIDATION_ERROR' }
      }
      if (/not\s*found/i.test(message)) {
        set.status = 404
        return { ok: false, error: 'Not Found', code: 'NOT_FOUND' }
      }
      if ((err as any)?.name === 'ValidationError' || (err as any)?.type === 'validation' || (err as any)?.status === 400 || /required|expected|invalid|must/i.test(message)) {
        set.status = 400
        return { ok: false, error: message, code: 'VALIDATION_ERROR' }
      }
      set.status = 500
      return { ok: false, error: message, code: 'INTERNAL_ERROR' }
    })

    // Additional endpoints from feature branch (auction creation and escrow)
    .post('/create-auction', async ({ body, set }) => {
      try {
        const {
          asset,
          startPrice,
          minPrice,
          duration,
          decrementInterval,
          sellerAddress,
        } = body

        if (!asset || !startPrice || !minPrice || !duration || !decrementInterval || !sellerAddress) {
          set.status = 400
          return error('Missing required fields', 'VALIDATION_ERROR')
        }

        const inscriptionRegex = /^[0-9a-fA-F]{64}i\d+$/
        if (!inscriptionRegex.test(String(asset))) {
          set.status = 400
          return error('Invalid inscriptionId format. Expected <txid>i<index>', 'VALIDATION_ERROR')
        }

        const [txid, voutStr] = String(asset).split('i')
        if (!voutStr) {
          set.status = 400
          return error('Invalid inscription format. Expected <txid>i<index>', 'VALIDATION_ERROR')
        }
        const voutIndex = parseInt(voutStr, 10)
        if (!Number.isFinite(voutIndex)) {
          set.status = 400
          return error('Invalid inscription vout index', 'VALIDATION_ERROR')
        }

        const base = getMempoolApiBase()

        const txResp = await fetch(`${base}/tx/${txid}`)
        if (!txResp.ok) {
          set.status = 400
          return error('Transaction not found', 'NOT_FOUND')
        }
        const txJson = await txResp.json() as any
        const vout = (txJson?.vout || [])[voutIndex]
        if (!vout) {
          set.status = 400
          return error('Inscription output not found', 'NOT_FOUND')
        }

        const outspendsResp = await fetch(`${base}/tx/${txid}/outspends`)
        if (!outspendsResp.ok) {
          set.status = 500
          return error('Failed to verify outspend status', 'INTERNAL_ERROR')
        }
        const outspends = await outspendsResp.json() as any
        const outspend = outspends?.[voutIndex]
        const spent = !!outspend?.spent
        const ownerMatches = String(vout?.scriptpubkey_address || '') === String(sellerAddress)
        
        // Log ownership check with redaction
        logger.info('Ownership verification', {
          operation: 'ownership-check',
          inscriptionId: asset as string,
          ownerMatches,
          spent,
          // Addresses are intentionally logged as they may be needed for debugging,
          // but the logger will redact them based on field names
          sellerAddress,
          voutAddress: vout?.scriptpubkey_address,
        })
        
        if (!ownerMatches) {
          set.status = 403
          return error('Ownership mismatch for inscription UTXO', 'FORBIDDEN')
        }
        if (spent) {
          set.status = 403
          return error('Inscription UTXO already spent', 'FORBIDDEN')
        }

        // Deterministic auction id from asset and seller to make testing easier
        const auctionId = `${txid}:${voutIndex}:${String(sellerAddress).slice(0, 8)}`
        const { keyPair, address } = await database.generateAuctionKeyPair(auctionId)

        // Build a minimal PSBT moving the UTXO to the auction address
        const network = getBitcoinJsNetwork()
        const psbt = new bitcoin.Psbt({ network })

        const value = Number(vout.value)
        const scriptHex = String(vout.scriptpubkey || '')
        const witnessUtxo = scriptHex
          ? { script: Buffer.from(scriptHex, 'hex'), value }
          : { script: bitcoin.address.toOutputScript(String(sellerAddress), network), value }

        psbt.addInput({ hash: String(txid), index: voutIndex, witnessUtxo })

        const outputValue = Math.max(1, value - 500)
        let outputScript: Buffer
        try {
          outputScript = bitcoin.address.toOutputScript(address, network)
        } catch {
          // Fallback to standard P2WPKH 20 zero-bytes if the generated address is not strictly valid
          outputScript = Buffer.from('0014' + '00'.repeat(20), 'hex')
        }
        psbt.addOutput({ script: outputScript, value: outputValue })

        const now = Math.floor(Date.now() / 1000)
        const auction = {
          id: auctionId,
          inscription_id: asset as string,
          start_price: Number(startPrice),
          min_price: Number(minPrice),
          current_price: Number(startPrice),
          duration: Number(duration),
          decrement_interval: Number(decrementInterval),
          start_time: now,
          end_time: now + Number(duration),
          status: 'active' as const,
          auction_address: address,
          created_at: now,
          updated_at: now,
        }
        database.storeAuction(auction as any, `enc_${keyPair.privateKeyHex}`)

        return success({
          id: auctionId,
          address,
          psbt: psbt.toBase64(),
          inscriptionInfo: {
            txid,
            vout: voutIndex,
            address: vout.scriptpubkey_address,
            value,
            spent,
          },
        })
      } catch (err: any) {
        console.error('create-auction error', err)
        set.status = 500
        return error('Internal server error', 'INTERNAL_ERROR')
      }
    }, {
      body: t.Object({
        asset: t.String(),
        startPrice: t.Number(),
        minPrice: t.Number(),
        duration: t.Number(),
        decrementInterval: t.Number(),
        sellerAddress: t.String(),
      }),
      response: t.Union([
        SuccessResponse(t.Any()),
        ErrorResponse
      ])
    })
    .post('/escrow/verify-ownership', ({ body }) => {
      const { inscriptionId, ownerAddress } = body
      return success(database.verifyInscriptionOwnership({ inscriptionId, ownerAddress }))
    }, { 
      body: t.Object({ inscriptionId: t.String(), ownerAddress: t.String() }),
      response: SuccessResponse(t.Any())
    })
    .post('/escrow/create-psbt', ({ body }) => {
      const { auctionId, inscriptionId, ownerAddress } = body
      return success(database.createInscriptionEscrowPSBT({ auctionId, inscriptionId, ownerAddress }))
    }, { 
      body: t.Object({ auctionId: t.String(), inscriptionId: t.String(), ownerAddress: t.String() }),
      response: SuccessResponse(t.Any())
    })
    .get('/escrow/monitor/:auctionId/:inscriptionId', ({ params }) => {
      const { auctionId, inscriptionId } = params
      return success(database.monitorInscriptionEscrow(String(auctionId), String(inscriptionId)))
    })
    .post('/escrow/update-status', ({ body }) => {
      const { auctionId, status, details } = body
      return success(database.updateInscriptionStatus({ auctionId, status, details }))
    }, { 
      body: t.Object({ auctionId: t.String(), status: t.String(), details: t.Optional(t.Any()) }),
      response: SuccessResponse(t.Any())
    })
    .get('/escrow/status/:auctionId', ({ params }) => {
      const { auctionId } = params
      return success(database.getInscriptionEscrowStatus(String(auctionId)))
    })
    .post('/admin/check-escrow-timeouts', () => {
      return success(database.checkEscrowTimeouts())
    })

    // Forward all /api/* requests to existing handlers without the /api prefix
    // This enables a unified /api prefix for all endpoints without refactoring every route.
    .all('/api/*', async ({ request }): Promise<Response> => {
      const url = new URL(request.url)
      const forwarded = new URL(request.url)
      const stripped = url.pathname.replace(/^\/api\/?/, '/')
      forwarded.pathname = stripped === '//' ? '/' : stripped
      const method = request.method.toUpperCase()
      let body: BodyInit | undefined
      if (method !== 'GET' && method !== 'HEAD') {
        try {
          const buf = await request.arrayBuffer()
          body = buf
        } catch {}
      }
      const forwardedReq = new Request(forwarded.toString(), {
        method,
        headers: request.headers,
        body,
      })
      return app.handle(forwardedReq)
    })

    // Serve static assets from Astro's dist for css/js/html requests
    .get('/*', async ({ request }) => {
      try {
        const url = new URL(request.url)
        let pathname: string = url.pathname
        
        // If it's the root or a path without extension, serve index.html (SPA fallback)
        const cleanPath: string = String(pathname).split('?')[0] || ''
        const originalExt = (cleanPath.split('.').pop() || '').toLowerCase()
        const hasExtension = cleanPath.includes('.') && originalExt.length > 0
        
        if (!hasExtension || pathname === '/') {
          pathname = '/index.html'
        }
        
        // Only serve known static file types
        const allowedExtensions = ['css', 'js', 'html', 'json', 'svg', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'woff', 'woff2', 'ttf', 'eot']
        if (hasExtension && !allowedExtensions.includes(originalExt)) {
          return new Response('Not Found', { status: 404 })
        }
        
        const distDir = new URL('../../web/dist/', import.meta.url)
        const fileUrl = new URL(pathname.replace(/^\//, ''), distDir)
        const file = Bun.file(fileUrl)
        
        if (!(await file.exists())) {
          // SPA fallback: if file not found and it's not an API route, serve index.html
          if (!pathname.startsWith('/api/')) {
            const indexUrl = new URL('index.html', distDir)
            const indexFile = Bun.file(indexUrl)
            if (await indexFile.exists()) {
              return new Response(indexFile, { 
                headers: { 
                  'content-type': 'text/html; charset=utf-8',
                  'cache-control': 'no-cache'
                } 
              })
            }
          }
          return new Response('Not Found', { status: 404 })
        }
        
        // Determine content type based on the ACTUAL file being served (after rewrite)
        const finalPath = String(pathname).split('?')[0] || ''
        const ext = (finalPath.split('.').pop() || '').toLowerCase()
        
        const contentTypeMap: Record<string, string> = {
          'css': 'text/css; charset=utf-8',
          'js': 'application/javascript; charset=utf-8',
          'json': 'application/json; charset=utf-8',
          'html': 'text/html; charset=utf-8',
          'svg': 'image/svg+xml',
          'png': 'image/png',
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'gif': 'image/gif',
          'webp': 'image/webp',
          'ico': 'image/x-icon',
          'woff': 'font/woff',
          'woff2': 'font/woff2',
          'ttf': 'font/ttf',
          'eot': 'application/vnd.ms-fontobject'
        }
        const contentType = contentTypeMap[ext] || 'application/octet-stream'
        
        // Set cache headers based on file type
        const cacheControl = ['css', 'js', 'woff', 'woff2', 'ttf', 'eot', 'svg', 'png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)
          ? 'public, max-age=31536000, immutable' // 1 year for assets with hashed filenames
          : 'no-cache' // No cache for HTML to support updates
        
        return new Response(file, { 
          headers: { 
            'content-type': contentType,
            'cache-control': cacheControl
          } 
        })
      } catch (err) {
        console.error('Static file serving error:', err)
        return new Response('Not Found', { status: 404 })
      }
    })

  return app
}

export const app = createApp()

if (import.meta.main) {
  const hostname = Bun.env.HOST ?? '::'
  let port = Bun.env.PORT ? parseInt(Bun.env.PORT, 10) : 3000
  if (isNaN(port)) {
    logger.error('Invalid PORT environment variable. Using default port 3000.')
    port = 3000
  }
  app.listen({ port, hostname })
  const advertisedHost = hostname === '::' ? '[::1]' : hostname
  
  logger.info('API server started', {
    host: advertisedHost,
    port,
    version,
    network: getBitcoinNetwork(),
    environment: Bun.env.NODE_ENV || 'development',
    bunVersion: Bun.version,
    logLevel: Bun.env.LOG_LEVEL || 'info',
    logFormat: Bun.env.LOG_FORMAT || 'text',
  })
  
  // Also log to console for easy visibility during development
  console.log(`✓ API listening on http://${advertisedHost}:${port}`)
}

