import { describe, test, expect } from 'bun:test'
import { BidRulesSchema, normalizeBidRules } from '../schemas/bidRules'

describe('Bid rules schema', () => {
  test('valid fixed amount', () => {
    const data = { reservePrice: 10, minIncrement: { type: 'fixed', amount: 5 } }
    const r = BidRulesSchema.safeParse(data)
    expect(r.success).toBe(true)
  })

  test('valid percent amount', () => {
    const data = { minIncrement: { type: 'percent', percent: 12.5 } }
    const r = BidRulesSchema.safeParse(data)
    expect(r.success).toBe(true)
  })

  test('normalize fallback', () => {
    const n = normalizeBidRules({})
    expect(n.minIncrement.type).toBe('fixed')
  })
})

