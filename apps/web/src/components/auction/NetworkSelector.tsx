/**
 * Network Selector Component
 * 
 * Allows users to select the auction network
 * Shows available networks and their status
 */

import React from 'react'
import {
  getSupportedNetworks,
  getNetworkConfig,
  isNetworkEnabled,
  type AppNetwork,
} from '../../lib/config/networks'

export interface NetworkSelectorProps {
  value: AppNetwork
  onChange: (network: AppNetwork) => void
  disabled?: boolean
  className?: string
  label?: string
  showDescription?: boolean
}

export function NetworkSelector({
  value,
  onChange,
  disabled = false,
  className = '',
  label = 'Auction Network',
  showDescription = true,
}: NetworkSelectorProps) {
  const supportedNetworks = getSupportedNetworks()
  const selectedConfig = getNetworkConfig(value)

  return (
    <div className={className}>
      <label className="block mb-2">
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {label}
        </span>
        {showDescription && (
          <span className="block text-xs text-gray-600 dark:text-gray-400 mt-0.5">
            Select which Bitcoin network to create this auction on
          </span>
        )}
      </label>

      <div className="space-y-2">
        {supportedNetworks.map((network) => {
          const config = getNetworkConfig(network)
          const isEnabled = isNetworkEnabled(network)
          const isSelected = value === network
          const isDisabled = disabled || !isEnabled

          return (
            <button
              key={network}
              type="button"
              onClick={() => !isDisabled && onChange(network)}
              disabled={isDisabled}
              className={`
                w-full text-left px-4 py-3 rounded-lg border-2 transition-all
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                ${
                  isSelected
                    ? `${config.badge.borderColor} ${config.badge.bgColor} ${config.badge.color}`
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                }
                ${
                  isDisabled
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:border-blue-300 dark:hover:border-blue-600 cursor-pointer'
                }
              `}
              aria-pressed={isSelected}
              aria-disabled={isDisabled}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Radio indicator */}
                  <div
                    className={`
                      w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0
                      ${
                        isSelected
                          ? 'border-current'
                          : 'border-gray-300 dark:border-gray-600'
                      }
                    `}
                  >
                    {isSelected && (
                      <div className="w-2.5 h-2.5 rounded-full bg-current" />
                    )}
                  </div>

                  <div>
                    <div className="font-medium text-sm">
                      {config.displayName}
                    </div>
                    {!isEnabled && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Not available in production
                      </div>
                    )}
                  </div>
                </div>

                {isSelected && (
                  <svg
                    className="h-5 w-5 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Help text */}
      <div className="mt-3 text-xs text-gray-600 dark:text-gray-400 space-y-1">
        <p>
          <strong>Mainnet:</strong> Real Bitcoin network with real value. Use for production.
        </p>
        <p>
          <strong>Testnet:</strong> Test network with test Bitcoin. No real value.
        </p>
        <p>
          <strong>Signet:</strong> More reliable test network with predictable blocks.
        </p>
        <p>
          <strong>Regtest:</strong> Local development network for testing.
        </p>
      </div>
    </div>
  )
}
