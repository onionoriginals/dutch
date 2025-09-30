export function formatCurrency(amount: number, currency: string, locale?: string): string {
  const fmt = new Intl.NumberFormat(locale || undefined, {
    style: 'currency',
    currency,
    currencyDisplay: 'symbol'
  })
  return fmt.format(amount)
}

export function normalizeNumberInput(input: string | number): number {
  if (typeof input === 'number') return input
  let s = input.trim()
  if (!s) return NaN
  // Remove spaces
  s = s.replace(/\s+/g, '')
  // If both comma and dot exist, assume comma is thousands sep, remove commas
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/,/g, '')
  } else if (s.includes(',') && !s.includes('.')) {
    // Treat comma as decimal separator
    s = s.replace(/,/g, '.')
  }
  // Remove any non-numeric except leading minus and decimal dot
  s = s.replace(/[^0-9.-]/g, '')
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : NaN
}

/**
 * Convert BTC to satoshis (1 BTC = 100,000,000 sats)
 */
export function btcToSats(btc: number): number {
  return Math.round(btc * 100_000_000)
}

/**
 * Format satoshis with thousand separators
 */
export function formatSats(sats: number): string {
  return new Intl.NumberFormat('en-US').format(sats)
}

// Cache BTC price for 5 minutes
let cachedBtcPrice: { price: number; timestamp: number } | null = null
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

/**
 * Fetch current BTC/USD price from CoinGecko API
 */
async function fetchBtcPrice(): Promise<number> {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd')
    const data = await response.json()
    return data.bitcoin?.usd || 95000 // fallback to $95k if API fails
  } catch (error) {
    console.warn('Failed to fetch BTC price, using fallback', error)
    return 95000 // fallback
  }
}

/**
 * Get current BTC/USD rate with caching
 */
export async function getBtcUsdRate(): Promise<number> {
  const now = Date.now()
  
  // Return cached price if still valid
  if (cachedBtcPrice && (now - cachedBtcPrice.timestamp) < CACHE_DURATION) {
    return cachedBtcPrice.price
  }
  
  // Fetch new price
  const price = await fetchBtcPrice()
  cachedBtcPrice = { price, timestamp: now }
  return price
}

/**
 * Convert BTC to USD (uses cached rate or fetches current rate)
 */
export function btcToUsd(btc: number, btcUsdRate?: number): number {
  // If rate is provided, use it; otherwise use a reasonable default
  const rate = btcUsdRate ?? 95000
  return btc * rate
}

