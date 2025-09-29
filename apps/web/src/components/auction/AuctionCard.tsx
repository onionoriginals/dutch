import React from 'react'
import type { AuctionType } from '../../types/auction'
import { formatCurrency } from '../../utils/currency'
import { DateTime } from 'luxon'

export type AuctionCardProps = {
  id: string
  title: string
  type: AuctionType
  status: 'draft' | 'scheduled' | 'live' | 'ended'
  startTime: string
  endTime: string
  currency: string
  currentPrice: number
  highestBid?: number
  numBids?: number
  reservePrice?: number
  reserveMet?: boolean
  onQuickAction?: (id: string, action: 'view' | 'edit' | 'cancel' | 'share') => void
}

export default function AuctionCard(props: AuctionCardProps) {
  const {
    id,
    title,
    type,
    status,
    startTime,
    endTime,
    currency,
    currentPrice,
    highestBid,
    numBids,
    reservePrice,
    reserveMet,
    onQuickAction
  } = props

  const now = Date.now()
  const endMs = DateTime.fromISO(endTime).toMillis()
  const startMs = DateTime.fromISO(startTime).toMillis()
  const isLive = status === 'live'
  const isScheduled = status === 'scheduled'
  const isEnded = status === 'ended'

  const timeLabel = React.useMemo(() => {
    const dt = isLive ? endMs : isScheduled ? startMs : endMs
    const diff = dt - now
    const abs = Math.abs(diff)
    const minutes = Math.ceil(abs / 60000)
    if (isScheduled) return `Starts in ${formatMinutes(minutes)}`
    if (isLive) return diff > 0 ? `Ends in ${formatMinutes(minutes)}` : 'Ending...'
    if (isEnded) return 'Ended'
    return 'Draft'
  }, [isLive, isScheduled, isEnded, startMs, endMs, now])

  const priceLabel = React.useMemo(() => {
    const curr = formatCurrency(currentPrice, currency)
    if (type === 'english') {
      const hb = highestBid ? formatCurrency(highestBid, currency) : null
      return hb ? `High bid ${hb}` : `Current ${curr}`
    }
    return `Current ${curr}`
  }, [currentPrice, highestBid, type, currency])

  const reserveLabel = React.useMemo(() => {
    if (reservePrice == null || type !== 'english') return null
    return reserveMet ? 'Reserve met' : 'Reserve not met'
  }, [reservePrice, reserveMet, type])

  const statusClass = getStatusClass(status)

  return (
    <div className="card">
      <div className="card-content">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`badge ${type === 'english' ? 'badge-default' : 'badge-default'}`}>{capitalize(type)}</span>
              <span className={`badge ${statusClass}`}>{capitalize(status)}</span>
            </div>
            <h3 className="mt-2 line-clamp-2 text-base font-medium">{title}</h3>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <div>{timeLabel}</div>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div className="text-lg font-semibold">{priceLabel}</div>
          {typeof numBids === 'number' && (
            <div className="text-sm text-muted-foreground">{numBids} bids</div>
          )}
        </div>
        {reserveLabel && (
          <div className="mt-1 text-sm">
            <span className={`badge ${reserveMet ? 'badge-default' : 'badge-destructive'}`}>{reserveLabel}</span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-end gap-2 p-3" slot="footer">
        <button type="button" className="button" onClick={() => onQuickAction?.(id, 'view')}>View</button>
        {!isEnded && <button type="button" className="button" onClick={() => onQuickAction?.(id, 'share')}>Share</button>}
        {status !== 'ended' && status !== 'live' && (
          <button type="button" className="button" onClick={() => onQuickAction?.(id, 'edit')}>Edit</button>
        )}
      </div>
    </div>
  )
}

function formatMinutes(totalMinutes: number): string {
  if (totalMinutes <= 1) return '1 min'
  if (totalMinutes < 60) return `${totalMinutes} min`
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    const remH = hours % 24
    return remH ? `${days}d ${remH}h` : `${days}d`
  }
  return mins ? `${hours}h ${mins}m` : `${hours}h`
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function getStatusClass(status: AuctionCardProps['status']): string {
  switch (status) {
    case 'live':
      return 'badge-default'
    case 'scheduled':
      return 'badge-default'
    case 'draft':
      return 'badge-default'
    case 'ended':
      return 'badge-destructive'
    default:
      return 'badge-default'
  }
}

