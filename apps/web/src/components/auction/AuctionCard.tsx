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
    if (isLive) return diff > 0 ? `Ends in ${formatMinutes(minutes)}` : 'Ending soon'
    if (isEnded) return 'Closed'
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
    <div className="card group h-full">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-sky-400 to-purple-500 opacity-70" />
      <div className="card-content space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge badge-default">{capitalize(type)} auction</span>
              <span className={`badge ${statusClass}`}>{capitalize(status)}</span>
            </div>
            <h3 className="text-lg font-semibold leading-tight text-balance text-foreground line-clamp-2">{title}</h3>
          </div>
          <span className="text-right text-xs uppercase tracking-[0.35em] text-muted-foreground">{timeLabel}</span>
        </div>

        <div className="grid gap-4 rounded-2xl border border-border/60 bg-secondary/60 p-4 text-sm text-muted-foreground">
          <div className="flex items-center justify-between text-base text-foreground">
            <span className="font-semibold">{priceLabel}</span>
            {typeof numBids === 'number' && (
              <span className="text-sm font-medium text-muted-foreground">{numBids} bids</span>
            )}
          </div>
          {reserveLabel && (
            <div className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${reserveMet ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-destructive/10 text-destructive'}`}>
              {reserveLabel}
            </div>
          )}
          <div className="grid gap-3 text-xs uppercase tracking-[0.25em]">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Opens</span>
              <span className="text-foreground/80">{formatTimestamp(startTime)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Closes</span>
              <span className="text-foreground/80">{formatTimestamp(endTime)}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border/60 pt-6">
          <button type="button" className="btn btn-primary flex-1" onClick={() => onQuickAction?.(id, 'view')}>
            View auction
          </button>
          {!isEnded && (
            <button type="button" className="btn btn-ghost" onClick={() => onQuickAction?.(id, 'share')}>
              Share
            </button>
          )}
          {status !== 'ended' && status !== 'live' && (
            <button type="button" className="btn btn-secondary" onClick={() => onQuickAction?.(id, 'edit')}>
              Edit
            </button>
          )}
        </div>
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

function formatTimestamp(iso: string): string {
  return DateTime.fromISO(iso).toFormat('MMM d • h:mma')
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function getStatusClass(status: AuctionCardProps['status']): string {
  switch (status) {
    case 'live':
      return 'badge-success'
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
