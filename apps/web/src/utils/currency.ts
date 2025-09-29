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

