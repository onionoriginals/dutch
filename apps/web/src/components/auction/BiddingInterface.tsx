import React from 'react'
import { NumberInput } from '../inputs/NumberInput'
import PaymentPSBTModal from './PaymentPSBTModal'

type Bid = {
  id: string
  auctionId: string
  bidderAddress: string
  bidAmount: number
  quantity: number
  status: 'payment_pending' | 'payment_confirmed' | 'settled' | 'failed' | 'refunded'
  escrowAddress?: string
  transactionId?: string
  created_at: number
  updated_at: number
}

type BiddingInterfaceProps = {
  auctionId: string
  currentPrice: number
  itemsRemaining: number
  currency?: string
  userAddress?: string
  onBidPlaced?: (bidId: string) => void
}

type BidState = {
  quantity: number
  isSubmitting: boolean
  error: string | null
  showPaymentModal: boolean
  paymentData: {
    escrowAddress: string
    bidId: string
    bidAmount: number
    quantity: number
  } | null
}

export default function BiddingInterface({
  auctionId,
  currentPrice,
  itemsRemaining,
  currency = 'BTC',
  userAddress,
  onBidPlaced,
}: BiddingInterfaceProps) {
  const [state, setState] = React.useState<BidState>({
    quantity: 1,
    isSubmitting: false,
    error: null,
    showPaymentModal: false,
    paymentData: null,
  })

  const [bids, setBids] = React.useState<Bid[]>([])
  const [loadingBids, setLoadingBids] = React.useState(true)

  // Load existing bids for this auction
  React.useEffect(() => {
    loadBids()
  }, [auctionId])

  async function loadBids() {
    try {
      setLoadingBids(true)
      const response = await fetch(`/api/clearing/bids/${auctionId}`)
      const json = await response.json()
      if (json.ok && json.data?.bids) {
        setBids(json.data.bids)
      }
    } catch (err) {
      console.error('Failed to load bids:', err)
    } finally {
      setLoadingBids(false)
    }
  }

  const totalBidAmount = state.quantity * currentPrice

  async function handlePlaceBid() {
    if (!userAddress) {
      setState(s => ({ ...s, error: 'Please connect your wallet first' }))
      return
    }

    if (state.quantity <= 0 || state.quantity > itemsRemaining) {
      setState(s => ({ ...s, error: `Invalid quantity. Available: ${itemsRemaining}` }))
      return
    }

    setState(s => ({ ...s, isSubmitting: true, error: null }))

    try {
      // Call create-bid-payment to get escrow address and bidId
      const response = await fetch('/api/clearing/create-bid-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auctionId,
          bidderAddress: userAddress,
          bidAmount: totalBidAmount,
          quantity: state.quantity,
        }),
      })

      const json = await response.json()

      if (!response.ok || !json.ok) {
        throw new Error(json.error || 'Failed to create bid payment')
      }

      // Show payment modal with PSBT
      setState(s => ({
        ...s,
        isSubmitting: false,
        showPaymentModal: true,
        paymentData: {
          escrowAddress: json.data.escrowAddress,
          bidId: json.data.bidId,
          bidAmount: totalBidAmount,
          quantity: state.quantity,
        },
      }))
    } catch (err) {
      setState(s => ({
        ...s,
        isSubmitting: false,
        error: err instanceof Error ? err.message : 'Failed to create bid',
      }))
    }
  }

  function handlePaymentComplete(bidId: string) {
    setState(s => ({
      ...s,
      showPaymentModal: false,
      paymentData: null,
      quantity: 1,
    }))
    loadBids()
    onBidPlaced?.(bidId)
  }

  function handlePaymentCancel() {
    setState(s => ({
      ...s,
      showPaymentModal: false,
      paymentData: null,
    }))
  }

  // Filter user's bids
  const userBids = userAddress 
    ? bids.filter(b => b.bidderAddress === userAddress)
    : []

  return (
    <div className="space-y-6">
      {/* Bid Form */}
      <div className="rounded-lg border bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Place Your Bid
        </h3>

        {!userAddress && (
          <div className="mb-4 rounded-lg bg-yellow-50 border border-yellow-200 p-4 dark:bg-yellow-900/20 dark:border-yellow-800">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              ⚠️ Please connect your wallet to place a bid
            </p>
          </div>
        )}

        {itemsRemaining === 0 && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4 dark:bg-red-900/20 dark:border-red-800">
            <p className="text-sm text-red-800 dark:text-red-200">
              No items remaining in this auction
            </p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Quantity
            </label>
            <NumberInput
              value={state.quantity}
              onChange={(e) => setState(s => ({ ...s, quantity: Number(e.target.value) || 1 }))}
              min={1}
              max={itemsRemaining}
              disabled={!userAddress || itemsRemaining === 0}
              className="w-full"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Available: {itemsRemaining} items
            </p>
          </div>

          <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Current Price per Item:
              </span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {formatPrice(currentPrice, currency)}
              </span>
            </div>
            <div className="flex justify-between items-center border-t border-gray-200 dark:border-gray-700 pt-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Total Bid Amount:
              </span>
              <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {formatPrice(totalBidAmount, currency)}
              </span>
            </div>
          </div>

          {state.error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 dark:bg-red-900/20 dark:border-red-800">
              <p className="text-sm text-red-800 dark:text-red-200">{state.error}</p>
            </div>
          )}

          <button
            type="button"
            onClick={handlePlaceBid}
            disabled={!userAddress || itemsRemaining === 0 || state.isSubmitting}
            className={`w-full px-6 py-3 rounded-lg font-medium transition-colors ${
              !userAddress || itemsRemaining === 0 || state.isSubmitting
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {state.isSubmitting ? 'Creating Bid...' : 'Place Bid'}
          </button>
        </div>

        <div className="mt-4 rounded-lg bg-blue-50 border border-blue-200 p-3 dark:bg-blue-900/20 dark:border-blue-800">
          <p className="text-xs text-blue-900 dark:text-blue-200">
            💡 <strong>Dutch Clearing Auction:</strong> Place a bid at the current price. 
            You'll be prompted to send payment to an escrow address. Once the auction ends, 
            all winners pay the same clearing price (the lowest winning bid).
          </p>
        </div>
      </div>

      {/* User's Bids */}
      {userBids.length > 0 && (
        <div className="rounded-lg border bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Your Bids
          </h3>
          <div className="space-y-3">
            {userBids.map(bid => (
              <BidCard key={bid.id} bid={bid} currency={currency} />
            ))}
          </div>
        </div>
      )}

      {/* All Bids */}
      {!loadingBids && bids.length > 0 && (
        <div className="rounded-lg border bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            All Bids ({bids.length})
          </h3>
          <div className="space-y-2">
            {bids.map(bid => (
              <div
                key={bid.id}
                className="flex justify-between items-center py-2 px-3 rounded bg-gray-50 dark:bg-gray-900"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono text-gray-600 dark:text-gray-400">
                    {truncateAddress(bid.bidderAddress)}
                  </span>
                  <span className="text-sm text-gray-900 dark:text-white">
                    {bid.quantity} × {formatPrice(bid.bidAmount / bid.quantity, currency)}
                  </span>
                </div>
                <BidStatusBadge status={bid.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {state.showPaymentModal && state.paymentData && (
        <PaymentPSBTModal
          auctionId={auctionId}
          bidId={state.paymentData.bidId}
          escrowAddress={state.paymentData.escrowAddress}
          bidAmount={state.paymentData.bidAmount}
          quantity={state.paymentData.quantity}
          currency={currency}
          onComplete={handlePaymentComplete}
          onCancel={handlePaymentCancel}
        />
      )}
    </div>
  )
}

function BidCard({ bid, currency }: { bid: Bid; currency: string }) {
  return (
    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="text-sm font-medium text-gray-900 dark:text-white">
            Bid #{bid.id}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {new Date(bid.created_at * 1000).toLocaleString()}
          </div>
        </div>
        <BidStatusBadge status={bid.status} />
      </div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Quantity:</span>
          <span className="font-medium text-gray-900 dark:text-white">{bid.quantity}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Bid Amount:</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {formatPrice(bid.bidAmount, currency)}
          </span>
        </div>
        {bid.escrowAddress && (
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Escrow:</span>
            <span className="font-mono text-xs text-gray-900 dark:text-white">
              {truncateAddress(bid.escrowAddress)}
            </span>
          </div>
        )}
        {bid.transactionId && (
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">TX:</span>
            <span className="font-mono text-xs text-gray-900 dark:text-white">
              {truncateAddress(bid.transactionId)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function BidStatusBadge({ status }: { status: Bid['status'] }) {
  const config = {
    payment_pending: { label: 'Payment Pending', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' },
    payment_confirmed: { label: 'Payment Confirmed', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' },
    settled: { label: 'Settled', color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' },
    failed: { label: 'Failed', color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' },
    refunded: { label: 'Refunded', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400' },
  }

  const { label, color } = config[status] || config.payment_pending

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {label}
    </span>
  )
}


function formatPrice(amount: number, currency: string): string {
  if (currency === 'BTC') {
    return `${amount.toFixed(8)} BTC`
  }
  return `${amount.toLocaleString()} ${currency}`
}

function truncateAddress(addr: string): string {
  if (addr.length <= 16) return addr
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`
}
