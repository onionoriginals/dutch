import React from 'react'
import { useWallet, useWalletAddress } from '../../lib/stores/wallet.react'
import { useToast } from '../../lib/stores/toast.react'

/**
 * Example component that demonstrates store usage across multiple islands.
 * This can be in a separate island from WalletButton and both will share state.
 */
export default function WalletStatus() {
  const { wallet, network } = useWallet()
  const address = useWalletAddress()
  const { info } = useToast()
  
  const handleShowInfo = () => {
    info(`Connected to ${network} network`, 'Network Info')
  }

  if (!wallet) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          No wallet connected. Click "Connect Wallet" to get started.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-sm font-medium text-green-900 dark:text-green-100">
            Wallet Connected
          </h3>
          <div className="mt-2 space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-green-700 dark:text-green-300">Provider:</span>
              <span className="font-medium text-green-900 dark:text-green-100">
                {wallet.provider.charAt(0).toUpperCase() + wallet.provider.slice(1)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-700 dark:text-green-300">Network:</span>
              <span className="font-medium text-green-900 dark:text-green-100">
                {network}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-700 dark:text-green-300">Address:</span>
              <code className="font-mono text-xs text-green-900 dark:text-green-100">
                {address}
              </code>
            </div>
          </div>
        </div>
        <button
          onClick={handleShowInfo}
          className="text-xs text-green-700 hover:text-green-900 dark:text-green-300 dark:hover:text-green-100 underline"
        >
          Show Info
        </button>
      </div>
    </div>
  )
}
