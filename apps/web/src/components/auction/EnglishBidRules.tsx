import React, { useId } from 'react'
import { z } from 'zod'
import { formatCurrency, normalizeNumberInput } from '../../utils/currency'

export const BidIncrementSchema = z.union([
  z.object({ type: z.literal('fixed'), amount: z.number().min(0) }),
  z.object({ type: z.literal('percent'), percent: z.number().min(0).max(100) })
])

export const BidRulesSchema = z.object({
  reservePrice: z.number().min(0).optional(),
  minIncrement: BidIncrementSchema
})

export type BidRules = z.infer<typeof BidRulesSchema>

export type EnglishBidRulesProps = {
  value: BidRules
  onChange: (next: BidRules) => void
  currency?: string
  locale?: string
}

export function EnglishBidRules({ value, onChange, currency = 'USD', locale }: EnglishBidRulesProps) {
  const ids = {
    reserve: useId(),
    incType: useId(),
    fixedAmt: useId(),
    percent: useId()
  }

  const reserveStr = value.reservePrice != null ? String(value.reservePrice) : ''
  const incType = value.minIncrement.type
  const fixedStr = incType === 'fixed' ? String(value.minIncrement.amount) : ''
  const pctStr = incType === 'percent' ? String(value.minIncrement.percent) : ''

  function setReserve(input: string) {
    const n = normalizeNumberInput(input)
    onChange({
      ...value,
      reservePrice: Number.isFinite(n) && n >= 0 ? n : undefined
    })
  }

  function setIncType(t: 'fixed' | 'percent') {
    if (t === 'fixed') {
      onChange({ ...value, minIncrement: { type: 'fixed', amount: 0 } })
    } else {
      onChange({ ...value, minIncrement: { type: 'percent', percent: 0 } })
    }
  }

  function setFixed(input: string) {
    const n = normalizeNumberInput(input)
    onChange({ ...value, minIncrement: { type: 'fixed', amount: Number.isFinite(n) && n >= 0 ? n : 0 } })
  }

  function setPercent(input: string) {
    const n = normalizeNumberInput(input)
    let pct = Number.isFinite(n) && n >= 0 ? n : 0
    if (pct > 100) pct = 100
    onChange({ ...value, minIncrement: { type: 'percent', percent: pct } })
  }

  const r = BidRulesSchema.safeParse(value)
  const reserveErr = value.reservePrice != null && value.reservePrice < 0
    ? 'Must be nonnegative'
    : undefined
  const incErr = !r.success ? 'Invalid increment' : undefined

  const exampleNextBid = (() => {
    const current = 100
    if (incType === 'fixed') return current + (value.minIncrement.amount || 0)
    return current + (current * (value.minIncrement.percent || 0) / 100)
  })()

  return (
    <fieldset>
      <legend>English auction bid rules</legend>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div>
          <label htmlFor={ids.reserve}>Reserve price (optional)</label>
          <input
            id={ids.reserve}
            inputMode="decimal"
            type="text"
            value={reserveStr}
            onChange={e => setReserve(e.target.value)}
            aria-invalid={Boolean(reserveErr)}
            title="Optional. Nonnegative amount in auction currency."
          />
          {reserveErr && <div role="alert" style={{ color: 'crimson' }}>{reserveErr}</div>}
          <div style={{ fontSize: '0.9em' }}>
            Example: {formatCurrency(1500, currency, locale)}
          </div>
        </div>

        <div>
          <label htmlFor={ids.incType}>Minimum bid increment</label>
          <select id={ids.incType} value={incType} onChange={e => setIncType(e.target.value as any)}>
            <option value="fixed">Fixed amount</option>
            <option value="percent">Percentage</option>
          </select>

          {incType === 'fixed' ? (
            <div>
              <label htmlFor={ids.fixedAmt}>Amount</label>
              <input
                id={ids.fixedAmt}
                inputMode="decimal"
                type="text"
                value={fixedStr}
                onChange={e => setFixed(e.target.value)}
                title="Minimum increment as a fixed, nonnegative amount."
              />
              <div style={{ fontSize: '0.9em' }}>
                Example: if current bid is {formatCurrency(100, currency, locale)}, next minimum is {formatCurrency(exampleNextBid, currency, locale)}
              </div>
            </div>
          ) : (
            <div>
              <label htmlFor={ids.percent}>Percent</label>
              <input
                id={ids.percent}
                inputMode="decimal"
                type="text"
                value={pctStr}
                onChange={e => setPercent(e.target.value)}
                title="Minimum increment as a percentage (0–100)."
              />
              <div style={{ fontSize: '0.9em' }}>
                Example: if current bid is {formatCurrency(100, currency, locale)}, next minimum is {formatCurrency(exampleNextBid, currency, locale)}
              </div>
            </div>
          )}

          {incErr && <div role="alert" style={{ color: 'crimson' }}>{incErr}</div>}
        </div>
      </div>
    </fieldset>
  )
}

export default EnglishBidRules

