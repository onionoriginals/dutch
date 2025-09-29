import { z } from 'zod';

export const pricingRuleSchema = z.object({
  type: z.enum(['english', 'dutch', 'sealed-bid']),
  startPrice: z.number().nonnegative(),
  floorPrice: z.number().nonnegative().optional(),
  bidIncrement: z.number().positive().optional(),
});

export const schedulePointSchema = z.object({
  t: z.number().nonnegative(),
  price: z.number().nonnegative(),
});

export const scheduleSchema = z.object({
  points: z.array(schedulePointSchema).min(2),
});

export const feeSchema = z.object({
  name: z.string(),
  amount: z.number().nonnegative(),
  type: z.enum(['flat', 'percent']).default('flat'),
});

export const timingSchema = z.object({
  startAt: z.string(),
  endAt: z.string(),
  extensionWindowSeconds: z.number().nonnegative().optional(),
});

export const auctionSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  currency: z.string().default('USD'),
  lots: z.number().int().positive(),
  pricing: pricingRuleSchema,
  schedule: scheduleSchema.optional(),
  timing: timingSchema,
  fees: z.array(feeSchema).default([]),
});

export type Auction = z.infer<typeof auctionSchema>;

export function parseAuctionFromQuery(q: Record<string, string | string[] | undefined>): Auction | null {
  const payload = q.state ?? q.s;
  if (!payload || Array.isArray(payload)) return null;
  try {
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return auctionSchema.parse(json);
  } catch {
    return null;
  }
}

export function encodeAuctionToQuery(a: Auction): string {
  const json = JSON.stringify(a);
  return Buffer.from(json).toString('base64url');
}

export function computeWarnings(a: Auction): string[] {
  const warnings: string[] = [];
  if (a.pricing.floorPrice !== undefined && a.pricing.floorPrice < (a.pricing.startPrice * 0.2)) {
    warnings.push('Floor price is very low relative to start price.');
  }
  const start = new Date(a.timing.startAt).getTime();
  const end = new Date(a.timing.endAt).getTime();
  if (end - start < 30 * 60 * 1000) warnings.push('Auction duration is shorter than 30 minutes.');
  return warnings;
}
