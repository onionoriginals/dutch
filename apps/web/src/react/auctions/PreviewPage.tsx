import * as React from 'react'
import { normalizeDutch, normalizeEnglish } from '../../utils/normalizeAuction'
import type { NormalizedAuctionPayload, NormalizedDutchPayload, NormalizedEnglishPayload } from '../../types/auction'
import PriceSparkline from '../../components/auction/PriceSparkline'

type Props = {
  stateParam: string | null
  typeParam: string | null
}

function decodeState(param: string | null): any | null {
  if (!param) return null
  try {
    const json = atob(param.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json)
  } catch {
    return null
  }
}

function encodeState(obj: any): string {
  const json = JSON.stringify(obj)
  const b64 = btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  return b64
}

function usePreviewPayload(stateParam: string | null, typeParam: string | null): { payload: NormalizedAuctionPayload | null; raw: any | null; type: 'english' | 'dutch' | null; error?: string } {
  return React.useMemo(() => {
    const raw = decodeState(stateParam)
    const type = (typeParam === 'english' || typeParam === 'dutch') ? typeParam : (raw?.type ?? null)
    if (!raw || !type) return { payload: null, raw: raw ?? null, type: null, error: 'Missing preview state' }
    try {
      const payload = type === 'english' ? normalizeEnglish(raw) : normalizeDutch(raw)
      return { payload, raw, type }
    } catch (e: any) {
      return { payload: null, raw, type: type as any, error: 'Invalid preview state' }
    }
  }, [stateParam, typeParam])
}

