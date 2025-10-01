import React from 'react'

type PaymentPSBTModalProps = {
  auctionId: string
  bidId: string
  escrowAddress: string
  bidAmount: number // Total bid amount in satoshis
  quantity: number
  currency: string
  onComplete: (bidId: string) => void
  onCancel: () => void
}

type PaymentState = {
  step: 'payment' | 'broadcasting' | 'confirming' | 'complete' | 'error'
  transactionId: string | null
  error: string | null
  confirmations: number
}

export default function PaymentPSBTModal({
  auctionId,
  bidId,
  escrowAddress,
  bidAmount,
  quantity,
  currency,
  onComplete,
  onCancel,
}: PaymentPSBTModalProps) {
  const [state, setState] = React.useState<PaymentState>({
    step: 'payment',
    transactionId: null,
    error: null,
    confirmations: 0,
  })

  const [showQRCode, setShowQRCode] = React.useState(false)
  const [copied, setCopied] = React.useState(false)

  // Poll for confirmation after transaction is broadcast
  React.useEffect(() => {
    if (state.step === 'confirming' && state.transactionId) {
      const interval = setInterval(() => {
        checkConfirmation(state.transactionId!)
      }, 10000) // Poll every 10 seconds

      return () => clearInterval(interval)
    }
  }, [state.step, state.transactionId])

  async function checkConfirmation(txId: string) {
    try {
      // In a real implementation, this would query mempool API or similar
      // For now, simulate checking after some time
      const response = await fetch(`/api/clearing/bid-payment-status/${bidId}`)
      const json = await response.json()

      if (json.ok && json.data) {
        const bid = json.data
        if (bid.status === 'payment_confirmed') {
          setState(s => ({ ...s, step: 'complete', confirmations: 1 }))
        }
      }
    } catch (err) {
      console.error('Failed to check confirmation:', err)
    }
  }

  async function handleBroadcastTransaction(txId: string) {
    setState(s => ({ ...s, step: 'broadcasting', transactionId: txId, error: null }))

    try {
      // Confirm the bid payment with the transaction ID
      const response = await fetch('/api/clearing/confirm-bid-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bidId,
          transactionId: txId,
        }),
      })

      const json = await response.json()

      if (!response.ok || !json.ok) {
        throw new Error(json.error || 'Failed to confirm payment')
      }

      // Move to confirming state and wait for on-chain confirmation
      setState(s => ({ ...s, step: 'confirming' }))
    } catch (err) {
      setState(s => ({
        ...s,
        step: 'error',
        error: err instanceof Error ? err.message : 'Failed to broadcast transaction',
      }))
    }
  }

  async function handleManualPayment() {
    // User will manually send payment
    const txId = prompt('Enter the transaction ID after broadcasting your payment:')
    if (txId && txId.trim()) {
      await handleBroadcastTransaction(txId.trim())
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  function handleComplete() {
    onComplete(bidId)
  }

  // Payment instructions step
  if (state.step === 'payment') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Complete Payment
              </h3>
              <button
                onClick={onCancel}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Payment Details */}
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Bid Summary
                </h4>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Quantity:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{quantity} items</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Amount per Item:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatPrice(bidAmount / quantity, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2">
                    <span className="font-medium text-gray-900 dark:text-white">Total:</span>
                    <span className="font-bold text-lg text-blue-600 dark:text-blue-400">
                      {formatPrice(bidAmount, currency)}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Escrow Address
                </h4>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <code className="flex-1 text-xs font-mono break-all text-gray-900 dark:text-white">
                      {escrowAddress}
                    </code>
                    <button
                      onClick={() => copyToClipboard(escrowAddress)}
                      className="flex-shrink-0 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                      title="Copy address"
                    >
                      {copied ? '✓' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>

              {/* QR Code Section (optional) */}
              <div>
                <button
                  onClick={() => setShowQRCode(!showQRCode)}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {showQRCode ? 'Hide' : 'Show'} QR Code
                </button>
                {showQRCode && (
                  <div className="mt-3 p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 flex justify-center">
                    <div className="text-center">
                      <div className="inline-block p-4 bg-white">
                        {/* Placeholder for QR code - in real implementation, use a QR code library */}
                        <div className="w-48 h-48 bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-500">
                          QR Code
                          <br />
                          (requires QR library)
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Scan with your Bitcoin wallet
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Instructions */}
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4">
              <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
                Payment Instructions
              </h4>
              <ol className="text-sm text-blue-900 dark:text-blue-200 space-y-1 list-decimal list-inside">
                <li>Send exactly {formatPrice(bidAmount, currency)} to the escrow address above</li>
                <li>Use your Bitcoin wallet to create and sign the transaction</li>
                <li>Broadcast the transaction to the network</li>
                <li>Enter the transaction ID below to confirm your payment</li>
              </ol>
            </div>

            {/* Manual Transaction Entry */}
            <div>
              <button
                onClick={handleManualPayment}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                I've Sent the Payment
              </button>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                After broadcasting your transaction, click above to enter the transaction ID
              </p>
            </div>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onCancel}
              className="w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Broadcasting step
  if (state.step === 'broadcasting') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full mb-4">
              <svg className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Broadcasting Transaction
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Please wait while we confirm your payment...
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Confirming step
  if (state.step === 'confirming') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 dark:bg-yellow-900/20 rounded-full mb-4">
              <svg className="w-8 h-8 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Waiting for Confirmation
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Your payment has been broadcast. Waiting for on-chain confirmation...
            </p>
            {state.transactionId && (
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 mb-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Transaction ID:</p>
                <code className="text-xs font-mono break-all text-gray-900 dark:text-white">
                  {state.transactionId}
                </code>
              </div>
            )}
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
              <span>Polling for confirmation...</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Complete step
  if (state.step === 'complete') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full mb-4">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Payment Confirmed!
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Your bid payment has been confirmed. Your bid is now active in the auction.
            </p>
            {state.transactionId && (
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 mb-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Transaction ID:</p>
                <code className="text-xs font-mono break-all text-gray-900 dark:text-white">
                  {state.transactionId}
                </code>
              </div>
            )}
            <button
              onClick={handleComplete}
              className="w-full px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Error step
  if (state.step === 'error') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full mb-4">
              <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Payment Failed
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              {state.error || 'An error occurred while processing your payment.'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => setState(s => ({ ...s, step: 'payment', error: null }))}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}

function formatPrice(amountSats: number, currency: string): string {
  if (currency === 'BTC') {
    // Convert satoshis to BTC for display
    const btc = amountSats / 100000000
    return `${btc.toFixed(8)} BTC`
  }
  return `${amountSats.toLocaleString()} ${currency}`
}
