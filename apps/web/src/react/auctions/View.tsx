import React from 'react'
import AuctionCard from '../../components/auction/AuctionCard'
import BiddingInterface from '../../components/auction/BiddingInterface'
import { fetchAuction } from '../../lib/auctions/apiAdapter'

type ClearingAuction = {
  id: string
  inscription_id: string
  inscription_ids: string[]
  quantity: number
  itemsRemaining: number
  status: 'active' | 'sold' | 'expired'
  start_price: number
  min_price: number
  duration: number
  decrement_interval: number
  created_at: number
  updated_at: number
  auction_type: 'clearing'
}

export default function AuctionView() {
  const [id, setId] = React.useState<string>('')
  const [loading, setLoading] = React.useState<boolean>(true)
  const [error, setError] = React.useState<string | null>(null)
  const [data, setData] = React.useState<Awaited<ReturnType<typeof fetchAuction>> | null>(null)
  const [clearingData, setClearingData] = React.useState<ClearingAuction | null>(null)
  const [userAddress, setUserAddress] = React.useState<string>('')

  // Mock wallet connection - in production, integrate with actual Bitcoin wallet
  React.useEffect(() => {
    // For demo purposes, set a mock address
    // TODO: Replace with actual wallet integration
    setUserAddress('tb1qmockuseraddress0000000000000000000')
  }, [])

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
      
      // Fetch basic auction data
      fetchAuction(qid)
        .then((res) => {
          setData(res)
          // If it's a clearing auction, fetch additional clearing data
          return fetch(`/api/clearing/status/${qid}`)
        })
        .then(async (res) => {
          if (res.ok) {
            const json = await res.json()
            if (json.ok && json.data?.auction) {
              setClearingData(json.data.auction)
            }
          }
        })
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

  const isClearingAuction = clearingData?.auction_type === 'clearing'
  const isActive = data.auction.status === 'live'

  return (
    <div className="space-y-6">
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

      {/* Bidding Interface - only show for active clearing auctions */}
      {isClearingAuction && isActive && clearingData && (
        <section>
          <BiddingInterface
            auctionId={id}
            currentPrice={clearingData.start_price}
            itemsRemaining={clearingData.itemsRemaining}
            currency="BTC"
            userAddress={userAddress}
            onBidPlaced={(bidId) => {
              console.log('Bid placed:', bidId)
              // Optionally refresh auction data
            }}
          />
        </section>
      )}

      {/* Additional auction details */}
      {isClearingAuction && clearingData && (
        <section className="rounded-lg border bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Auction Details
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">Total Quantity:</span>
              <div className="font-medium text-gray-900 dark:text-white">{clearingData.quantity} items</div>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Items Remaining:</span>
              <div className="font-medium text-gray-900 dark:text-white">{clearingData.itemsRemaining} items</div>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Start Price:</span>
              <div className="font-medium text-gray-900 dark:text-white">{clearingData.start_price.toFixed(8)} BTC</div>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Min Price:</span>
              <div className="font-medium text-gray-900 dark:text-white">{clearingData.min_price.toFixed(8)} BTC</div>
            </div>
            <div className="col-span-2">
              <span className="text-gray-600 dark:text-gray-400">Inscription IDs:</span>
              <div className="mt-1 font-mono text-xs bg-gray-50 dark:bg-gray-900 p-2 rounded max-h-32 overflow-y-auto">
                {clearingData.inscription_ids.map((id, i) => (
                  <div key={i} className="text-gray-900 dark:text-white">{id}</div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}


