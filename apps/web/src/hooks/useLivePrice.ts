import { useState, useEffect, useCallback, useRef } from 'react'
import { priceAtTime, type ScheduleInput } from '@originals/dutch/browser'

export interface LivePriceState {
  currentPrice: number
  secondsFromStart: number
  timeToNextDrop: number
  isActive: boolean
  priceHistory: Array<{ timestamp: number; price: number }>
}

export interface UseLivePriceOptions {
  scheduleInput: ScheduleInput
  startTime: string // ISO timestamp
  endTime: string // ISO timestamp
  status: 'draft' | 'scheduled' | 'live' | 'ended'
  updateInterval?: number // milliseconds, defaults to 1000
  historyDuration?: number // milliseconds to keep in price history, defaults to 5 minutes
}

/**
 * Hook to calculate live Dutch auction prices using requestAnimationFrame
 * for smooth updates and precise timing. Calculates prices client-side using
 * the priceAtTime function from @originals/dutch/schedule.
 */
export function useLivePrice(options: UseLivePriceOptions): LivePriceState {
  const {
    scheduleInput,
    startTime,
    endTime,
    status,
    updateInterval = 1000,
    historyDuration = 5 * 60 * 1000, // 5 minutes
  } = options

  const [state, setState] = useState<LivePriceState>(() => {
    const now = Date.now()
    const startMs = new Date(startTime).getTime()
    const endMs = new Date(endTime).getTime()
    const isActive = status === 'live' && now >= startMs && now < endMs
    const secondsFromStart = Math.max(0, Math.floor((now - startMs) / 1000))
    const currentPrice = isActive ? (priceAtTime(scheduleInput, secondsFromStart) || scheduleInput.startPrice) : scheduleInput.startPrice

    return {
      currentPrice,
      secondsFromStart,
      timeToNextDrop: scheduleInput.intervalSeconds,
      isActive,
      priceHistory: [{ timestamp: now, price: currentPrice }],
    }
  })

  const animationFrameRef = useRef<number | null>(null)
  const lastUpdateRef = useRef<number>(Date.now())
  const priceHistoryRef = useRef<Array<{ timestamp: number; price: number }>>([
    { timestamp: Date.now(), price: state.currentPrice }
  ])

  const updatePrice = useCallback(() => {
    const now = Date.now()
    const startMs = new Date(startTime).getTime()
    const endMs = new Date(endTime).getTime()

    // Check if auction is still active
    const isActive = status === 'live' && now >= startMs && now < endMs

    if (!isActive) {
      // Auction is not active, compute final price before stopping updates
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      
      // Calculate final price at auction end
      const finalSecondsFromStart = Math.max(0, Math.floor((endMs - startMs) / 1000))
      const finalPrice = priceAtTime(scheduleInput, finalSecondsFromStart) || scheduleInput.floorPrice
      
      // Add final price to history
      priceHistoryRef.current = [
        ...priceHistoryRef.current.filter((entry: { timestamp: number; price: number }) => entry.timestamp > now - historyDuration),
        { timestamp: now, price: finalPrice }
      ]
      
      setState({
        currentPrice: finalPrice,
        secondsFromStart: finalSecondsFromStart,
        timeToNextDrop: 0,
        isActive: false,
        priceHistory: [...priceHistoryRef.current],
      })
      return
    }

    // Only update state at the specified interval
    if (now - lastUpdateRef.current >= updateInterval) {
      const secondsFromStart = Math.max(0, Math.floor((now - startMs) / 1000))
      const currentPrice = priceAtTime(scheduleInput, secondsFromStart) || scheduleInput.floorPrice

      // Calculate time until next price drop
      const secondsIntoCurrentInterval = secondsFromStart % scheduleInput.intervalSeconds
      const timeToNextDrop = scheduleInput.intervalSeconds - secondsIntoCurrentInterval

      // Update price history
      const cutoffTime = now - historyDuration
      priceHistoryRef.current = [
        ...priceHistoryRef.current.filter((entry: { timestamp: number; price: number }) => entry.timestamp > cutoffTime),
        { timestamp: now, price: currentPrice }
      ]

      setState({
        currentPrice,
        secondsFromStart,
        timeToNextDrop,
        isActive: true,
        priceHistory: [...priceHistoryRef.current],
      })

      lastUpdateRef.current = now
    }

    // Schedule next frame
    animationFrameRef.current = requestAnimationFrame(updatePrice)
  }, [scheduleInput, startTime, endTime, status, updateInterval, historyDuration])

  useEffect(() => {
    const startMs = new Date(startTime).getTime()
    const endMs = new Date(endTime).getTime()
    const now = Date.now()
    const isActive = status === 'live' && now >= startMs && now < endMs

    if (!isActive) {
      // If not active, set final state and don't start animation loop
      const finalSecondsFromStart = status === 'ended' ? Math.floor((endMs - startMs) / 1000) : 0
      const finalPrice = status === 'ended' 
        ? (priceAtTime(scheduleInput, finalSecondsFromStart) || scheduleInput.floorPrice)
        : scheduleInput.startPrice

      setState({
        currentPrice: finalPrice,
        secondsFromStart: finalSecondsFromStart,
        timeToNextDrop: 0,
        isActive: false,
        priceHistory: [{ timestamp: now, price: finalPrice }],
      })
      return
    }

    // Start animation loop for active auctions
    lastUpdateRef.current = Date.now()
    animationFrameRef.current = requestAnimationFrame(updatePrice)

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [scheduleInput, startTime, endTime, status, updatePrice])

  return state
}
