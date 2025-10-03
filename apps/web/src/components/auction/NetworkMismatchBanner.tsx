/**
 * Network Mismatch Banner Component
 * 
 * Displays warning when wallet and wizard networks don't match
 * Provides CTAs to resolve the mismatch
 */

import React from 'react'
import { getNetworkConfig, type AppNetwork } from '../../lib/config/networks'
import type { BitcoinNetworkType } from '../../lib/wallet/walletAdapter'

export interface NetworkMismatchBannerProps {
  walletNetwork: AppNetwork
  wizardNetwork: AppNetwork
  onSwitchWizardToWallet: () => void
  onSwitchWalletToWizard: () => void
  className?: string
}

export function NetworkMismatchBanner({
  walletNetwork,
  wizardNetwork,
  onSwitchWizardToWallet,
  onSwitchWalletToWizard,
  className = '',
}: NetworkMismatchBannerProps) {
  const walletConfig = getNetworkConfig(walletNetwork)
  const wizardConfig = getNetworkConfig(wizardNetwork)
  
  return (
    <div
      className={`rounded-lg border-2 border-yellow-400 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 p-4 ${className}`}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-3">
        {/* Warning Icon */}
        <svg
          className="h-6 w-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>

        <div className="flex-1">
          <h3 className="text-sm font-semibold text-yellow-900 dark:text-yellow-100 mb-1">
            Network Mismatch Detected
          </h3>
          <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-3">
            Your wallet is connected to <strong>{walletConfig.displayName}</strong>, but this auction is configured for{' '}
            <strong>{wizardConfig.displayName}</strong>. Please resolve this mismatch before creating the auction.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onSwitchWizardToWallet}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2"
            >
              Switch Auction to {walletConfig.shortName}
            </button>
            <button
              type="button"
              onClick={onSwitchWalletToWizard}
              className="px-4 py-2 bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 text-yellow-900 dark:text-yellow-100 text-sm font-medium rounded-lg border border-yellow-300 dark:border-yellow-700 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2"
            >
              Reconnect Wallet to {wizardConfig.shortName}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
