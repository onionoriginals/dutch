import { DateTime } from 'luxon'
import type { AuctionsQuery, AuctionsResult, AuctionSummary } from './common'

const API_BASE: string = (import.meta as any)?.env?.PUBLIC_API_BASE || 'http://localhost:3000'

type ApiAuction = {
  id: string
  status: 'active' | 'sold' | 'expired'
  start_time: number
  end_time: number
  auction_type?: 'single' | 'clearing'
  current_price?: number
  title?: string
  pricing?: { currentPriceLinear?: number; currentPriceStepped?: number }
}

function mapStatus(s: ApiAuction['status']): 'draft' | 'scheduled' | 'live' | 'ended' {
  if (s === 'active') return 'live'
  return 'ended'
}

function mapType(t?: ApiAuction['auction_type']): 'english' | 'dutch' {
  // Current API supports dutch-style pricing for 'single' and 'clearing'
  return 'dutch'
}

function normalize(api: ApiAuction): AuctionSummary {
  const startIso = DateTime.fromSeconds(api.start_time || 0).toISO()
  const endIso = DateTime.fromSeconds(api.end_time || 0).toISO()
  const price = api.pricing?.currentPriceLinear ?? api.current_price ?? 0
  return {
    id: api.id,
    title: api.title || `${mapType(api.auction_type)} auction ${api.id.slice(0, 8)}`,
    type: mapType(api.auction_type),
    status: mapStatus(api.status),
    startTime: startIso || new Date(0).toISOString(),
    endTime: endIso || new Date(0).toISOString(),
    currency: 'USD',
    currentPrice: price,
  }
}

export async function queryAuctions(params: AuctionsQuery = {}): Promise<AuctionsResult> {
  const {
    page = 1,
    pageSize = 12,
    search,
    type = 'all',
    status = 'all',
    startDate,
    endDate,
    sort = 'endingSoon',
  } = params

  const qs = new URLSearchParams()
  // Map status/type to API if possible
  if (status === 'live') qs.set('status', 'active')
  if (status === 'ended') qs.set('status', 'expired')
  if (type && type !== 'all') qs.set('type', 'single')

  const url = `${API_BASE}/auctions?${qs.toString()}`
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`API error ${resp.status}`)
  const json = await resp.json() as { ok?: boolean; items?: ApiAuction[] }
  const rawItems = (json.items || []).map(normalize)

  // Client-side filters/sorts for fields not supported server-side yet
  let items = rawItems
  if (search && search.trim()) {
    const q = search.trim().toLowerCase()
    items = items.filter((a) => a.title.toLowerCase().includes(q))
  }
  if (type !== 'all') {
    items = items.filter((a) => a.type === type)
  }
  if (status !== 'all') {
    items = items.filter((a) => a.status === status)
  }
  if (startDate) {
    const sd = DateTime.fromISO(startDate).toMillis()
    items = items.filter((a) => DateTime.fromISO(a.startTime).toMillis() >= sd)
  }
  if (endDate) {
    const ed = DateTime.fromISO(endDate).toMillis()
    items = items.filter((a) => DateTime.fromISO(a.endTime).toMillis() <= ed)
  }

  items.sort((a, b) => {
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

  const total = items.length
  const startIdx = Math.max(0, (page - 1) * pageSize)
  const endIdx = Math.min(total, startIdx + pageSize)
  const paged = items.slice(startIdx, endIdx)

  return { items: paged, total, page, pageSize }
}


