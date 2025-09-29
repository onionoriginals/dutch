import type { EnglishAuctionInput, DutchAuctionInput, NormalizedAuctionPayload } from '../types/auction'

export function normalizeEnglish(values: EnglishAuctionInput): NormalizedAuctionPayload {
  return {
    type: 'english',
    title: values.title,
    description: values.description || undefined,
    pricing: {
      startingPrice: values.startingPrice,
      reservePrice: values.reservePrice ?? undefined,
      bidIncrement: values.bidIncrement
    },
    timing: {
      startTime: values.startTime,
      endTime: values.endTime
    }
  }
}

export function normalizeDutch(values: DutchAuctionInput): NormalizedAuctionPayload {
  return {
    type: 'dutch',
    title: values.title,
    description: values.description || undefined,
    pricing: {
      startPrice: values.startPrice,
      endPrice: values.endPrice,
      decrementAmount: values.decrementAmount,
      decrementIntervalSeconds: values.decrementIntervalSeconds,
      buyNowPrice: values.buyNowPrice ?? undefined
    },
    timing: {
      startTime: values.startTime,
      endTime: values.endTime
    }
  }
}