export default function PreviewPage(props: Props) {
  const { payload, raw, type, error } = usePreviewPayload(props.stateParam, props.typeParam)

  const shareUrl = React.useMemo(() => {
    if (!raw || !type) return ''
    const state = encodeState(raw)
    const url = new URL(window.location.href)
    url.searchParams.set('type', type)
    url.searchParams.set('state', state)
    return url.toString()
  }, [raw, type])

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
        <p className="font-medium">Unable to load preview</p>
        <p className="text-sm opacity-80">{error}. Return to the wizard to try again.</p>
      </div>
    )
  }

  if (!payload || !type) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
        <p className="font-medium">No preview data</p>
        <p className="text-sm opacity-80">Open the wizard and click Preview to see a summary.</p>
      </div>
    )
  }

  const risky: string[] = []
  if (type === 'dutch') {
    const p = payload as NormalizedDutchPayload
    if (p.pricing.endPrice <= 0) risky.push('Floor price is very low (≤ 0)')
    if (p.pricing.decrementIntervalSeconds < 5) risky.push('Decrement interval is very short (< 5s)')
  } else {
    const p = payload as NormalizedEnglishPayload
    if (p.pricing.reservePrice !== undefined && p.pricing.reservePrice > p.pricing.startingPrice * 2) {
      risky.push('Reserve price is unusually high (> 2× starting)')
    }
  }
  const now = Date.now()
  const startMs = Date.parse(payload.timing.startTime)
  const endMs = Date.parse(payload.timing.endTime)
  if (endMs - startMs < 5 * 60 * 1000) risky.push('Auction duration is very short (< 5 min)')
  if (startMs < now) risky.push('Start time is in the past')

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Preview Auction</h1>
          <p className="text-gray-600 dark:text-gray-400">Review and share before publishing.</p>
        </div>
        <div className="flex gap-2">
          <a href="/auctions/new" className="btn btn-secondary">Back to Wizard</a>
          {shareUrl && (
            <button type="button" className="btn" onClick={() => { navigator.clipboard.writeText(shareUrl).catch(()=>{}) }} aria-label="Copy shareable link">
              Copy Share Link
            </button>
          )}
        </div>
      </header>

      {risky.length > 0 && (
        <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          <div className="font-medium">Warnings</div>
          <ul className="mt-1 list-disc pl-5 text-sm">
            {risky.map((w, i) => (<li key={i}>{w}</li>))}
          </ul>
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <div className="card-content">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold">Overview</h2>
              <a className="btn-link" href={`/auctions/new?step=0#details`}>Edit</a>
            </div>
            <div className="mt-3 text-sm text-gray-700 dark:text-gray-300">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-gray-500">Type</div>
                  <div className="font-medium capitalize">{type}</div>
                </div>
                <div>
                  <div className="text-gray-500">Title</div>
                  <div className="font-medium">{payload.title}</div>
                </div>
              </div>
              {payload.description && (
                <p className="mt-2 text-gray-600 dark:text-gray-400">{payload.description}</p>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-content">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold">Timing</h2>
              <a className="btn-link" href={`/auctions/new?step=${type === 'dutch' ? 3 : 2}#timing`}>Edit</a>
            </div>
            <div className="mt-3 text-sm text-gray-700 dark:text-gray-300 grid grid-cols-2 gap-2">
              <div>
                <div className="text-gray-500">Start</div>
                <div className="font-medium">{new Date(payload.timing.startTime).toLocaleString()}</div>
              </div>
              <div>
                <div className="text-gray-500">End</div>
                <div className="font-medium">{new Date(payload.timing.endTime).toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="card md:col-span-2">
          <div className="card-content">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold">Pricing Rules</h2>
              <a className="btn-link" href={`/auctions/new?step=${type === 'dutch' ? 1 : 1}#pricing`}>Edit</a>
            </div>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div className="text-sm text-gray-700 dark:text-gray-300">
                {type === 'english' ? (
                  <ul className="space-y-1">
                    <li><span className="text-gray-500">Starting price</span> <span className="font-medium">${(payload as NormalizedEnglishPayload).pricing.startingPrice}</span></li>
                    <li><span className="text-gray-500">Reserve price</span> <span className="font-medium">{(payload as NormalizedEnglishPayload).pricing.reservePrice ?? '—'}</span></li>
                    <li><span className="text-gray-500">Bid increment</span> <span className="font-medium">${(payload as NormalizedEnglishPayload).pricing.bidIncrement}</span></li>
                  </ul>
                ) : (
                  <ul className="space-y-1">
                    <li><span className="text-gray-500">Start price</span> <span className="font-medium">${(payload as NormalizedDutchPayload).pricing.startPrice}</span></li>
                    <li><span className="text-gray-500">End price</span> <span className="font-medium">${(payload as NormalizedDutchPayload).pricing.endPrice}</span></li>
                    <li><span className="text-gray-500">Decrement</span> <span className="font-medium">${(payload as NormalizedDutchPayload).pricing.decrementAmount} / {(payload as NormalizedDutchPayload).pricing.decrementIntervalSeconds}s</span></li>
                    <li><span className="text-gray-500">Buy now</span> <span className="font-medium">{(payload as NormalizedDutchPayload).pricing.buyNowPrice ?? '—'}</span></li>
                  </ul>
                )}
              </div>
              <div className="flex items-center">
                {type === 'dutch' ? (
                  <PriceSparkline
                    dutchInput={{
                      startPrice: (payload as NormalizedDutchPayload).pricing.startPrice,
                      floorPrice: (payload as NormalizedDutchPayload).pricing.endPrice,
                      durationSeconds: Math.max(1, Math.floor((endMs - startMs) / 1000)),
                      intervalSeconds: (payload as NormalizedDutchPayload).pricing.decrementIntervalSeconds,
                      decayType: 'linear'
                    }}
                    title="Price schedule"
                  />
                ) : (
                  <div className="text-sm text-gray-500">No schedule preview for English auctions.</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-content">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold">Fees</h2>
              <a className="btn-link" href={`/auctions/new#fees`}>Edit</a>
            </div>
            <div className="mt-3 text-sm text-gray-700 dark:text-gray-300">
              <p>Standard 2.5% platform fee applies. Taxes not included.</p>
            </div>
          </div>
        </div>
      </section>

      <style jsx>{`
        .card { border: 1px solid #e5e7eb; border-radius: 0.75rem; background: white; }
        .card-content { padding: 16px; }
        .btn { background: #111827; color: white; border: 0; padding: 8px 12px; border-radius: 6px; cursor: pointer; }
        .btn-secondary { background: #e5e7eb; color: #111827; border: 0; padding: 8px 12px; border-radius: 6px; cursor: pointer; }
        .btn-link { color: #2563eb; text-decoration: underline; text-underline-offset: 2px; }
        @media (max-width: 640px) {
          .card-content { padding: 12px; }
        }
      `}</style>
    </div>
  )
}

