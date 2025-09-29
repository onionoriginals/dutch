import { z } from 'zod'

export const BidIncrementSchema = z.union([
  z.object({ type: z.literal('fixed'), amount: z.number().min(0) }),
  z.object({ type: z.literal('percent'), percent: z.number().min(0).max(100) })
])

export const BidRulesSchema = z.object({
  reservePrice: z.number().min(0).optional(),
  minIncrement: BidIncrementSchema
})

export type BidRules = z.infer<typeof BidRulesSchema>

export function normalizeBidRules(input: unknown): BidRules {
  const res = BidRulesSchema.safeParse(input)
  if (res.success) return res.data
  // Provide sensible defaults if missing
  return { minIncrement: { type: 'fixed', amount: 0 } }
}

