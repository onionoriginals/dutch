import { app } from '../index'
import { __testUtils } from '../services/db'

const fetchApi = (path: string, init?: RequestInit) => app.handle(new Request(`http://localhost/api${path}`, init))

describe('Fee endpoints', () => {
  beforeEach(() => {
    __testUtils.reset()
    __testUtils.setFeeRates('testnet', { low: 5, medium: 10, high: 20 })
  })

  it('mocked fee rates; estimation options and categories; escalation returns higher rate', async () => {
    let res = await fetchApi('/fees/rates?network=testnet')
    expect(res.status).toBe(200)
    let json = await res.json()
    expect(json.rates.normal).toBeGreaterThan(0)

    res = await fetchApi('/fees/estimation/send?network=testnet')
    expect(res.status).toBe(200)
    json = await res.json()
    const categories = json.options.map((o: any) => o.category)
    expect(categories).toEqual(['low', 'medium', 'high'])

    res = await fetchApi('/fees/calculate', { method: 'POST', body: JSON.stringify({ network: 'testnet', category: 'medium', size: 123 }) })
    expect(res.status).toBe(200)
    json = await res.json()
    expect(json.rate).toBeGreaterThan(0)
    expect(json.fee).toBeGreaterThan(0)

    res = await fetchApi('/fees/escalate', { method: 'POST', body: JSON.stringify({ currentRate: 10, bumpPercent: 50 }) })
    expect(res.status).toBe(200)
    json = await res.json()
    expect(json.newRate).toBeGreaterThan(json.oldRate)

    res = await fetchApi('/fees/test-calculations', { method: 'POST' })
    expect(res.status).toBe(200)
    json = await res.json()
    expect(json.ok).toBe(true)
  })

  it('combined fee info for auction', async () => {
    const res = await fetchApi('/auction/auc-42/fee-info?network=testnet')
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.auctionId).toBe('auc-42')
    expect(json.rates.high).toBe(20)
  })
})

