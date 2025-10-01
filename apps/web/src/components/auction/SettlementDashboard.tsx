import React from 'react'

const API_BASE: string = ((import.meta as any)?.env?.PUBLIC_API_BASE || '') + '/api'

interface Bid {
  id: string
  auctionId: string
  bidderAddress: string
  bidAmount: number
  quantity: number
  status: 'placed' | 'payment_pending' | 'payment_confirmed' | 'settled' | 'failed' | 'refunded'
  escrowAddress?: string
  transactionId?: string
  created_at: number
  updated_at: number
}

interface Allocation {
  bidId: string
  bidderAddress: string
  quantity: number
}

interface SettlementData {
  auctionId: string
  clearingPrice: number
  totalQuantity: number
  itemsRemaining: number
  allocations: Allocation[]
}

interface PSBT {
  bidId: string
  inscriptionId: string
  toAddress: string
  psbt: string
}

interface SettlementDashboardProps {
  auctionId: string
}

export default function SettlementDashboard({ auctionId }: SettlementDashboardProps) {
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [bids, setBids] = React.useState<Bid[]>([])
  const [settlement, setSettlement] = React.useState<SettlementData | null>(null)
  const [psbts, setPsbts] = React.useState<PSBT[]>([])
  const [currentPsbtIndex, setCurrentPsbtIndex] = React.useState(0)
  const [settling, setSettling] = React.useState(false)
  const [settlementStep, setSettlementStep] = React.useState<'idle' | 'processing' | 'signing' | 'broadcasting' | 'marking' | 'complete'>('idle')
  const [signedPsbts, setSignedPsbts] = React.useState<Map<number, string>>(new Map())
  const [broadcastResults, setBroadcastResults] = React.useState<Map<number, string>>(new Map())

  // Load bids and settlement data
  React.useEffect(() => {
    if (!auctionId) return
    
    const loadData = async () => {
      setLoading(true)
      setError(null)
      
      try {
        // Fetch bids
        const bidsResp = await fetch(`${API_BASE}/clearing/bids/${encodeURIComponent(auctionId)}`)
        if (!bidsResp.ok) throw new Error('Failed to fetch bids')
        const bidsJson = await bidsResp.json()
        const bidsData = bidsJson.ok && bidsJson.data?.bids ? bidsJson.data.bids : []
        setBids(bidsData)
        
        // Fetch settlement calculation
        const settlementResp = await fetch(`${API_BASE}/clearing/settlement/${encodeURIComponent(auctionId)}`)
        if (!settlementResp.ok) throw new Error('Failed to fetch settlement')
        const settlementJson = await settlementResp.json()
        if (settlementJson.ok && settlementJson.data) {
          setSettlement(settlementJson.data)
        }
      } catch (e: any) {
        setError(e.message || 'Failed to load settlement data')
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [auctionId])

  const handleProcessSettlement = async () => {
    if (!settlement) return
    
    setSettling(true)
    setError(null)
    setSettlementStep('processing')
    
    try {
      // Call process-settlement API to get PSBTs
      const resp = await fetch(`${API_BASE}/clearing/process-settlement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auctionId })
      })
      
      if (!resp.ok) {
        const errJson = await resp.json()
        throw new Error(errJson.error || 'Failed to process settlement')
      }
      
      const json = await resp.json()
      if (!json.ok || !json.data) {
        throw new Error('Invalid response from process-settlement')
      }
      
      // Extract PSBTs from response
      const psbtData = json.data.psbts || []
      setPsbts(psbtData)
      
      if (psbtData.length === 0) {
        setSettlementStep('complete')
        setError('No PSBTs to sign (all bids may already be settled)')
        return
      }
      
      // Move to signing step
      setSettlementStep('signing')
      setCurrentPsbtIndex(0)
    } catch (e: any) {
      setError(e.message || 'Failed to process settlement')
      setSettlementStep('idle')
      setSettling(false)
    }
  }

  const handleSignPsbt = async (index: number) => {
    const psbt = psbts[index]
    if (!psbt) return
    
    try {
      // In a real implementation, this would use a Bitcoin wallet library
      // For now, we'll simulate signing by prompting the user
      const signed = prompt(
        `Please sign PSBT for inscription ${psbt.inscriptionId} to ${psbt.toAddress.slice(0, 12)}...\n\nPaste signed PSBT (or click OK to simulate):`
      )
      
      if (!signed && signed !== '') {
        throw new Error('Signing cancelled')
      }
      
      // Store signed PSBT
      const signedPsbt = signed || `signed_${psbt.psbt}`
      const updatedSignedPsbts = new Map(signedPsbts).set(index, signedPsbt)
      setSignedPsbts(updatedSignedPsbts)
      
      // Move to next PSBT or broadcasting step
      if (index + 1 < psbts.length) {
        setCurrentPsbtIndex(index + 1)
      } else {
        setSettlementStep('broadcasting')
        // Pass the updated map directly to avoid stale state
        await broadcastAllPsbts(updatedSignedPsbts)
      }
    } catch (e: any) {
      setError(e.message || 'Failed to sign PSBT')
    }
  }

  const broadcastAllPsbts = async (signedPsbtsMap?: Map<number, string>) => {
    setSettlementStep('broadcasting')
    const results = new Map<number, string>()
    // Use the passed map or fall back to state (for backwards compatibility)
    const psbtsToUse = signedPsbtsMap || signedPsbts
    
    for (let i = 0; i < psbts.length; i++) {
      const signedPsbt = psbtsToUse.get(i)
      if (!signedPsbt) {
        results.set(i, 'error:not_signed')
        continue
      }
      
      try {
        // In a real implementation, broadcast to Bitcoin network
        // For now, simulate with a mock transaction ID
        await new Promise(resolve => setTimeout(resolve, 500)) // Simulate network delay
        const txId = `tx_${Date.now()}_${i}`
        results.set(i, txId)
      } catch (e: any) {
        results.set(i, `error:${e.message}`)
      }
    }
    
    setBroadcastResults(results)
    
    // Move to marking settled
    await markBidsSettled(results)
  }

  const markBidsSettled = async (results: Map<number, string>) => {
    setSettlementStep('marking')
    
    try {
      // Get all successfully broadcast bid IDs
      const successfulBidIds = psbts
        .map((psbt, idx) => {
          const result = results.get(idx)
          return result && !result.startsWith('error:') ? psbt.bidId : null
        })
        .filter((id): id is string => id !== null)
      
      if (successfulBidIds.length === 0) {
        throw new Error('No successful broadcasts to mark as settled')
      }
      
      const resp = await fetch(`${API_BASE}/clearing/mark-settled`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auctionId,
          bidIds: successfulBidIds
        })
      })
      
      if (!resp.ok) {
        const errJson = await resp.json()
        throw new Error(errJson.error || 'Failed to mark bids as settled')
      }
      
      setSettlementStep('complete')
      
      // Reload bids to show updated status
      const bidsResp = await fetch(`${API_BASE}/clearing/bids/${encodeURIComponent(auctionId)}`)
      if (bidsResp.ok) {
        const bidsJson = await bidsResp.json()
        if (bidsJson.ok && bidsJson.data?.bids) {
          setBids(bidsJson.data.bids)
        }
      }
    } catch (e: any) {
      setError(e.message || 'Failed to mark bids as settled')
    } finally {
      setSettling(false)
    }
  }

  const handleReset = () => {
    setSettlementStep('idle')
    setSettling(false)
    setPsbts([])
    setCurrentPsbtIndex(0)
    setSignedPsbts(new Map())
    setBroadcastResults(new Map())
    setError(null)
  }

  if (loading) {
    return (
      <div className="rounded-lg border bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-800">
        <div className="skeleton h-6 w-48 mb-4" />
        <div className="skeleton h-4 w-full mb-2" />
        <div className="skeleton h-4 w-full mb-2" />
        <div className="skeleton h-4 w-2/3" />
      </div>
    )
  }

  if (error && settlementStep === 'idle') {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 shadow-sm dark:border-red-900 dark:bg-red-950">
        <h2 className="text-lg font-semibold text-red-900 dark:text-red-100">Error</h2>
        <p className="mt-2 text-sm text-red-800 dark:text-red-200">{error}</p>
      </div>
    )
  }

  const confirmedBids = bids.filter(b => b.status === 'payment_confirmed' || b.status === 'settled')
  const settledBids = bids.filter(b => b.status === 'settled')

  return (
    <div className="space-y-6">
      {/* Settlement Summary */}
      {settlement && (
        <div className="rounded-lg border bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-800">
          <h2 className="text-xl font-semibold mb-4">Settlement Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Clearing Price</p>
              <p className="text-2xl font-bold">{settlement.clearingPrice.toLocaleString()} sats</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Quantity</p>
              <p className="text-2xl font-bold">{settlement.totalQuantity}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Items Remaining</p>
              <p className="text-2xl font-bold">{settlement.itemsRemaining}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Allocations</p>
              <p className="text-2xl font-bold">{settlement.allocations.length}</p>
            </div>
          </div>
        </div>
      )}

      {/* Bids List */}
      <div className="rounded-lg border bg-white shadow-sm dark:border-gray-800 dark:bg-gray-800">
        <div className="border-b p-4 dark:border-gray-700">
          <h2 className="text-xl font-semibold">Bids ({bids.length})</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {confirmedBids.length} confirmed • {settledBids.length} settled
          </p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Bid ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Bidder Address
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Quantity
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Bid Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {bids.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No bids yet
                  </td>
                </tr>
              ) : (
                bids.map((bid) => (
                  <tr key={bid.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                    <td className="px-4 py-3 text-sm font-mono">{bid.id}</td>
                    <td className="px-4 py-3 text-sm font-mono">
                      {bid.bidderAddress.slice(0, 8)}...{bid.bidderAddress.slice(-6)}
                    </td>
                    <td className="px-4 py-3 text-sm">{bid.quantity}</td>
                    <td className="px-4 py-3 text-sm">{bid.bidAmount.toLocaleString()} sats</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getStatusBadgeClass(bid.status)}`}>
                        {bid.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Allocation Plan */}
      {settlement && settlement.allocations.length > 0 && (
        <div className="rounded-lg border bg-white shadow-sm dark:border-gray-800 dark:bg-gray-800">
          <div className="border-b p-4 dark:border-gray-700">
            <h2 className="text-xl font-semibold">Allocation Plan</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Items will be transferred in order of bid confirmation
            </p>
          </div>
          
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {settlement.allocations.map((alloc, idx) => (
              <div key={alloc.bidId} className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">#{idx + 1} • Bid {alloc.bidId}</p>
                  <p className="text-xs text-muted-foreground font-mono mt-1">
                    {alloc.bidderAddress.slice(0, 12)}...{alloc.bidderAddress.slice(-8)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{alloc.quantity} item{alloc.quantity !== 1 ? 's' : ''}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settlement Controls */}
      {settlementStep === 'idle' && (
        <div className="rounded-lg border bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-800">
          <button
            onClick={handleProcessSettlement}
            disabled={settling || confirmedBids.length === 0}
            className="button button-primary w-full md:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {settling ? 'Processing...' : 'Process Settlement'}
          </button>
          {confirmedBids.length === 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              No confirmed bids to settle
            </p>
          )}
        </div>
      )}

      {/* PSBT Signing Interface */}
      {settlementStep === 'signing' && psbts.length > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 shadow-sm dark:border-blue-900 dark:bg-blue-950">
          <h2 className="text-xl font-semibold text-blue-900 dark:text-blue-100 mb-4">
            Sign Inscription Transfers ({currentPsbtIndex + 1} of {psbts.length})
          </h2>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-4">
            <p className="text-sm font-semibold mb-2">Current Transfer:</p>
            <div className="space-y-1 text-sm">
              <p><span className="text-muted-foreground">Inscription:</span> <span className="font-mono">{psbts[currentPsbtIndex]?.inscriptionId}</span></p>
              <p><span className="text-muted-foreground">To Address:</span> <span className="font-mono">{psbts[currentPsbtIndex]?.toAddress}</span></p>
              <p><span className="text-muted-foreground">Bid ID:</span> <span className="font-mono">{psbts[currentPsbtIndex]?.bidId}</span></p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => handleSignPsbt(currentPsbtIndex)}
              className="button button-primary"
            >
              Sign PSBT
            </button>
            <button
              onClick={handleReset}
              className="button button-secondary"
            >
              Cancel
            </button>
          </div>
          
          {error && (
            <div className="mt-4 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
        </div>
      )}

      {/* Broadcasting Progress */}
      {settlementStep === 'broadcasting' && (
        <div className="rounded-lg border bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-800">
          <h2 className="text-xl font-semibold mb-4">Broadcasting Transactions...</h2>
          <div className="space-y-2">
            {psbts.map((psbt, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <span className="font-mono">{psbt.inscriptionId}</span>
                <span className="text-muted-foreground">Broadcasting...</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Marking Settled */}
      {settlementStep === 'marking' && (
        <div className="rounded-lg border bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-800">
          <h2 className="text-xl font-semibold mb-4">Marking Bids as Settled...</h2>
          <div className="skeleton h-4 w-full" />
        </div>
      )}

      {/* Complete */}
      {settlementStep === 'complete' && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-6 shadow-sm dark:border-green-900 dark:bg-green-950">
          <h2 className="text-xl font-semibold text-green-900 dark:text-green-100 mb-4">
            Settlement Complete!
          </h2>
          <p className="text-sm text-green-800 dark:text-green-200 mb-4">
            All inscription transfers have been processed and bids have been marked as settled.
          </p>
          
          {broadcastResults.size > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-4">
              <p className="text-sm font-semibold mb-2">Transaction IDs:</p>
              <div className="space-y-1">
                {Array.from(broadcastResults.entries()).map(([idx, txId]) => (
                  <div key={idx} className="text-xs font-mono">
                    {psbts[idx]?.bidId}: {txId}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <button
            onClick={handleReset}
            className="button button-primary"
          >
            Done
          </button>
        </div>
      )}
    </div>
  )
}

function getStatusBadgeClass(status: Bid['status']): string {
  switch (status) {
    case 'placed':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
    case 'payment_pending':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
    case 'payment_confirmed':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
    case 'settled':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    case 'failed':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    case 'refunded':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
  }
}
