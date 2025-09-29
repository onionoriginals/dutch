import type { EnglishAuction, DutchAuction } from '../lib/validation/auction'

export type AuctionType = 'english' | 'dutch'

export type EnglishAuctionInput = EnglishAuction
export type DutchAuctionInput = DutchAuction

export type NormalizedEnglishPayload = {
  type: 'english'
  title: string
  description?: string
  pricing: {
    startingPrice: number
    reservePrice?: number
    bidIncrement: number
  }
  timing: {
    startTime: string
    endTime: string
  }
}

export type NormalizedDutchPayload = {
  type: 'dutch'
  title: string
  description?: string
  pricing: {
    startPrice: number
    endPrice: number
    decrementAmount: number
    decrementIntervalSeconds: number
    buyNowPrice?: number
  }
  timing: {
    startTime: string
    endTime: string
  }
}

export type NormalizedAuctionPayload = NormalizedEnglishPayload | NormalizedDutchPayload

