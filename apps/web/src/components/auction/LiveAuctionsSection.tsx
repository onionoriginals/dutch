import React from 'react'
import AuctionCard from './AuctionCard'
import type { AuctionSummary } from '../../lib/auctions/common'
import { queryAuctions } from '../../lib/auctions/apiAdapter'

export default function LiveAuctionsSection() {
  const [auctions, setAuctions] = React.useState<AuctionSummary[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false

    queryAuctions({ status: 'live', pageSize: 6, sort: 'endingSoon' })
      .then((result) => {
        if (cancelled) return
        setAuctions(result.items)
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
  }, [])

  function handleQuickAction(id: string, action: 'view' | 'edit' | 'cancel' | 'share') {
    if (action === 'view') {
      window.location.href = `/auctions/view?id=${encodeURIComponent(id)}`
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card">
            <div className="card-content space-y-6">
              <div className="space-y-3">
                <div className="flex gap-2">
                  <span className="skeleton h-6 w-24" data-animated="true" />
                  <span className="skeleton h-6 w-16" data-animated="true" />
                </div>
                <div className="skeleton h-8 w-3/4" data-animated="true" />
              </div>
              <div className="skeleton h-32 w-full" data-animated="true" />
              <div className="flex gap-2 border-t border-border/60 pt-6">
                <span className="skeleton h-12 w-32" data-animated="true" />
                <span className="skeleton h-12 w-20" data-animated="true" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div role="alert" className="card border border-destructive/30 bg-destructive/5 text-destructive">
        <div className="card-content space-y-2">
          <p className="text-sm font-semibold">Failed to load live auctions</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (auctions.length === 0) {
    return (
      <div className="card">
        <div className="card-content space-y-4 text-center">
          <p className="text-sm text-muted-foreground">No live auctions at the moment.</p>
          <a href="/auctions/new" className="btn btn-primary inline-flex justify-center">
            Create the first auction
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
      {auctions.map((auction) => (
        <AuctionCard key={auction.id} {...auction} onQuickAction={handleQuickAction} />
      ))}
    </div>
  )
}
