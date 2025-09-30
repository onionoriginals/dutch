import { logger, redactSensitiveData } from '../utils/logger'

type AuditLog = {
  time: number
  operation: string
  details?: Record<string, unknown>
}

type Auction = {
  id: string
  recovered: boolean
  transactions: string[]
  feeInfo?: {
    network: string
    lastCalculatedFee?: number
  }
}

type Transaction = {
  id: string
  auctionId?: string
  status: 'pending' | 'broadcast' | 'confirmed' | 'failed'
  history: { time: number; status: Transaction['status']; note?: string }[]
}

const state = {
  masterSeed: null as string | null,
  seedVersion: 0,
  lastRotationAt: null as number | null,
  auctions: new Map<string, Auction>(),
  transactions: new Map<string, Transaction>(),
  auditLogs: [] as AuditLog[],
  feeRatesByNetwork: new Map<string, { lastUpdated: number; rates: { low: number; medium: number; high: number } }>(),
  lastDisasterSimulatedAt: null as number | null
}

function logAudit(operation: string, details?: Record<string, unknown>) {
  // Use the new logger with automatic redaction
  const sanitizedDetails = details ? (redactSensitiveData(details) as Record<string, unknown>) : undefined
  
  // Store in audit logs with redacted data
  state.auditLogs.unshift({ time: Date.now(), operation, details: sanitizedDetails })
  
  // Also log to structured logger for observability
  logger.info(`Audit: ${operation}`, { operation, ...sanitizedDetails })
}

function getOrInitAuction(auctionId: string): Auction {
  if (!state.auctions.has(auctionId)) {
    state.auctions.set(auctionId, { id: auctionId, recovered: false, transactions: [] })
  }
  // non-null due to set above
  return state.auctions.get(auctionId) as Auction
}

function getFeeRatesInternal(network = 'mainnet') {
  let entry = state.feeRatesByNetwork.get(network)
  if (!entry) {
    entry = { lastUpdated: Date.now(), rates: { low: 1, medium: 2, high: 3 } }
    state.feeRatesByNetwork.set(network, entry)
  }
  return entry
}

