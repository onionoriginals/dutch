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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
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
    )
  }

  if (error) {
    return (
      <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
        Failed to load live auctions: {error}
      </div>
    )
  }

  if (auctions.length === 0) {
    return (
      <div className="rounded-md border bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-900">
        <p className="text-sm text-muted-foreground">No live auctions at the moment.</p>
        <a href="/auctions/new" className="button mt-4">Create the first auction</a>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {auctions.map((auction) => (
        <AuctionCard key={auction.id} {...auction} onQuickAction={handleQuickAction} />
      ))}
    </div>
  )
}
