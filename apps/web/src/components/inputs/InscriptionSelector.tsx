import React from 'react'
import { getInscriptions, type Inscription, type WalletProvider, type BitcoinNetworkType } from '../../lib/wallet/walletAdapter'
import { InscriptionPreview } from './InscriptionPreview'

export interface InscriptionSelectorProps {
  value?: string // newline-separated inscription IDs
  onChange?: (value: string) => void
  walletProvider?: WalletProvider
  walletAddress?: string
  walletNetwork?: BitcoinNetworkType
  disabled?: boolean
  placeholder?: string
}

export function InscriptionSelector({
  value = '',
  onChange,
  walletProvider,
  walletAddress,
  walletNetwork,
  disabled = false,
  placeholder = 'e.g.\nabc123...def456i0\n789abc...123def i1\nxyz987...654abci0',
}: InscriptionSelectorProps) {
  const [inscriptions, setInscriptions] = React.useState<Inscription[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [showManualInput, setShowManualInput] = React.useState(false)

  // Parse current value into selected IDs
  React.useEffect(() => {
    if (value) {
      const ids = value
        .split('\n')
        .map(id => id.trim())
        .filter(id => id.length > 0)
      setSelectedIds(new Set(ids))
    }
  }, [value])

  // Fetch inscriptions when wallet is connected
  React.useEffect(() => {
    if (!walletProvider || !walletAddress) {
      return
    }

    const fetchInscriptions = async () => {
      setIsLoading(true)
      setError(null)
      
      try {
        const fetchedInscriptions = await getInscriptions(walletProvider, walletAddress, walletNetwork)
        setInscriptions(fetchedInscriptions)
        
        if (fetchedInscriptions.length === 0) {
          setError('No inscriptions found in your wallet')
        }
      } catch (err) {
        console.error('Failed to fetch inscriptions:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch inscriptions')
      } finally {
        setIsLoading(false)
      }
    }

    fetchInscriptions()
  }, [walletProvider, walletAddress, walletNetwork])

  const handleToggleInscription = (inscriptionId: string) => {
    const newSelected = new Set(selectedIds)
    
    if (newSelected.has(inscriptionId)) {
      newSelected.delete(inscriptionId)
    } else {
      newSelected.add(inscriptionId)
    }
    
    setSelectedIds(newSelected)
    
    // Update parent component
    const newValue = Array.from(newSelected).join('\n')
    onChange?.(newValue)
  }

  const handleSelectAll = () => {
    const allIds = new Set(inscriptions.map(ins => ins.inscriptionId))
    setSelectedIds(allIds)
    onChange?.(Array.from(allIds).join('\n'))
  }

  const handleDeselectAll = () => {
    setSelectedIds(new Set())
    onChange?.('')
  }

  const handleManualInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    onChange?.(newValue)
  }

  // If wallet is not connected, show manual input
  if (!walletProvider || !walletAddress) {
    return (
      <div>
        <textarea
          value={value}
          onChange={handleManualInputChange}
          placeholder={placeholder}
          rows={6}
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed font-mono text-sm"
        />
        <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
          💡 Connect your wallet to select inscriptions from your collection
        </div>
      </div>
    )
  }

  // Manual input mode
  if (showManualInput) {
    return (
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Manual Input
          </label>
          <button
            type="button"
            onClick={() => setShowManualInput(false)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            ← Back to wallet inscriptions
          </button>
        </div>
        <textarea
          value={value}
          onChange={handleManualInputChange}
          placeholder={placeholder}
          rows={6}
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed font-mono text-sm"
        />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header with actions */}
      <div className="flex justify-between items-center">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {isLoading ? (
            'Loading inscriptions...'
          ) : (
            `Your Inscriptions (${inscriptions.length})`
          )}
        </div>
        <div className="flex gap-2">
          {inscriptions.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleSelectAll}
                disabled={disabled || isLoading}
                className="text-xs px-2 py-1 text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={handleDeselectAll}
                disabled={disabled || isLoading}
                className="text-xs px-2 py-1 text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
              >
                Deselect All
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setShowManualInput(true)}
            className="text-xs px-2 py-1 text-gray-600 dark:text-gray-400 hover:underline"
          >
            Manual Input
          </button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <svg className="animate-spin h-8 w-8 text-blue-600 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      )}

      {/* Error state */}
      {error && !isLoading && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">{error}</p>
          <button
            type="button"
            onClick={() => setShowManualInput(true)}
            className="mt-2 text-sm text-yellow-700 dark:text-yellow-300 underline"
          >
            Enter inscription IDs manually instead
          </button>
        </div>
      )}

      {/* Inscriptions list */}
      {!isLoading && !error && inscriptions.length > 0 && (
        <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
          <div className="max-h-96 overflow-y-auto">
            {inscriptions.map((inscription) => (
              <label
                key={inscription.inscriptionId}
                className={`flex items-start gap-3 p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-700 last:border-b-0 transition-colors ${
                  selectedIds.has(inscription.inscriptionId)
                    ? 'bg-blue-50 dark:bg-blue-900/20'
                    : 'bg-white dark:bg-gray-800'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(inscription.inscriptionId)}
                  onChange={() => handleToggleInscription(inscription.inscriptionId)}
                  disabled={disabled}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                />
                
                {/* Inscription Preview */}
                <InscriptionPreview
                  inscriptionId={inscription.inscriptionId}
                  contentType={inscription.contentType}
                  inscriptionNumber={inscription.inscriptionNumber}
                />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {inscription.inscriptionNumber !== undefined && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                        #{inscription.inscriptionNumber}
                      </span>
                    )}
                    {inscription.contentType && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {inscription.contentType}
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-xs text-gray-900 dark:text-gray-100 break-all">
                    {inscription.inscriptionId}
                  </div>
                  {inscription.outputValue > 0 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {inscription.outputValue} sats
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Selected count */}
      {selectedIds.size > 0 && (
        <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
          📦 {selectedIds.size} inscription{selectedIds.size !== 1 ? 's' : ''} selected
        </div>
      )}
    </div>
  )
}
