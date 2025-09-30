import React from 'react'
import { useLivePrice } from '../../hooks/useLivePrice'
import { PriceSparkline } from './PriceSparkline'
import { formatCurrency } from '../../utils/currency'
import type { ScheduleInput } from '@originals/dutch/browser'

export interface LivePriceDisplayProps {
  scheduleInput: ScheduleInput
  startTime: string
  endTime: string
  status: 'draft' | 'scheduled' | 'live' | 'ended'
  currency: string
  className?: string
  showSparkline?: boolean
  showCountdown?: boolean
  compact?: boolean
}

export function LivePriceDisplay(props: LivePriceDisplayProps) {
  const {
    scheduleInput,
    startTime,
    endTime,
    status,
    currency,
    className = '',
    showSparkline = true,
    showCountdown = true,
    compact = false,
  } = props

  const livePrice = useLivePrice({
    scheduleInput,
    startTime,
    endTime,
    status,
    updateInterval: 1000,
    historyDuration: 5 * 60 * 1000, // 5 minutes
  })

  const [previousPrice, setPreviousPrice] = React.useState(livePrice.currentPrice)
  const [priceChanged, setPriceChanged] = React.useState(false)

  // Detect price changes and trigger animation
  React.useEffect(() => {
    if (livePrice.currentPrice !== previousPrice) {
      setPriceChanged(true)
      setPreviousPrice(livePrice.currentPrice)
      const timer = setTimeout(() => setPriceChanged(false), 500)
      return () => clearTimeout(timer)
    }
  }, [livePrice.currentPrice, previousPrice])

  const formattedPrice = formatCurrency(livePrice.currentPrice, currency)

  // Format countdown timer
  const formatCountdown = (seconds: number): string => {
    if (seconds <= 0) return '0s'
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`
  }

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span
          className={`text-lg font-semibold transition-all duration-300 ${
            priceChanged ? 'scale-110 text-blue-600 dark:text-blue-400' : ''
          }`}
        >
          {formattedPrice}
        </span>
        {showCountdown && livePrice.isActive && livePrice.timeToNextDrop > 0 && (
          <span className="text-xs text-muted-foreground">
            Next drop in {formatCountdown(livePrice.timeToNextDrop)}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Current Price with Animation */}
      <div className="flex items-baseline gap-2">
        <span className="text-sm text-muted-foreground">Current Price:</span>
        <span
          className={`text-2xl font-bold transition-all duration-300 ${
            priceChanged 
              ? 'scale-110 text-blue-600 dark:text-blue-400 drop-shadow-lg' 
              : 'text-gray-900 dark:text-white'
          }`}
          style={{
            animation: priceChanged ? 'pulse 0.5s ease-in-out' : undefined,
          }}
        >
          {formattedPrice}
        </span>
        {livePrice.isActive && (
          <span className="ml-1 inline-flex h-2 w-2 rounded-full bg-green-500 animate-pulse" title="Live updates active" />
        )}
      </div>

      {/* Countdown Timer */}
      {showCountdown && livePrice.isActive && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Next price drop in:</span>
          <span className="font-mono font-semibold text-gray-900 dark:text-white">
            {formatCountdown(livePrice.timeToNextDrop)}
          </span>
        </div>
      )}

      {/* Price Schedule Info */}
      {!livePrice.isActive && status === 'ended' && (
        <div className="text-sm text-muted-foreground">
          Final price: {formatCurrency(scheduleInput.floorPrice, currency)}
        </div>
      )}

      {!livePrice.isActive && (status === 'draft' || status === 'scheduled') && (
        <div className="text-sm text-muted-foreground">
          Starting price: {formatCurrency(scheduleInput.startPrice, currency)}
        </div>
      )}

      {/* Price History Sparkline */}
      {showSparkline && livePrice.priceHistory.length > 1 && (
        <div className="mt-4">
          <div className="mb-1 text-xs text-muted-foreground">
            Price history (last 5 minutes)
          </div>
          <PriceSparkline
            points={livePrice.priceHistory.map((entry) => ({
              t: Math.floor((entry.timestamp - livePrice.priceHistory[0]!.timestamp) / 1000),
              price: entry.price,
            }))}
            width={320}
            height={60}
            className="h-15 w-full max-w-md"
            title="Price history over last 5 minutes"
          />
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.1);
          }
        }
      `}</style>
    </div>
  )
}

export default LivePriceDisplay
