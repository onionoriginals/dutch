/**
 * Network Change Notification Component
 * 
 * Notifies the user when their wallet network has changed
 * and gives them the option to sync the auction network
 */

import React from 'react'
import { getNetworkConfig, type AppNetwork } from '../../lib/config/networks'

export interface NetworkChangeNotificationProps {
  detectedNetwork: AppNetwork
  currentNetwork: AppNetwork
  onAccept: () => void
  onDismiss: () => void
  className?: string
}

export function NetworkChangeNotification({
  detectedNetwork,
  currentNetwork,
  onAccept,
  onDismiss,
  className = '',
}: NetworkChangeNotificationProps) {
  const detectedConfig = getNetworkConfig(detectedNetwork)
  const currentConfig = getNetworkConfig(currentNetwork)
  
  return (
    <div
      className={`rounded-lg border-2 border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20 p-4 ${className}`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        {/* Info Icon */}
        <svg
          className="h-6 w-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>

        <div className="flex-1">
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
            Wallet Network Changed
          </h3>
          <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
            Your wallet network changed to <strong>{detectedConfig.displayName}</strong>. 
            Your auction is currently configured for <strong>{currentConfig.displayName}</strong>.
            Would you like to update the auction network to match your wallet?
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onAccept}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Update to {detectedConfig.shortName}
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="px-4 py-2 bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 text-blue-900 dark:text-blue-100 text-sm font-medium rounded-lg border border-blue-300 dark:border-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Keep {currentConfig.shortName}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
