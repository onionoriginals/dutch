import { DateTime } from 'luxon'
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

// Module-scoped dataset to keep results stable across requests
const DATASET: AuctionSummary[] = generateDataset(200)

function generateDataset(count: number): AuctionSummary[] {
  const now = DateTime.utc()
  const items: AuctionSummary[] = []
  for (let i = 0; i < count; i++) {
    const id = `auc_${i + 1}`
    const type: AuctionType = i % 2 === 0 ? 'english' : 'dutch'
    // Distribute statuses deterministically
    const statusCycle: AuctionStatus[] = ['draft', 'scheduled', 'live', 'ended']
    const status = statusCycle[i % statusCycle.length] ?? 'draft'

    // Schedule windows
    let start = now.plus({ hours: (i % 24) - 6 }) // some past, some future
    let end = start.plus({ hours: 4 + (i % 6) })
    if (status === 'ended') {
      start = now.minus({ days: 1, hours: i % 6 })
      end = start.plus({ hours: 2 + (i % 5) })
    } else if (status === 'scheduled' || status === 'draft') {
      start = now.plus({ hours: 6 + (i % 24) })
      end = start.plus({ hours: 6 + (i % 12) })
    }

    const currency = 'USD'

    let highestBid: number | undefined
    let reservePrice: number | undefined
    let numBids: number | undefined
    let currentPrice: number
    let reserveMet: boolean | undefined

    if (type === 'english') {
      const base = 50 + (i % 20) * 5
      reservePrice = base + 100
      numBids = (i * 7) % 23
      highestBid = base + (numBids ? numBids * 10 : 0)
      // For not-live, keep current price stable
      if (status === 'live') {
        currentPrice = highestBid
      } else if (status === 'ended') {
        currentPrice = highestBid
      } else {
        currentPrice = base
      }
      reserveMet = (highestBid ?? 0) >= (reservePrice ?? Number.MAX_SAFE_INTEGER)
    } else {
      // dutch
      const startPrice = 1000 + (i % 30) * 25
      const endPrice = 200 + (i % 10) * 5
      // Simulate linear descent based on time position
      const windowMs = Math.max(1, end.toMillis() - start.toMillis())
      const position = Math.min(1, Math.max(0, (Date.now() - start.toMillis()) / windowMs))
      const livePrice = Math.max(endPrice, Math.round(startPrice - (startPrice - endPrice) * position))
      currentPrice = status === 'live' ? livePrice : status === 'ended' ? endPrice : startPrice
    }

    items.push({
      id,
      title: `${type === 'english' ? 'English' : 'Dutch'} Auction #${i + 1}`,
      type,
      status,
      startTime: start.toISO(),
      endTime: end.toISO(),
      currency,
      currentPrice,
      highestBid,
      numBids,
      reservePrice,
      reserveMet
    })
  }
  return items
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

export async function queryAuctions(params: AuctionsQuery = {}): Promise<AuctionsResult> {
  const {
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
    search,
    type = 'all',
    status = 'all',
    startDate,
    endDate,
    sort = 'endingSoon'
  } = params

  let filtered = DATASET.slice()

  if (search && search.trim()) {
    const q = search.trim().toLowerCase()
    filtered = filtered.filter((a) => a.title.toLowerCase().includes(q))
  }

  if (type !== 'all') {
    filtered = filtered.filter((a) => a.type === type)
  }

  if (status !== 'all') {
    filtered = filtered.filter((a) => a.status === status)
  }

  if (startDate) {
    const sd = DateTime.fromISO(startDate).toMillis()
    filtered = filtered.filter((a) => DateTime.fromISO(a.startTime).toMillis() >= sd)
  }

  if (endDate) {
    const ed = DateTime.fromISO(endDate).toMillis()
    filtered = filtered.filter((a) => DateTime.fromISO(a.endTime).toMillis() <= ed)
  }

  filtered.sort((a, b) => {
    switch (sort) {
      case 'newest':
        return DateTime.fromISO(b.startTime).toMillis() - DateTime.fromISO(a.startTime).toMillis()
      case 'priceHigh':
        return (b.currentPrice || 0) - (a.currentPrice || 0)
      case 'priceLow':
        return (a.currentPrice || 0) - (b.currentPrice || 0)
      case 'endingSoon':
      default:
        return DateTime.fromISO(a.endTime).toMillis() - DateTime.fromISO(b.endTime).toMillis()
    }
  })

  const total = filtered.length
  const startIdx = Math.max(0, (page - 1) * pageSize)
  const endIdx = Math.min(total, startIdx + pageSize)
  const items = filtered.slice(startIdx, endIdx)

  // Simulate latency for loading state in islands
  await new Promise((r) => setTimeout(r, 200))

  return { items, total, page, pageSize }
}

