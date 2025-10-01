import React, { useState } from 'react'
import { useWallet } from '../../lib/wallet/WalletContext'
import { formatAddress, type WalletProvider } from '../../lib/wallet/walletAdapter'

export default function WalletButton() {
  const {
    wallet,
    isConnecting,
    error,
    network,
    availableWallets,
    connectWallet,
    disconnectWallet,
    switchNetwork,
    clearError,
  } = useWallet()

  const [showMenu, setShowMenu] = useState(false)
  const [showNetworkMenu, setShowNetworkMenu] = useState(false)
  const [showCopiedToast, setShowCopiedToast] = useState(false)

  const handleConnect = async (provider: WalletProvider) => {
    setShowMenu(false)
    await connectWallet(provider)
  }

  const handleDisconnect = () => {
    setShowMenu(false)
    disconnectWallet()
  }

  const handleNetworkSwitch = (newNetwork: 'Mainnet' | 'Testnet') => {
    setShowNetworkMenu(false)
    switchNetwork(newNetwork)
  }

  const handleCopyAddress = () => {
    if (wallet) {
      navigator.clipboard.writeText(wallet.paymentAddress)
      setShowCopiedToast(true)
      setTimeout(() => setShowCopiedToast(false), 3000)
    }
  }

  // Show error toast if there's an error
  React.useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        clearError()
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [error, clearError])

  if (isConnecting) {
    return (
      <div className="relative">
        <button
          disabled
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white opacity-75 cursor-not-allowed"
        >
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Connecting...
        </button>
      </div>
    )
  }

  if (wallet) {
    return (
      <div className="relative">
        {/* Connected State */}
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <div className="h-2 w-2 rounded-full bg-green-500"></div>
          <span className="hidden sm:inline">{formatAddress(wallet.paymentAddress)}</span>
          <span className="sm:hidden">{formatAddress(wallet.paymentAddress, 4)}</span>
          <svg
            className={`h-4 w-4 transition-transform ${showMenu ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown Menu */}
        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowMenu(false)}
            />
            <div className="absolute right-0 z-50 mt-2 w-72 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Connected with {wallet.provider.charAt(0).toUpperCase() + wallet.provider.slice(1)}
                </div>
                <div className="text-sm font-medium text-gray-900 dark:text-white break-all">
                  {wallet.paymentAddress}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Network:</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                    network === 'Mainnet' 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                  }`}>
                    {network}
                  </span>
                </div>
              </div>

              <div className="p-2">
                <button
                  onClick={handleCopyAddress}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy Address
                </button>

                <button
                  onClick={() => {
                    setShowMenu(false)
                    setShowNetworkMenu(true)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  Switch Network
                </button>

                <button
                  onClick={handleDisconnect}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Disconnect
                </button>
              </div>
            </div>
          </>
        )}

        {/* Network Switch Menu */}
        {showNetworkMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowNetworkMenu(false)}
            />
            <div className="absolute right-0 z-50 mt-2 w-56 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
              <div className="p-2">
                <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                  Select Network
                </div>
                <button
                  onClick={() => handleNetworkSwitch('Mainnet')}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded transition-colors ${
                    network === 'Mainnet'
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  <span>Mainnet</span>
                  {network === 'Mainnet' && (
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => handleNetworkSwitch('Testnet')}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded transition-colors ${
                    network === 'Testnet'
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  <span>Testnet</span>
                  {network === 'Testnet' && (
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  // Not connected state
  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        Connect Wallet
      </button>

      {/* Wallet Selection Menu */}
      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-0 z-50 mt-2 w-64 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Connect a Wallet
              </h3>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Choose your Bitcoin wallet to continue
              </p>
            </div>

            <div className="p-2">
              {availableWallets.length === 0 ? (
                <div className="px-3 py-4 text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    No Bitcoin wallet detected.
                  </p>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                    Please install Unisat, Leather, or Xverse wallet extension.
                  </p>
                </div>
              ) : (
                <>
                  {availableWallets.includes('unisat') && (
                    <button
                      onClick={() => handleConnect('unisat')}
                      className="w-full flex items-center gap-3 px-3 py-3 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                    >
                      <div className="h-8 w-8 rounded bg-orange-500 flex items-center justify-center text-white font-bold">
                        U
                      </div>
                      <span>Unisat Wallet</span>
                    </button>
                  )}

                  {availableWallets.includes('leather') && (
                    <button
                      onClick={() => handleConnect('leather')}
                      className="w-full flex items-center gap-3 px-3 py-3 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                    >
                      <div className="h-8 w-8 rounded bg-purple-500 flex items-center justify-center text-white font-bold">
                        L
                      </div>
                      <span>Leather Wallet</span>
                    </button>
                  )}

                  {availableWallets.includes('xverse') && (
                    <button
                      onClick={() => handleConnect('xverse')}
                      className="w-full flex items-center gap-3 px-3 py-3 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                    >
                      <div className="h-8 w-8 rounded bg-blue-500 flex items-center justify-center text-white font-bold">
                        X
                      </div>
                      <span>Xverse Wallet</span>
                    </button>
                  )}
                </>
              )}
            </div>

            <div className="p-3 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                Current Network: <span className="font-medium">{network}</span>
              </p>
            </div>
          </div>
        </>
      )}

      {/* Error Toast */}
      {error && (
        <div className="fixed top-4 right-4 z-50 max-w-sm rounded-lg border border-red-200 bg-red-50 p-4 shadow-lg dark:border-red-800 dark:bg-red-900/20">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Connection Error
              </h3>
              <p className="mt-1 text-xs text-red-700 dark:text-red-300">
                {error}
              </p>
            </div>
            <button
              onClick={clearError}
              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Success Toast - Address Copied */}
      {showCopiedToast && (
        <div className="fixed top-4 right-4 z-50 max-w-sm rounded-lg border border-green-200 bg-green-50 p-4 shadow-lg dark:border-green-800 dark:bg-green-900/20 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-green-800 dark:text-green-200">
                Address Copied!
              </h3>
              <p className="mt-1 text-xs text-green-700 dark:text-green-300">
                Wallet address copied to clipboard
              </p>
            </div>
            <button
              onClick={() => setShowCopiedToast(false)}
              className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
