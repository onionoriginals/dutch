import React from 'react'
import AuctionCard from '../auction/AuctionCard'
import AuctionListItem, { AuctionListItemSkeleton } from '../auction/AuctionListItem'
import type { AuctionsQuery, AuctionsResult } from '../../lib/auctions/common'
import { queryAuctions } from '../../lib/auctions/apiAdapter'

type ListProps = {
  initial?: AuctionsResult
  query: Omit<AuctionsQuery, 'page' | 'pageSize'> & { page?: number; pageSize?: number }
}

export default function List({ initial, query }: ListProps) {
  const [data, setData] = React.useState<AuctionsResult | null>(initial ?? null)
  const [loading, setLoading] = React.useState(!initial)
  const [error, setError] = React.useState<string | null>(null)
  const [q, setQ] = React.useState<AuctionsQuery>(() => ({ ...query }))
  const [view, setView] = React.useState<'grid' | 'list'>('list')

  React.useEffect(() => {
    setQ({ ...query })
  }, [JSON.stringify(query)])

  React.useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as Partial<AuctionsQuery> | undefined
      if (detail) setQ((prev: AuctionsQuery) => ({ ...prev, ...detail, page: 1 }))
    }
    window.addEventListener('auctions:query', handler as EventListener)
    return () => window.removeEventListener('auctions:query', handler as EventListener)
  }, [])

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    queryAuctions(q)
      .then((res) => {
        if (cancelled) return
        setData(res)
      })
      .catch((err) => {
        if (cancelled) return
        setError(String(err?.message || err))
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [JSON.stringify(q)])

  if (loading && !data) {
    return (
      view === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="card">
              <div className="card-content">
                <div className="skeleton h-5 w-24" />
                <div className="mt-3 space-y-2">
                  <div className="skeleton h-4 w-3/4" />
                  <div className="skeleton h-4 w-1/2" />
                </div>
              </div>
              <div slot="footer" className="p-3">
                <div className="skeleton h-8 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <AuctionListItemSkeleton key={i} />
          ))}
        </div>
      )
    )
  }

  if (error) {
    return (
      <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
        Failed to load auctions: {error}
      </div>
    )
  }

  const items = data?.items ?? []
  const total = data?.total ?? 0

  if (items.length === 0) {
    return (
      <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
        No auctions match your filters.
      </div>
    )
  }

  const activeItems = items.filter((a) => a.status !== 'ended')
  const endedItems = items.filter((a) => a.status === 'ended')

  function handleQuickAction(id: string, action: 'view' | 'edit' | 'cancel' | 'share') {
    if (action === 'view') {
      window.location.href = `/auctions/view?id=${encodeURIComponent(id)}`
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <div role="radiogroup" aria-label="View" className="inline-flex gap-1 rounded-md bg-muted p-1">
          <button
            type="button"
            role="radio"
            aria-checked={view === 'grid'}
            className={`px-3 py-1.5 text-sm rounded ${view === 'grid' ? 'bg-white shadow' : ''}`}
            onClick={() => setView('grid')}
          >
            Grid
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={view === 'list'}
            className={`px-3 py-1.5 text-sm rounded ${view === 'list' ? 'bg-white shadow' : ''}`}
            onClick={() => setView('list')}
          >
            List
          </button>
        </div>
      </div>

      {/* Active (non-ended) */}
      {activeItems.length > 0 && (
        view === 'grid' ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeItems.map((a) => (
              <AuctionCard key={a.id} {...a} onQuickAction={handleQuickAction} />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {activeItems.map((a) => (
              <AuctionListItem key={a.id} {...a} onQuickAction={handleQuickAction} />
            ))}
          </div>
        )
      )}

      {/* Ended section */}
      {endedItems.length > 0 && (
        <div className="space-y-2">
          <div className="mt-2 text-sm font-medium text-muted-foreground">Ended</div>
          {view === 'grid' ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {endedItems.map((a) => (
                <AuctionCard key={a.id} {...a} onQuickAction={handleQuickAction} />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {endedItems.map((a) => (
                <AuctionListItem key={a.id} {...a} onQuickAction={handleQuickAction} />
              ))}
            </div>
          )}
        </div>
      )}

      <Pagination
        page={data!.page}
        pageSize={data!.pageSize}
        total={total}
        onPageChange={(p) => {
          setQ((prev) => ({ ...prev, page: p }))
          const sp = new URLSearchParams(window.location.search)
          sp.set('page', String(p))
          const url = `${window.location.pathname}?${sp.toString()}`
          window.history.replaceState({}, '', url)
        }}
      />
    </div>
  )
}

function Pagination({ page, pageSize, total, onPageChange }: { page: number; pageSize: number; total: number; onPageChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1) return null
  return (
    <nav className="flex items-center justify-center gap-2" role="navigation" aria-label="Pagination">
      <button className="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page">Prev</button>
      <span className="text-sm text-muted-foreground">Page {page} of {pages}</span>
      <button className="button" disabled={page >= pages} onClick={() => onPageChange(page + 1)} aria-label="Next page">Next</button>
    </nav>
  )
}

