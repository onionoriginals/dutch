import { Elysia } from 'elysia'
import { swagger } from '@elysiajs/swagger'
import { cors } from '@elysiajs/cors'
import { helloDutch } from '@originals/dutch'
import { db } from './services/db'

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

const app = new Elysia()
  .use(cors())
  .use(swagger())
  .get('/', () => ({ ok: true }))
  .get('/hello', () => ({ message: helloDutch('World') }))
  // Recovery (Task 5)
  .get('/recovery/auction/:auctionId', ({ params }) => db.recoverAuctionFromSeed(params.auctionId))
  .get('/recovery/all', () => db.recoverAllAuctionsFromSeed())
  .get('/recovery/verify/:auctionId', ({ params }) => db.verifyAuctionRecovery(params.auctionId))
  .post('/api/recovery/simulate-disaster', () => db.simulateDisasterRecovery())
  .get('/api/recovery/status', () => db.getRecoveryStatus())
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
  // Seed (Task 4)
  .post('/seed/validate', async ({ request }) => {
    const body = await readJson(request)
    return db.validateSeedPhrase((body as any)?.seed)
  })
  .post('/seed/import', async ({ request }) => {
    const body = await readJson(request)
    return db.importMasterSeed((body as any)?.seed)
  })
  .post('/seed/rotate', async ({ request }) => {
    const body = await readJson(request)
    return db.rotateMasterSeed((body as any)?.newSeed)
  })
  .get('/seed/backup-with-warnings', () => db.getMasterSeedWithWarnings())
  .get('/seed/status', () => db.getSeedManagementStatus())
  // Security (Task 3)
  .get('/security/audit-logs', ({ query }) => db.getAuditLogs(query?.limit ? Number(query.limit) : undefined, query?.operation as string | undefined))
  .post('/security/test-encryption', async ({ request }) => {
    const body = await readJson(request)
    return db.testEncryptionRoundTrip((body as any)?.plaintext)
  })
  .get('/security/verify-backup/:auctionId', ({ params }) => db.verifyKeyBackup(params.auctionId))
  .post('/security/emergency-export', async ({ request }) => {
    const body = await readJson(request)
    return db.emergencyExportKeys(Boolean((body as any)?.includePrivateKeys))
  })
  // Fees (Task 10)
  .get('/fees/rates', ({ query }) => db.getFeeRates((query?.network as string) || undefined, query?.refresh === 'true'))
  .post('/fees/calculate', async ({ request }) => {
    const body = await readJson(request)
    return db.calculateTransactionFee(body as any)
  })
  .get('/fees/estimation/:transactionType', ({ params, query }) => db.getFeeEstimationDisplay(params.transactionType, (query?.network as string) || undefined))
  .post('/fees/escalate', async ({ request }) => {
    const body = await readJson(request)
    return db.escalateTransactionFee(body as any)
  })
  .post('/fees/test-calculations', () => db.testFeeCalculations())
  .get('/auction/:auctionId/fee-info', ({ params, query }) => db.getAuctionFeeInfo(params.auctionId, (query?.network as string) || undefined))
  // Monitoring (Task 9)
  .get('/transaction/:transactionId/status', ({ params, query }) => db.monitorTransaction(params.transactionId, (query?.auctionId as string) || undefined))
  .get('/transaction/:transactionId/monitor', ({ params, query }) => db.monitorTransactionReal(params.transactionId, (query?.auctionId as string) || undefined, (query?.network as string) || undefined))
  .post('/auction/:auctionId/update-from-blockchain', ({ params }) => db.updateAuctionFromBlockchain(params.auctionId))
  .post('/admin/update-all-from-blockchain', () => db.updateAllAuctionsFromBlockchain())
  .get('/admin/detect-failed-transactions', () => db.detectFailedTransactions())
  .get('/auction/:auctionId/transaction-history', ({ params }) => db.getTransactionHistory(params.auctionId))
  .post('/transaction/handle-failure', async ({ request }) => {
    const body = await readJson(request)
    return db.handleTransactionFailure((body as any)?.transactionId, (body as any)?.reason)
  })
  .onError(({ error, set }) => {
    const message = (error as Error)?.message || 'Internal Error'
    if (/required/i.test(message)) {
      set.status = 400
      return { error: message }
    }
    set.status = 500
    return { error: message }
  })

export { app }

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
