import React from 'react'
import AuctionCard from '../../components/auction/AuctionCard'
import { fetchAuction } from '../../lib/auctions/apiAdapter'

export default function AuctionView() {
  const [id, setId] = React.useState<string>('')
  const [loading, setLoading] = React.useState<boolean>(true)
  const [error, setError] = React.useState<string | null>(null)
  const [data, setData] = React.useState<Awaited<ReturnType<typeof fetchAuction>> | null>(null)

  React.useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search)
      const qid = sp.get('id') || ''
      setId(qid)
      if (!qid) {
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      fetchAuction(qid)
        .then((res) => setData(res))
        .catch((e) => setError(String(e?.message || e)))
        .finally(() => setLoading(false))
    } catch (e: any) {
      setError(String(e?.message || e))
      setLoading(false)
    }
  }, [])

  if (!id) {
    return (
      <section className="rounded-lg border bg-white p-6 text-center shadow-sm dark:border-gray-800 dark:bg-gray-800">
        <h1 className="text-xl font-semibold">Auction not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Provide an id via the <code>?id=</code> query parameter.
        </p>
        <p className="mt-4">
          <a href="/auctions" className="button">Back to auctions</a>
        </p>
      </section>
    )
  }

  if (loading) {
    return (
      <section className="rounded-lg border bg-white p-6 text-center shadow-sm dark:border-gray-800 dark:bg-gray-800">
        <div className="skeleton mx-auto h-6 w-40" />
        <div className="mx-auto mt-3 h-4 w-64" />
      </section>
    )
  }

  if (error || !data) {
    return (
      <section className="rounded-lg border bg-white p-6 text-center shadow-sm dark:border-gray-800 dark:bg-gray-800">
        <h1 className="text-xl font-semibold">Auction not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">We couldn't find an auction with id "{id}".</p>
        <p className="mt-4">
          <a href="/auctions" className="button">Back to auctions</a>
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-lg border bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-800">
      <AuctionCard
        id={data.auction.id}
        title={data.auction.title}
        type={data.auction.type}
        status={data.auction.status}
        startTime={data.auction.startTime}
        endTime={data.auction.endTime}
        currency={data.auction.currency}
        currentPrice={data.auction.currentPrice}
      />
    </section>
  )
}


