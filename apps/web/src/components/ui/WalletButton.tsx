import React, { useState } from 'react'
import clsx from 'clsx'
import { useWallet } from '../../lib/stores/wallet.react'
import { formatAddress, type WalletProvider } from '../../lib/wallet/walletAdapter'
import { useToast } from '../../lib/stores/toast.react'

type WalletButtonProps = {
  className?: string
}

export default function WalletButton({ className }: WalletButtonProps) {
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

  const toast = useToast()

  const [showMenu, setShowMenu] = useState(false)
  const [showNetworkMenu, setShowNetworkMenu] = useState(false)

  const defaultButtonClass = 'btn btn-primary h-11 px-5'
  const baseButtonClass = className ?? defaultButtonClass

  const handleConnect = async (provider: WalletProvider) => {
    setShowMenu(false)
    await connectWallet(provider)
  }

  const handleDisconnect = () => {
    setShowMenu(false)
    disconnectWallet()
  }

  const handleNetworkSwitch = (newNetwork: 'Mainnet' | 'Testnet' | 'Signet') => {
    setShowNetworkMenu(false)
    switchNetwork(newNetwork)
  }

  const handleCopyAddress = () => {
    if (wallet) {
      navigator.clipboard.writeText(wallet.paymentAddress)
      toast.success('Wallet address copied to clipboard', 'Address copied')
    }
  }

  React.useEffect(() => {
    if (error) {
      toast.error(error, 'Connection error', 5000)
      clearError()
    }
  }, [error, clearError, toast])

  if (isConnecting) {
    return (
      <div className="relative">
        <button
          disabled
          className={clsx(baseButtonClass, 'cursor-not-allowed opacity-80')}
        >
          <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Connecting…</span>
        </button>
      </div>
    )
  }

  if (wallet) {
    const connectedButtonClass = className ?? 'btn btn-secondary h-11 px-5'

    return (
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className={clsx(connectedButtonClass, 'gap-2 text-sm font-semibold')}
        >
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
          <span className="hidden sm:inline">{formatAddress(wallet.paymentAddress)}</span>
          <span className="sm:hidden">{formatAddress(wallet.paymentAddress, 4)}</span>
          <svg
            className={clsx('h-4 w-4 transition-transform', showMenu ? 'rotate-180' : '')}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
            <div className="card absolute right-0 z-50 mt-3 w-72 overflow-hidden">
              <div className="card-content space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Wallet</p>
                  <p className="text-sm font-medium text-foreground">{wallet.provider.charAt(0).toUpperCase() + wallet.provider.slice(1)}</p>
                  <p className="break-all text-xs text-muted-foreground">{wallet.paymentAddress}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Network:</span>
                    <span className={clsx(
                      'rounded-full px-2 py-0.5 text-xs font-medium',
                      network === 'Mainnet' 
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                        : network === 'Signet'
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                    )}>
                      {network}
                    </span>
                  </div>
                </div>

                <div className="grid gap-2">
                  <button
                    onClick={handleCopyAddress}
                    className="flex items-center justify-between rounded-2xl border border-border/60 bg-secondary/50 px-4 py-3 text-left text-foreground transition hover:border-primary/50 hover:bg-secondary/80"
                  >
                    <span>Copy address</span>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>

                  <button
                    onClick={() => {
                      setShowMenu(false)
                      setShowNetworkMenu(true)
                    }}
                    className="flex items-center justify-between rounded-2xl border border-border/60 bg-secondary/50 px-4 py-3 text-left text-foreground transition hover:border-primary/50 hover:bg-secondary/80"
                  >
                    <span>Switch network</span>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  </button>
                  <button
                    onClick={handleDisconnect}
                    className="flex items-center justify-between rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-left text-destructive transition hover:border-destructive/60 hover:bg-destructive/15"
                  >
                    <span>Disconnect</span>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {showNetworkMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowNetworkMenu(false)} />
            <div className="card absolute right-0 z-50 mt-3 w-64 overflow-hidden">
              <div className="card-content space-y-3">
                <div className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Select network</div>
                {(['Mainnet', 'Testnet', 'Signet'] as const).map((net) => (
                  <button
                    key={net}
                    onClick={() => handleNetworkSwitch(net)}
                    className={clsx(
                      'flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm transition',
                      network === net
                        ? 'border-primary/60 bg-primary/10 text-primary'
                        : 'border-border/60 bg-secondary/60 text-foreground hover:border-primary/40 hover:bg-secondary/80'
                    )}
                  >
                    <span>{net}</span>
                    {network === net && (
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className={clsx(baseButtonClass, 'gap-2 text-sm font-semibold')}
      >
        Connect wallet
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="card absolute right-0 z-50 mt-3 w-72 overflow-hidden">
            <div className="card-content space-y-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Select a wallet</p>
                <p className="text-sm text-muted-foreground">Connect to manage bids, balances, and payouts.</p>
              </div>
              <div className="grid gap-2">
                {availableWallets.map((provider) => (
                  <button
                    key={provider}
                    onClick={() => handleConnect(provider)}
                    className="flex w-full items-center justify-between rounded-2xl border border-border/60 bg-secondary/60 px-4 py-3 text-left text-sm font-semibold text-foreground transition hover:border-primary/50 hover:bg-secondary/80"
                  >
                    <span className="capitalize">{provider}</span>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
