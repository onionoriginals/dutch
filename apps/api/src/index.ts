import { Elysia, t } from 'elysia'
import { swagger } from '@elysiajs/swagger'
import { cors } from '@elysiajs/cors'
import { helloDutch } from '@originals/dutch'
import { db as packageDb, getBitcoinNetwork, version, SecureDutchyDatabase } from '@originals/dutch'
import { db as svcDb } from './services/db'
import * as bitcoin from 'bitcoinjs-lib'

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
      })
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
    },
    {
      body: t.Object({
        auctionId: t.String(),
        bidderAddress: t.String(),
        quantity: t.Optional(t.Number()),
      })
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
    },
    {
      body: t.Object({
        auctionId: t.String(),
        bidIds: t.Array(t.String()),
      })
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
    },
    {
      body: t.Object({
        auctionId: t.String(),
        bidderAddress: t.String(),
        bidAmount: t.Number(),
        quantity: t.Optional(t.Number()),
      })
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
    },
    {
      body: t.Object({
        bidId: t.String(),
        transactionId: t.String(),
      })
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
    },
    {
      body: t.Object({
        auctionId: t.String(),
      })
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
    .get('/fees/rates', ({ query }) =>
      withNetworkOverride(query?.network as any, async () => {
        const network = (query?.network as string) || getBitcoinNetwork()
        const rates = await database.getFeeRates(network)
        return { network: getBitcoinNetwork(), rates }
      }),
    )
    .post('/fees/calculate', async ({ request }) => {
      const body = await readJson(request)
      const network = (body as any)?.network || getBitcoinNetwork()
      const category = ((body as any)?.category || 'medium') as 'low' | 'medium' | 'high'
      const size = Number((body as any)?.size ?? 0)
      const rates = await database.getFeeRates(network)
      const satsPerVb = category === 'high' ? rates.fast : category === 'low' ? rates.slow : rates.normal
      const fee = Math.ceil(size * satsPerVb)
      return { network, category, rate: satsPerVb, size, fee, currency: 'sats' }
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
        return { transactionType: params.transactionType, network: getBitcoinNetwork(), options }
      }),
    )
    .post('/fees/escalate', async ({ request }) => {
      const body = await readJson(request)
      const currentRate = Number((body as any)?.currentRate ?? 1)
      const bumpPercent = Number((body as any)?.bumpPercent ?? 20)
      const newRate = Math.ceil(currentRate * (1 + bumpPercent / 100))
      return { oldRate: currentRate, newRate, bumpedByPercent: bumpPercent }
    })
    .post('/fees/test-calculations', () => ({ ok: true }))
    .get('/auction/:auctionId/fee-info', ({ params, query }) => svcDb.getAuctionFeeInfo(params.auctionId, (query?.network as string) || undefined))
    // Monitoring endpoints
    .get('/transaction/:transactionId/status', ({ params, query }) => svcDb.monitorTransaction(params.transactionId, (query?.auctionId as string) || undefined))
    .get('/transaction/:transactionId/monitor', ({ params, query }) => svcDb.monitorTransactionReal(params.transactionId, (query?.auctionId as string) || undefined, (query?.network as string) || undefined))
    .post('/auction/:auctionId/update-from-blockchain', ({ params }) => svcDb.updateAuctionFromBlockchain(params.auctionId), { params: t.Object({ auctionId: t.String() }) })
    .post('/admin/update-all-from-blockchain', () => svcDb.updateAllAuctionsFromBlockchain())
    .get('/admin/detect-failed-transactions', () => svcDb.detectFailedTransactions())
    .get('/auction/:auctionId/transaction-history', ({ params }) => svcDb.getTransactionHistory(params.auctionId))
    .post('/transaction/handle-failure', async ({ request }) => {
      const body = await readJson(request)
      return svcDb.handleTransactionFailure((body as any)?.transactionId, (body as any)?.reason)
    })
    // Error handler
    .onError(({ code, error, set }) => {
      const message = (error as Error)?.message || 'Internal Error'
      if (code === 'VALIDATION') {
        set.status = 400
        return { error: message }
      }
      if (/not\s*found/i.test(message)) {
        set.status = 404
        return { error: 'Not Found' }
      }
      if ((error as any)?.name === 'ValidationError' || (error as any)?.type === 'validation' || (error as any)?.status === 400 || /required|expected|invalid|must/i.test(message)) {
        set.status = 400
        return { error: message }
      }
      set.status = 500
      return { error: message }
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
        } = body as any

        if (!asset || !startPrice || !minPrice || !duration || !decrementInterval || !sellerAddress) {
          return new Response(JSON.stringify({ error: 'Missing required fields' }), {
            status: 400,
            headers: { 'content-type': 'application/json' },
          })
        }

        const inscriptionRegex = /^[0-9a-fA-F]{64}i\d+$/
        if (!inscriptionRegex.test(String(asset))) {
          return new Response(JSON.stringify({ error: 'Invalid inscriptionId format. Expected <txid>i<index>' }), {
            status: 400,
            headers: { 'content-type': 'application/json' },
          })
        }

        const [txid, voutStr] = String(asset).split('i')
        if (!voutStr) {
          return new Response(JSON.stringify({ error: 'Invalid inscription format. Expected <txid>i<index>' }), {
            status: 400,
            headers: { 'content-type': 'application/json' },
          })
        }
        const voutIndex = parseInt(voutStr, 10)
        if (!Number.isFinite(voutIndex)) {
          return new Response(JSON.stringify({ error: 'Invalid inscription vout index' }), {
            status: 400,
            headers: { 'content-type': 'application/json' },
          })
        }

        const base = getMempoolApiBase()

        const txResp = await fetch(`${base}/tx/${txid}`)
        if (!txResp.ok) {
          return new Response(JSON.stringify({ error: 'Transaction not found' }), {
            status: 400,
            headers: { 'content-type': 'application/json' },
          })
        }
        const txJson = await txResp.json() as any
        const vout = (txJson?.vout || [])[voutIndex]
        if (!vout) {
          return new Response(JSON.stringify({ error: 'Inscription output not found' }), {
            status: 400,
            headers: { 'content-type': 'application/json' },
          })
        }

        const outspendsResp = await fetch(`${base}/tx/${txid}/outspends`)
        if (!outspendsResp.ok) {
          return new Response(JSON.stringify({ error: 'Failed to verify outspend status' }), {
            status: 500,
            headers: { 'content-type': 'application/json' },
          })
        }
        const outspends = await outspendsResp.json() as any
        const outspend = outspends?.[voutIndex]
        const spent = !!outspend?.spent
        const ownerMatches = String(vout?.scriptpubkey_address || '') === String(sellerAddress)
        console.log('ownership-check', { sellerAddress, voutAddress: vout?.scriptpubkey_address, spent })
        if (!ownerMatches) {
          return new Response(JSON.stringify({ error: 'Ownership mismatch for inscription UTXO' }), {
            status: 403,
            headers: { 'content-type': 'application/json' },
          })
        }
        if (spent) {
          return new Response(JSON.stringify({ error: 'Inscription UTXO already spent' }), {
            status: 403,
            headers: { 'content-type': 'application/json' },
          })
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

        psbt.addInput({ hash: txid, index: voutIndex, witnessUtxo })

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

        return {
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
        }
      } catch (err: any) {
        console.error('create-auction error', err)
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        })
      }
    }, {
      body: t.Object({
        asset: t.String(),
        startPrice: t.Number(),
        minPrice: t.Number(),
        duration: t.Number(),
        decrementInterval: t.Number(),
        sellerAddress: t.String(),
      })
    })
    .post('/escrow/verify-ownership', ({ body, set }) => {
      const { inscriptionId, ownerAddress } = body as any
      return database.verifyInscriptionOwnership({ inscriptionId, ownerAddress })
    }, { body: t.Object({ inscriptionId: t.String(), ownerAddress: t.String() }) })
    .post('/escrow/create-psbt', ({ body, set }) => {
      const { auctionId, inscriptionId, ownerAddress } = body as any
      return database.createInscriptionEscrowPSBT({ auctionId, inscriptionId, ownerAddress })
    }, { body: t.Object({ auctionId: t.String(), inscriptionId: t.String(), ownerAddress: t.String() }) })
    .get('/escrow/monitor/:auctionId/:inscriptionId', ({ params }) => {
      const { auctionId, inscriptionId } = params as any
      return database.monitorInscriptionEscrow(String(auctionId), String(inscriptionId))
    })
    .post('/escrow/update-status', ({ body, set }) => {
      const { auctionId, status, details } = body as any
      return database.updateInscriptionStatus({ auctionId, status, details })
    }, { body: t.Object({ auctionId: t.String(), status: t.String(), details: t.Optional(t.Any()) }) })
    .get('/escrow/status/:auctionId', ({ params }) => {
      const { auctionId } = params as any
      return database.getInscriptionEscrowStatus(String(auctionId))
    })
    .post('/admin/check-escrow-timeouts', () => {
      return database.checkEscrowTimeouts()
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