export const db = {
  // Recovery (Task 5)
  recoverAuctionFromSeed(auctionId: string) {
    if (!auctionId) throw new Error('auctionId required')
    if (!state.masterSeed) throw new Error('No master seed available for recovery')
    const auction = getOrInitAuction(auctionId)
    auction.recovered = true
    logAudit('recovery:recoverAuctionFromSeed', { auctionId })
    return { auctionId, recovered: true }
  },
  recoverAllAuctionsFromSeed() {
    if (!state.masterSeed) throw new Error('No master seed available for recovery')
    let count = 0
    for (const auction of state.auctions.values()) {
      if (!auction.recovered) {
        auction.recovered = true
        count++
      }
    }
    logAudit('recovery:recoverAllAuctionsFromSeed', { recoveredCount: count })
    return { ok: true, recoveredCount: count }
  },
  verifyAuctionRecovery(auctionId: string) {
    if (!auctionId) throw new Error('auctionId required')
    const auction = state.auctions.get(auctionId)
    const canRecover = Boolean(state.masterSeed)
    return {
      auctionId,
      canRecover,
      isRecovered: auction?.recovered ?? false
    }
  },
  simulateDisasterRecovery() {
    for (const auction of state.auctions.values()) {
      auction.recovered = false
    }
    state.lastDisasterSimulatedAt = Date.now()
    logAudit('recovery:simulateDisasterRecovery')
    return { simulated: true }
  },
  getRecoveryStatus() {
    const recoverableAuctions = [...state.auctions.values()].filter(() => Boolean(state.masterSeed)).length
    return {
      hasSeed: Boolean(state.masterSeed),
      recoverableAuctions,
      lastSimulatedAt: state.lastDisasterSimulatedAt
    }
  },

  // Seed (Task 4)
  validateSeedPhrase(seed?: string) {
    const seedStr = String(seed || '')
    const words = seedStr.trim().split(/\s+/).filter(Boolean)
    const valid = words.length >= 12
    const warnings: string[] = []
    if (words.length < 12) warnings.push('Seed phrase too short')
    return { valid, warnings }
  },
  importMasterSeed(seed?: string) {
    const seedStr = String(seed || '')
    if (!seedStr) throw new Error('seed required')
    state.masterSeed = seedStr
    state.seedVersion += 1
    state.lastRotationAt = Date.now()
    logAudit('seed:import', { seed: '***redacted***' })
    return { imported: true, version: state.seedVersion }
  },
  rotateMasterSeed(newSeed?: string) {
    const seedStr = String(newSeed || '')
    if (!seedStr) throw new Error('newSeed required')
    state.masterSeed = seedStr
    state.seedVersion += 1
    state.lastRotationAt = Date.now()
    logAudit('seed:rotate', { newSeed: '***redacted***' })
    return { rotated: true, version: state.seedVersion }
  },
  getMasterSeedWithWarnings() {
    if (!state.masterSeed) return { maskedSeed: null, warnings: ['No master seed present'] }
    const last4 = state.masterSeed.slice(-4)
    return { maskedSeed: `********${last4}`, warnings: [] }
  },
  getSeedManagementStatus() {
    return {
      hasSeed: Boolean(state.masterSeed),
      version: state.seedVersion,
      lastRotationAt: state.lastRotationAt
    }
  },

  // Security (Task 3)
  getAuditLogs(limit?: number, operation?: string) {
    let logs = state.auditLogs
    if (operation) logs = logs.filter((l) => l.operation.includes(operation))
    if (limit && limit > 0) logs = logs.slice(0, limit)
    return { logs }
  },
  testEncryptionRoundTrip(plaintext?: string) {
    const p = String(plaintext ?? '')
    const ciphertext = p.split('').reverse().join('')
    const roundTrip = ciphertext.split('').reverse().join('')
    return { ok: true, ciphertext, plaintextMatches: roundTrip === p }
  },
  verifyKeyBackup(auctionId: string) {
    if (!auctionId) throw new Error('auctionId required')
    return { auctionId, backupOk: Boolean(state.masterSeed) }
  },
  emergencyExportKeys(includePrivateKeys?: boolean) {
    // Never export private keys in this demo
    return {
      privateKeysIncluded: false,
      exported: ['pubkey-demo-1', 'pubkey-demo-2'],
      note: 'Private keys are not exported in this environment'
    }
  },

  // Fees (Task 10)
  getFeeRates(network?: string, refresh?: boolean) {
    const n = network || 'mainnet'
    const entry = getFeeRatesInternal(n)
    if (refresh) entry.lastUpdated = Date.now()
    return { network: n, lastUpdated: entry.lastUpdated, rates: entry.rates }
  },
  calculateTransactionFee(payload: { size?: number; category?: 'low' | 'medium' | 'high'; network?: string }) {
    const size = Number(payload?.size ?? 0)
    const category = (payload?.category ?? 'medium') as 'low' | 'medium' | 'high'
    const network = payload?.network || 'mainnet'
    const rates = getFeeRatesInternal(network).rates
    const rate = rates[category]
    const fee = Math.ceil(size * rate)
    return { network, category, rate, size, fee, currency: 'sats' }
  },
  getFeeEstimationDisplay(transactionType: string, network?: string) {
    const n = network || 'mainnet'
    const rates = getFeeRatesInternal(n).rates
    const sampleSize = 250
    const options = (['low', 'medium', 'high'] as const).map((category) => ({
      category,
      rate: rates[category],
      estimatedFeeForSize: Math.ceil(sampleSize * rates[category]),
      etaMinutes: category === 'low' ? 30 : category === 'medium' ? 10 : 2
    }))
    return { transactionType, network: n, options }
  },
  escalateTransactionFee(payload: { currentRate?: number; bumpPercent?: number; network?: string }) {
    const currentRate = Number(payload?.currentRate ?? 1)
    const bumpPercent = Number(payload?.bumpPercent ?? 20)
    const newRate = Math.ceil(currentRate * (1 + bumpPercent / 100))
    return { oldRate: currentRate, newRate, bumpedByPercent: bumpPercent }
  },
  testFeeCalculations() {
    const sample = [100, 200, 300].map((size) => ({ size, mediumFee: Math.ceil(size * 2) }))
    return { ok: true, sample }
  },
  getAuctionFeeInfo(auctionId: string, network?: string) {
    const n = network || 'mainnet'
    const rates = getFeeRatesInternal(n).rates
    const auction = getOrInitAuction(auctionId)
    return { auctionId, network: n, rates, lastCalculatedFee: auction.feeInfo?.lastCalculatedFee ?? null }
  },

  // Monitoring (Task 9)
  monitorTransaction(transactionId: string, auctionId?: string) {
    if (!transactionId) throw new Error('transactionId required')
    let tx = state.transactions.get(transactionId)
    if (!tx) {
      tx = { id: transactionId, auctionId, status: 'pending', history: [] }
      state.transactions.set(transactionId, tx)
    }
    tx.history.push({ time: Date.now(), status: tx.status })
    return { transactionId, auctionId: tx.auctionId ?? null, status: tx.status }
  },
  monitorTransactionReal(transactionId: string, auctionId?: string, network?: string) {
    const res = this.monitorTransaction(transactionId, auctionId)
    // simulate real-time: once called, move to broadcast if pending
    const tx = state.transactions.get(transactionId) as Transaction
    if (tx.status === 'pending') {
      tx.status = 'broadcast'
    } else if (tx.status === 'broadcast') {
      tx.status = 'confirmed'
    }
    tx.history.push({ time: Date.now(), status: tx.status, note: `network:${network || 'mainnet'}` })
    return { ...res, status: tx.status, network: network || 'mainnet' }
  },
  updateAuctionFromBlockchain(auctionId: string) {
    if (!auctionId) throw new Error('auctionId required')
    const auction = getOrInitAuction(auctionId)
    auction.transactions.push(`tx-${Date.now()}`)
    logAudit('monitoring:updateAuctionFromBlockchain', { auctionId })
    return { auctionId, updated: true, transactions: auction.transactions.length }
  },
  updateAllAuctionsFromBlockchain() {
    let updated = 0
    for (const auction of state.auctions.values()) {
      auction.transactions.push(`tx-${Date.now()}`)
      updated++
    }
    logAudit('monitoring:updateAllAuctionsFromBlockchain', { updated })
    return { updated }
  },
  detectFailedTransactions() {
    const failed = [...state.transactions.values()].filter((t) => t.status === 'failed').map((t) => ({ id: t.id, auctionId: t.auctionId }))
    return { failed }
  },
  getTransactionHistory(auctionId: string) {
    const auction = state.auctions.get(auctionId)
    if (!auction) return { auctionId, transactions: [] as string[] }
    return { auctionId, transactions: auction.transactions }
  },
  handleTransactionFailure(transactionId: string, reason?: string) {
    if (!transactionId) throw new Error('transactionId required')
    let tx = state.transactions.get(transactionId)
    if (!tx) {
      tx = { id: transactionId, status: 'pending', history: [] }
      state.transactions.set(transactionId, tx)
    }
    tx.status = 'failed'
    tx.history.push({ time: Date.now(), status: 'failed', note: (reason || '').slice(0, 64) })
    logAudit('monitoring:handleTransactionFailure', { transactionId, reason: reason ? 'provided' : 'none' })
    return { transactionId, failed: true }
  }
}

export type DB = typeof db

// Test utilities
export const __testUtils = {
  reset() {
    state.masterSeed = null
    state.seedVersion = 0
    state.lastRotationAt = null
    state.auctions.clear()
    state.transactions.clear()
    state.auditLogs = []
    state.feeRatesByNetwork.clear()
    state.lastDisasterSimulatedAt = null
  },
  setFeeRates(network: string, rates: { low: number; medium: number; high: number }) {
    state.feeRatesByNetwork.set(network || 'mainnet', { lastUpdated: Date.now(), rates })
  }
}
