import { app } from '../index'
import { __testUtils } from '../services/db'

const fetchApi = (path: string, init?: RequestInit) => app.handle(new Request(`http://localhost/api${path}`, init))

describe('Monitoring endpoints', () => {
  beforeEach(() => {
    __testUtils.reset()
  })

  it('monitor transaction simulated and real transitions', async () => {
    let res = await fetchApi('/transaction/tx-1/status?auctionId=auc-1')
    expect(res.status).toBe(200)
    let json = await res.json()
    expect(json.status).toBe('pending')

    res = await fetchApi('/transaction/tx-1/monitor?auctionId=auc-1&network=signet')
    expect(res.status).toBe(200)
    json = await res.json()
    expect(['broadcast', 'confirmed']).toContain(json.status)

    res = await fetchApi('/transaction/tx-1/monitor?auctionId=auc-1&network=signet')
    expect(res.status).toBe(200)
    json = await res.json()
    expect(json.status).toBe('confirmed')
  })

  it('update from blockchain and transaction history', async () => {
    let res = await fetchApi('/auction/auc-3/update-from-blockchain', { method: 'POST' })
    expect(res.status).toBe(200)
    res = await fetchApi('/auction/auc-3/transaction-history')
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(Array.isArray(json.transactions)).toBe(true)
    expect(json.transactions.length).toBeGreaterThan(0)
  })

  it('handle failure and detect failed transactions', async () => {
    let res = await fetchApi('/transaction/handle-failure', { method: 'POST', body: JSON.stringify({ transactionId: 'tx-fail-1', reason: 'insufficient fee' }) })
    expect(res.status).toBe(200)
    res = await fetchApi('/admin/detect-failed-transactions')
    expect(res.status).toBe(200)
    const json = await res.json()
    const ids = json.failed.map((f: any) => f.id)
    expect(ids).toContain('tx-fail-1')
  })
})

