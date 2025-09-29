import type { AuctionType } from '../../types/auction'

export type AuctionStatus = 'draft' | 'scheduled' | 'live' | 'ended'

export type AuctionSummary = {
  id: string
  title: string
  type: AuctionType
  status: AuctionStatus
  startTime: string
  endTime: string
  currency: string
  currentPrice: number
  highestBid?: number
  numBids?: number
  reservePrice?: number
  reserveMet?: boolean
}

export type AuctionsQuery = {
  page?: number
  pageSize?: number
  search?: string
  type?: AuctionType | 'all'
  status?: AuctionStatus | 'all'
  startDate?: string
  endDate?: string
  sort?: 'endingSoon' | 'newest' | 'priceHigh' | 'priceLow'
}

export type AuctionsResult = {
  items: AuctionSummary[]
  total: number
  page: number
  pageSize: number
}

const DEFAULT_PAGE_SIZE = 12

export function getDefaultPageSize(): number {
  return DEFAULT_PAGE_SIZE
}

export function parseQueryFromSearch(searchParams: URLSearchParams): AuctionsQuery {
  const page = Number(searchParams.get('page') || '1')
  const pageSize = Number(searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE))
  const typeParam = (searchParams.get('type') as AuctionType | 'all' | null) || 'all'
  const statusParam = (searchParams.get('status') as AuctionStatus | 'all' | null) || 'all'
  const sort = (searchParams.get('sort') as AuctionsQuery['sort']) || 'endingSoon'
  const search = searchParams.get('q') || undefined
  const startDate = searchParams.get('startDate') || undefined
  const endDate = searchParams.get('endDate') || undefined
  return { page, pageSize, type: typeParam, status: statusParam, sort, search, startDate, endDate }
}


