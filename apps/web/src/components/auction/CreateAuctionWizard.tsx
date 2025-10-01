import React from 'react'
import { Form, FormStep, FormField, FieldLabel, FieldError, useFormWizard, ControlAdapter } from '../form'
import { Input } from '../inputs/Input'
import { NumberInput } from '../inputs/NumberInput'
import { Textarea } from '../inputs/Textarea'
import { DateTimePicker } from '../inputs/DateTimePicker'
import { DutchAuctionSchema, dutchAuctionStepFields } from '../../lib/validation/auction'
import { normalizeDutch } from '../../utils/normalizeAuction'
import { btcToSats, formatSats, btcToUsd, formatCurrency, getBtcUsdRate } from '../../utils/currency'
import { signPsbt, connectWallet } from '../../lib/bitcoin/psbtSigner'
import { broadcastTransaction, pollForConfirmations, getMempoolLink, extractTransactionFromPsbt, type TransactionStatus } from '../../lib/bitcoin/broadcastTransaction'
import { verifyMultipleInscriptions, checkAllValid, type Network } from '../../lib/bitcoin/verifyInscription'
import { useWallet } from '../../lib/stores/wallet.react'

type DraftShape = {
  values: any
}

const DRAFT_KEY = 'auction-create-draft-v1'

function useDraftPersistence(values: any) {
  const [restored, setRestored] = React.useState(null as Partial<DraftShape> | null)

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as DraftShape
        setRestored(parsed)
      }
    } catch {}
  }, [])

  React.useEffect(() => {
    const data: DraftShape = { values }
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(data))
    } catch {}
  }, [values])

  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY) } catch {}
  }

  return { restored, clearDraft }
}

function useNavigationGuard(isDirty: boolean) {
  React.useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (!isDirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])
}

export default function CreateAuctionWizard() {
  const type = 'dutch' as const
  const schema = DutchAuctionSchema
  const steps = dutchAuctionStepFields
  const { wallet } = useWallet()

  const [formValues, setFormValues] = React.useState({} as any)
  const { restored, clearDraft } = useDraftPersistence(formValues)

  const [submittedPayload, setSubmittedPayload] = React.useState(null as any | null)
  const [psbtSigningState, setPsbtSigningState] = React.useState<{
    stage: 'idle' | 'wallet_connect' | 'api_call' | 'signing' | 'broadcasting' | 'confirming' | 'success' | 'error'
    psbt?: string
    auctionId?: string
    auctionAddress?: string
    txid?: string
    confirmations?: number
    error?: string
    inscriptionInfo?: any
  }>({ stage: 'idle' })
  const [isVerifying, setIsVerifying] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [verificationError, setVerificationError] = React.useState<string | null>(null)

  const defaultValues = React.useMemo(() => {
    if (restored?.values) return restored.values as Record<string, unknown>
    return {}
  }, [restored])

  // consider any non-empty form values as dirty
  const isDirty = React.useMemo(() => Object.keys(formValues || {}).length > 0, [formValues])
  useNavigationGuard(isDirty)

  const onSubmit = React.useCallback(async (values: any) => {
    const payload = normalizeDutch(values)
    setVerificationError(null)
    
    try {
      // Check if wallet is connected
      if (!wallet) {
        throw new Error('Please connect your wallet to create an auction')
      }

      // Parse inscription IDs (one per line)
      const inscriptionIds = values.inscriptionIds
        .split('\n')
        .map((id: string) => id.trim())
        .filter((id: string) => id.length > 0)
      
      // Get seller address (prefer wallet address, fallback to manual input)
      const sellerAddress = wallet?.paymentAddress || values.sellerAddress?.trim() || ''
      
      if (!sellerAddress) {
        throw new Error('Seller address is required. Please connect your wallet or enter an address manually.')
      }
      
      if (inscriptionIds.length === 0) {
        throw new Error('At least one inscription ID is required')
      }
      
      // Determine network from environment or default to testnet for safety
      const network: Network = ((import.meta as any)?.env?.PUBLIC_BITCOIN_NETWORK as Network) || 'testnet'
      
      // Step 1: Verify inscription ownership before creating auction
      setIsVerifying(true)
      console.log(`Verifying ${inscriptionIds.length} inscription(s) on ${network}...`)
      
      const verificationResults = await verifyMultipleInscriptions(
        inscriptionIds,
        sellerAddress,
        network
      )
      
      const { allValid, errors } = checkAllValid(verificationResults)
      setIsVerifying(false)
      
      if (!allValid) {
        const errorMessages = errors.map((e, i) => `${i + 1}. ${e.error}`).join('\n')
        const errorMsg = `Inscription verification failed:\n${errorMessages}`
        setVerificationError(errorMsg)
        throw new Error(errorMsg)
      }
      
      console.log('✓ All inscriptions verified successfully')
      
      // For now, we'll use the first inscription for single-item auction
      // TODO: Handle multiple inscriptions for clearing auctions
      const primaryInscriptionId = inscriptionIds[0]
      
      // Step 2: Calculate quantity and duration
      const quantity = inscriptionIds.length
      const duration = Math.floor(
        (new Date(values.endTime).getTime() - new Date(values.startTime).getTime()) / 1000
      )
      
      // Step 3: Call API to create auction and get PSBT
      setPsbtSigningState({ stage: 'api_call' })
      setIsSubmitting(true)
      
      const response = await fetch('/api/create-auction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          asset: primaryInscriptionId,
          startPrice: values.startPrice,
          minPrice: values.endPrice,
          duration: duration,
          decrementInterval: values.decrementIntervalSeconds,
          sellerAddress: sellerAddress,
        }),
      })

      const result = await response.json()
      setIsSubmitting(false)
      
      if (!response.ok || !result.ok) {
        const errorMsg = result.error || 'Failed to create auction'
        const errorCode = result.code || ''
        
        // Provide user-friendly error messages based on error codes
        let userMessage = errorMsg
        if (errorCode === 'OWNERSHIP_MISMATCH') {
          userMessage = `⚠️ Ownership Verification Failed\n\n${errorMsg}\n\nPlease ensure you own the inscription and that the correct seller address is provided.`
        } else if (errorCode === 'ALREADY_SPENT') {
          userMessage = `⚠️ Inscription Already Spent\n\n${errorMsg}\n\nThis inscription cannot be auctioned because it has already been transferred or spent.`
        } else if (errorCode === 'NOT_FOUND' || errorCode === 'OUTPUT_NOT_FOUND') {
          userMessage = `⚠️ Inscription Not Found\n\n${errorMsg}\n\nPlease verify the inscription ID is correct and exists on ${network}.`
        }
        
        throw new Error(userMessage)
      }

      const { id: auctionId, address: auctionAddress, psbt, inscriptionInfo } = result.data
      
      console.log('Auction created, PSBT generated:', { auctionId, auctionAddress })
      
      // Step 4: Store PSBT and wait for user to sign
      setPsbtSigningState({
        stage: 'signing',
        psbt,
        auctionId,
        auctionAddress,
        inscriptionInfo,
      })
      
    } catch (error) {
      console.error('Failed to create auction:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      setPsbtSigningState({
        stage: 'error',
        error: errorMessage,
      })
    } finally {
      setIsVerifying(false)
      setIsSubmitting(false)
    }
  }, [wallet])
  
  // Handler for PSBT signing after user clicks "Sign with Wallet"
  const handleSignPsbt = React.useCallback(async () => {
    if (!psbtSigningState.psbt || !psbtSigningState.auctionId) {
      return
    }
    
    try {
      setPsbtSigningState(prev => ({ ...prev, stage: 'signing' }))
      
      // Sign PSBT with wallet
      const signResult = await signPsbt(psbtSigningState.psbt, {
        autoFinalize: true,
      })
      
      if (!signResult.success || !signResult.signedPsbt) {
        throw new Error(signResult.error || 'Failed to sign PSBT')
      }
      
      console.log('PSBT signed successfully')
      
      // Step 4: Extract transaction hex from signed PSBT
      setPsbtSigningState(prev => ({ ...prev, stage: 'broadcasting' }))
      
      // Extract raw transaction hex from signed PSBT
      // This handles both cases: wallet returning PSBT or raw hex
      const transactionHex = await extractTransactionFromPsbt(signResult.signedPsbt)
      
      console.log('Transaction extracted from PSBT')
      
      // Step 5: Broadcast transaction to Bitcoin network
      const broadcastResult = await broadcastTransaction(transactionHex, 'testnet')
      
      if (!broadcastResult.success || !broadcastResult.txid) {
        throw new Error(broadcastResult.error || 'Failed to broadcast transaction')
      }
      
      const txid = broadcastResult.txid
      console.log('Transaction broadcast:', txid)
      
      // Step 6: Confirm escrow with API
      await fetch(`/api/auction/${psbtSigningState.auctionId}/confirm-escrow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionId: txid,
          signedPsbt: signResult.signedPsbt,
        }),
      })
      
      // Step 7: Poll for confirmations
      setPsbtSigningState(prev => ({
        ...prev,
        stage: 'confirming',
        txid,
        confirmations: 0,
      }))
      
      // Poll with progress callback
      await pollForConfirmations(txid, 'testnet', {
        targetConfirmations: 1,
        maxAttempts: 60,
        pollIntervalMs: 5000,
        onProgress: (status: TransactionStatus) => {
          setPsbtSigningState(prev => ({
            ...prev,
            confirmations: status.confirmations,
          }))
        },
      })
      
      // Step 8: Success!
      setPsbtSigningState(prev => ({
        ...prev,
        stage: 'success',
      }))
      
      clearDraft()
      
    } catch (error) {
      console.error('PSBT signing workflow failed:', error)
      setPsbtSigningState(prev => ({
        ...prev,
        stage: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }))
    }
  }, [psbtSigningState.psbt, psbtSigningState.auctionId, clearDraft])

  const handleValuesChange = React.useCallback((v: any) => {
    setFormValues(v)
  }, [])

  // Show PSBT signing workflow UI if in progress
  if (psbtSigningState.stage !== 'idle') {
    return <PsbtSigningWorkflow state={psbtSigningState} onSign={handleSignPsbt} onRetry={() => setPsbtSigningState({ stage: 'idle' })} />
  }

  if (submittedPayload) {
    return (
      <div className="rounded-lg bg-green-50 p-8 text-center dark:bg-green-900/20">
        <div className="text-green-600 dark:text-green-400">
          <svg className="mx-auto h-16 w-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-2xl font-bold mb-2">Clearing Auction Created Successfully!</h2>
          <p className="text-lg mb-6">Your Dutch clearing auction "{submittedPayload.title}" has been created.</p>
          
          <div className="bg-white/80 dark:bg-gray-800/80 rounded-lg p-4 text-left mb-6">
            <h3 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">Auction Details:</h3>
            <div className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
              <p><strong>Type:</strong> Dutch Clearing Auction (Uniform Price)</p>
              <p><strong>Title:</strong> {submittedPayload.title}</p>
              {submittedPayload.description && <p><strong>Description:</strong> {submittedPayload.description}</p>}
              <p><strong>Start Time:</strong> {new Date(submittedPayload.timing.startTime).toLocaleString()}</p>
              <p><strong>End Time:</strong> {new Date(submittedPayload.timing.endTime).toLocaleString()}</p>
            </div>
          </div>

          <div className="flex gap-4 justify-center">
            <button 
              onClick={() => setSubmittedPayload(null)}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              Create Another Auction
            </button>
            <button 
              onClick={() => window.location.href = '/'}
              className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500"
            >
              Back to Home
            </button>
          </div>
          
          <details className="mt-6 text-left">
            <summary className="cursor-pointer text-sm underline">View Raw Payload</summary>
            <pre className="mt-2 text-xs bg-gray-100 dark:bg-gray-800 p-3 rounded overflow-auto text-gray-800 dark:text-gray-200" style={{ whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(submittedPayload, null, 2)}
            </pre>
          </details>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header className="border-b border-gray-200 pb-4 dark:border-gray-700">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Create Clearing Auction</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Set up a uniform-price Dutch auction where multiple items are sold and all winners pay the same clearing price</p>
        <WizardPreviewButton type={type} values={formValues} className="mt-3" />
        
        {/* Wallet Connection Status */}
        {wallet ? (
          <div className="mt-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3">
            <div className="flex items-center gap-2 text-sm">
              <div className="h-2 w-2 rounded-full bg-green-500"></div>
              <span className="text-green-800 dark:text-green-200 font-medium">
                Wallet Connected:
              </span>
              <span className="text-green-700 dark:text-green-300 font-mono">
                {wallet.paymentAddress}
              </span>
            </div>
            <p className="text-xs text-green-700 dark:text-green-300 mt-1 ml-4">
              This address will be used as the seller address for your auction
            </p>
          </div>
        ) : (
          <div className="mt-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3">
            <div className="flex items-start gap-2">
              <svg className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
                  Wallet Not Connected
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                  Please connect your Bitcoin wallet using the button in the top right corner to create an auction. Your wallet address will be used as the seller address.
                </p>
              </div>
            </div>
          </div>
        )}
      </header>

      <Form
        schema={schema}
        defaultValues={defaultValues}
        onSubmit={onSubmit}
        className="space-y-6"
      >
        {/* Progress indicator within wizard context */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Auction Details</h3>
          <StepProgress total={steps.length + 1} />
        </div>
        <FormAutosave onValuesChange={handleValuesChange} />
        <FormStepRouter />

        {/* Step 1: Details */}
        <FormStep fields={steps[0]!}> 
          <div id="details" className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-6">
            <div>
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Basic Information</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Enter the basic details for your auction</p>
            </div>
            <FormField name="title">
              <FieldLabel>Title</FieldLabel>
              <Input placeholder="Amazing item" />
              <FieldError />
            </FormField>
            <FormField name="description">
              <FieldLabel>Description</FieldLabel>
              <Textarea placeholder="Optional description (max 500 characters)" rows={4} />
              <FieldError />
            </FormField>
            <StepNav />
          </div>
        </FormStep>

        {/* Step 2: Items */}
        <FormStep fields={steps[1]!}> 
          <div id="items" className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-6">
            <div>
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Auction Items</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Specify the inscriptions being auctioned and your Bitcoin address</p>
            </div>
            <FormField name="inscriptionIds">
              <FieldLabel>Inscription IDs (one per line)</FieldLabel>
              <Textarea 
                placeholder="e.g.&#10;abc123...def456i0&#10;789abc...123def i1&#10;xyz987...654abci0" 
                rows={6}
              />
              <InscriptionCountHelper />
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Enter inscription IDs in the format: &lt;txid&gt;i&lt;vout&gt; (one per line)
              </div>
              <FieldError />
            </FormField>
            <FormField name="sellerAddress">
              <FieldLabel>Your Bitcoin Address (Seller)</FieldLabel>
              <Input placeholder="e.g. bc1q... or tb1q..." />
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                This address must own all the inscriptions listed above. Ownership will be verified before auction creation.
              </div>
              <FieldError />
            </FormField>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-900 dark:text-blue-200">
                💡 <strong>Clearing Auction:</strong> Multiple bidders can place bids. Once enough bids come in to cover all items, the auction clears and everyone pays the same clearing price (the lowest winning bid).
              </p>
            </div>
            <StepNav />
          </div>
        </FormStep>

        {/* Step 3: Pricing */}
        <FormStep fields={steps[2]!}> 
          <div id="pricing" className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-6">
            <div>
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Pricing</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Set the starting and ending price for your Dutch auction in BTC</p>
            </div>
            <FormField name="startPrice">
              <FieldLabel>Start price (BTC)</FieldLabel>
              <NumberInput min={0} step="0.00000001" inputMode="decimal" />
              <PriceHelper fieldName="startPrice" />
              <FieldError />
            </FormField>
            <FormField name="endPrice">
              <FieldLabel>End price (BTC)</FieldLabel>
              <NumberInput min={0} step="0.00000001" inputMode="decimal" />
              <PriceHelper fieldName="endPrice" />
              <EndPriceValidationHelper />
              <FieldError />
            </FormField>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-900 dark:text-blue-200">
                💡 <strong>Dutch Auction:</strong> The price starts high and decreases over time until someone buys or it reaches the end price.
              </p>
            </div>
            <StepNav />
          </div>
        </FormStep>

        {/* Step 4: Price Schedule */}
        <FormStep fields={steps[3]!}> 
          <div id="schedule" className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-6">
            <div>
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Price Schedule</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Configure how the price decreases over time</p>
            </div>
            <FormField name="decrementAmount">
              <FieldLabel>Decrement amount (BTC)</FieldLabel>
              <NumberInput min={0} step="0.00000001" inputMode="decimal" />
              <PriceHelper fieldName="decrementAmount" />
              <FieldError />
            </FormField>
            <FormField name="decrementIntervalSeconds">
              <FieldLabel>Decrement interval (seconds)</FieldLabel>
              <NumberInput min={1} inputMode="numeric" />
              <FieldError />
            </FormField>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-900 dark:text-blue-200">
                💡 The price will drop by the decrement amount every interval until it reaches the end price.
              </p>
            </div>
            <StepNav />
          </div>
        </FormStep>

        {/* Step 5: Timing */}
        <FormStep fields={steps[4]!}> 
          <div id="timing" className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-6">
            <div>
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Auction Timing</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Set when your auction starts and ends</p>
            </div>
            <QuickTimingControls />
            <FormField name="startTime">
              <FieldLabel>Start time</FieldLabel>
              <DateTimePicker />
              <FieldError />
            </FormField>
            <FormField name="endTime">
              <FieldLabel>End time</FieldLabel>
              <DateTimePicker />
              <FieldError />
            </FormField>
            <StepNav />
          </div>
        </FormStep>

        {/* Review */}
        <FormStep fields={[]}> 
          <ReviewBlock type={type} />
          {verificationError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mt-4">
              <p className="text-sm text-red-900 dark:text-red-200 whitespace-pre-line">{verificationError}</p>
            </div>
          )}
          {(isVerifying || isSubmitting) && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
              <div className="flex items-center gap-3">
                <svg className="animate-spin h-5 w-5 text-blue-600 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-sm text-blue-900 dark:text-blue-200">
                  {isVerifying ? 'Verifying inscription ownership...' : 'Creating auction...'}
                </p>
              </div>
            </div>
          )}
          <StepNav submitLabel={isVerifying || isSubmitting ? 'Processing...' : 'Create auction'} disabled={isVerifying || isSubmitting} />
        </FormStep>
      </Form>
    </div>
  )
}
function WizardPreviewButton({ type, values, className }: { type: 'dutch'; values: any; className?: string }) {
  const href = React.useMemo(() => {
    if (!type) return '#'
    try {
      const json = JSON.stringify(values || {})
      const b64 = btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
      return `/auctions/preview?type=${type}&state=${b64}`
    } catch {
      return '#'
    }
  }, [type, values])
  return (
    <a href={href} className={`inline-flex items-center gap-2 text-sm text-blue-600 underline underline-offset-4 hover:opacity-80 dark:text-blue-400 ${className || ''}`}>
      Preview summary →
    </a>
  )
}


function StepNav({ submitLabel = 'Next', disabled = false }: { submitLabel?: string; disabled?: boolean }) {
  const { back, next, isFirst, isLast, form } = useFormWizard()
  const startPrice = form.watch('startPrice')
  const endPrice = form.watch('endPrice')
  
  // Disable next button if on pricing step and prices are invalid
  const isPricingInvalid = startPrice && endPrice && typeof startPrice === 'number' && typeof endPrice === 'number' && endPrice >= startPrice
  const isDisabled = disabled || isPricingInvalid
  
  return (
    <div className="flex justify-between items-center pt-6 mt-6 border-t border-gray-200 dark:border-gray-700">
      <button 
        type="button" 
        onClick={back} 
        disabled={isFirst || disabled} 
        aria-label="Previous step"
        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
          isFirst || disabled
            ? 'text-gray-400 cursor-not-allowed dark:text-gray-600' 
            : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
        }`}
      >
        ← Back
      </button>
      <button 
        type={isLast ? 'submit' : 'button'} 
        onClick={isLast ? undefined : next}
        disabled={isDisabled}
        aria-label={isLast ? 'Submit form' : 'Next step'}
        className={`px-6 py-2 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors ${
          isDisabled
            ? 'bg-gray-400 text-gray-200 cursor-not-allowed dark:bg-gray-600 dark:text-gray-400'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {isLast ? submitLabel : 'Next →'}
      </button>
    </div>
  )
}

function StepProgress({ total }: { total: number }) {
  const { stepIndex } = useFormWizard()
  const current = stepIndex + 1
  return (
    <div aria-label="Progress" className="flex items-center gap-3">
      <div className="w-40 h-2 bg-gray-200 rounded-full dark:bg-gray-700">
        <div 
          className="h-full bg-blue-600 rounded-full transition-all duration-300" 
          style={{ width: `${(current / total) * 100}%` }}
        />
      </div>
      <span className="text-sm text-gray-600 dark:text-gray-400 min-w-0">
        Step {current} of {total}
      </span>
    </div>
  )
}

function ReviewBlock({ type }: { type: 'dutch' }) {
  const { form } = useFormWizard()
  const values = form.watch()
  const summary = normalizeDutch(values as any)
  const [btcRate, setBtcRate] = React.useState(95000)
  
  React.useEffect(() => {
    getBtcUsdRate().then(rate => setBtcRate(rate))
  }, [])
  return (
    <section aria-label="Review" className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Review Your Auction</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">Please review all details before creating your auction.</p>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Basic Information</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Type:</span>
              <span className="font-medium">Dutch Clearing Auction</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Title:</span>
              <span className="font-medium">{values.title || 'Not set'}</span>
            </div>
            {values.description && (
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Description:</span>
                <span className="font-medium">{values.description}</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Items & Seller</h4>
          <div className="space-y-2 text-sm">
            {values.inscriptionIds && (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Quantity:</span>
                  <span className="font-medium">
                    {values.inscriptionIds.split('\n').filter((id: string) => id.trim().length > 0).length} items
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-gray-600 dark:text-gray-400">Inscription IDs:</span>
                  <div className="text-xs font-mono bg-gray-100 dark:bg-gray-900 p-2 rounded max-h-32 overflow-y-auto">
                    {values.inscriptionIds.split('\n').map((id: string, i: number) => {
                      const trimmed = id.trim()
                      return trimmed ? <div key={i}>{trimmed}</div> : null
                    })}
                  </div>
                </div>
              </>
            )}
            {values.sellerAddress && (
              <div className="space-y-1 pt-2">
                <span className="text-gray-600 dark:text-gray-400">Seller Address:</span>
                <div className="text-xs font-mono bg-gray-100 dark:bg-gray-900 p-2 rounded break-all">
                  {values.sellerAddress}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Timing</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Start:</span>
              <span className="font-medium">{values.startTime ? new Date(values.startTime).toLocaleString() : 'Not set'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">End:</span>
              <span className="font-medium">{values.endTime ? new Date(values.endTime).toLocaleString() : 'Not set'}</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 md:col-span-2">
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Pricing Configuration</h4>
          <div className="grid gap-4 md:grid-cols-2 text-sm">
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Start Price:</span>
                <span className="font-medium">{values.startPrice || 0} BTC</span>
              </div>
              {values.startPrice > 0 && (
                <div className="text-xs text-gray-500 dark:text-gray-500 text-right">
                  {formatSats(btcToSats(values.startPrice))} sats ≈ {formatCurrency(btcToUsd(values.startPrice, btcRate), 'USD')}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">End Price:</span>
                <span className="font-medium">{values.endPrice || 0} BTC</span>
              </div>
              {values.endPrice > 0 && (
                <div className="text-xs text-gray-500 dark:text-gray-500 text-right">
                  {formatSats(btcToSats(values.endPrice))} sats ≈ {formatCurrency(btcToUsd(values.endPrice, btcRate), 'USD')}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Decrement Amount:</span>
                <span className="font-medium">{values.decrementAmount || 0} BTC</span>
              </div>
              {values.decrementAmount > 0 && (
                <div className="text-xs text-gray-500 dark:text-gray-500 text-right">
                  {formatSats(btcToSats(values.decrementAmount))} sats ≈ {formatCurrency(btcToUsd(values.decrementAmount, btcRate), 'USD')}
                </div>
              )}
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Decrement Interval:</span>
              <span className="font-medium">{values.decrementIntervalSeconds || 0}s</span>
            </div>
          </div>
        </div>
      </div>
      
      <details className="mt-6">
        <summary className="cursor-pointer text-sm text-gray-600 dark:text-gray-400 underline">View Technical Payload</summary>
        <pre className="mt-2 text-xs bg-gray-100 dark:bg-gray-900 p-3 rounded overflow-auto text-gray-800 dark:text-gray-200 border" style={{ whiteSpace: 'pre-wrap' }}>
          {JSON.stringify(summary, null, 2)}
        </pre>
      </details>
    </section>
  )
}

function FormAutosave({ onValuesChange }: { onValuesChange: (v: any) => void }) {
  const { form } = useFormWizard()
  React.useEffect(() => {
    const sub = form.watch((v: any) => onValuesChange(v))
    return () => sub.unsubscribe()
  }, [form, onValuesChange])
  return null
}

function FormStepRouter() {
  const { goTo, stepsCount } = useFormWizard()
  React.useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const step = Number(params.get('step'))
      if (Number.isFinite(step)) {
        goTo(Math.min(Math.max(step, 0), stepsCount - 1))
      }
    } catch {}
  }, [goTo, stepsCount])
  return null
}

function PriceHelper({ fieldName }: { fieldName: string }) {
  const { form } = useFormWizard()
  const value = form.watch(fieldName)
  const [btcRate, setBtcRate] = React.useState(95000)
  
  React.useEffect(() => {
    getBtcUsdRate().then(rate => setBtcRate(rate))
  }, [])
  
  if (!value || typeof value !== 'number' || value <= 0) {
    return null
  }
  
  const sats = btcToSats(value)
  const usd = btcToUsd(value, btcRate)
  
  return (
    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 space-y-0.5">
      <div>≈ {formatSats(sats)} sats</div>
      <div>≈ {formatCurrency(usd, 'USD')} <span className="text-gray-500 dark:text-gray-500">(@${formatSats(btcRate)}/BTC)</span></div>
    </div>
  )
}

function EndPriceValidationHelper() {
  const { form } = useFormWizard()
  const startPrice = form.watch('startPrice')
  const endPrice = form.watch('endPrice')
  
  // Show warning if both prices are set and end price is not less than start price
  if (startPrice && endPrice && typeof startPrice === 'number' && typeof endPrice === 'number') {
    if (endPrice >= startPrice) {
      return (
        <div className="text-xs text-red-600 dark:text-red-400 mt-1">
          ⚠️ End price must be less than start price ({startPrice} BTC) for Dutch auctions
        </div>
      )
    }
  }
  
  return null
}

function InscriptionCountHelper() {
  const { form } = useFormWizard()
  const inscriptionIds = form.watch('inscriptionIds') || ''
  
  const count = inscriptionIds
    .split('\n')
    .map((id: string) => id.trim())
    .filter((id: string) => id.length > 0)
    .length
  
  if (count === 0) return null
  
  return (
    <div className="text-sm font-medium text-blue-600 dark:text-blue-400 mt-2">
      📦 {count} item{count !== 1 ? 's' : ''} will be auctioned
    </div>
  )
}


function QuickTimingControls() {
  const { form } = useFormWizard()
  const startTime: string | undefined = form.watch('startTime')
  const endTime: string | undefined = form.watch('endTime')

  const nowMs = Date.now()
  const oneDayMs = 24 * 60 * 60 * 1000
  const presets = [
    { key: '1h', label: '1 hour', ms: 1 * 60 * 60 * 1000 },
    { key: '4h', label: '4 hours', ms: 4 * 60 * 60 * 1000 },
    { key: '12h', label: '12 hours', ms: 12 * 60 * 60 * 1000 },
    { key: '1d', label: '1 day', ms: oneDayMs },
    { key: '3d', label: '3 days', ms: 3 * oneDayMs },
    { key: '7d', label: '7 days', ms: 7 * oneDayMs },
  ] as const

  function getInitialDays(): number {
    if (!startTime) return 0
    const diff = new Date(startTime).getTime() - nowMs
    return Math.max(0, Math.round(diff / oneDayMs))
  }

  function getInitialPreset(): string {
    if (!startTime || !endTime) return '1d'
    const dur = new Date(endTime).getTime() - new Date(startTime).getTime()
    const match = presets.find((p) => Math.abs(p.ms - dur) < 60 * 1000)
    return match?.key || '1d'
  }

  const [daysFromNow, setDaysFromNow] = React.useState<number>(getInitialDays())
  const [presetKey, setPresetKey] = React.useState<string>(getInitialPreset())

  React.useEffect(() => {
    // If form fields change externally, keep local UI roughly in sync
    setDaysFromNow(getInitialDays())
    setPresetKey(getInitialPreset())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startTime, endTime])

  function computeStartDate(days: number): Date {
    const start = new Date(nowMs + days * oneDayMs)
    // Snap to the next hour for neatness
    start.setMinutes(0, 0, 0)
    return start
  }

  function getPresetMs(key: string): number {
    return presets.find((p) => p.key === key)?.ms || oneDayMs
  }

  function applyChanges(nextDays: number, nextPresetKey: string) {
    const start = computeStartDate(nextDays)
    const end = new Date(start.getTime() + getPresetMs(nextPresetKey))
    form.setValue('startTime', start.toISOString(), { shouldDirty: true, shouldValidate: true })
    form.setValue('endTime', end.toISOString(), { shouldDirty: true, shouldValidate: true })
  }

  return (
    <div className="mb-4 rounded-lg border bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-3 text-sm font-medium text-gray-900 dark:text-gray-100">Quick timing</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">Start in (days)</span>
          <input
            className="input"
            type="number"
            min={0}
            max={365}
            value={daysFromNow}
            onChange={(e) => {
              const val = Math.max(0, Math.min(365, Number(e.target.value || 0)))
              setDaysFromNow(val)
              applyChanges(val, presetKey)
            }}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">Duration</span>
          <select
            className="input"
            value={presetKey}
            onChange={(e) => {
              const key = e.target.value
              setPresetKey(key)
              applyChanges(daysFromNow, key)
            }}
          >
            {presets.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
        </label>

        <div className="flex items-end">
          <button
            type="button"
            className="btn btn-primary px-4"
            onClick={() => applyChanges(daysFromNow, presetKey)}
          >
            Apply
          </button>
        </div>
      </div>
      <div className="mt-2 text-xs text-muted-foreground">You can still fine-tune exact times below.</div>
    </div>
  )
}

// PSBT Signing Workflow Component
function PsbtSigningWorkflow({ 
  state, 
  onSign, 
  onRetry 
}: { 
  state: any
  onSign: () => void
  onRetry: () => void
}) {
  const getStageInfo = () => {
    switch (state.stage) {
      case 'wallet_connect':
        return {
          title: 'Connecting to Wallet',
          description: 'Please approve the wallet connection request...',
          icon: '🔌',
          color: 'blue',
        }
      case 'api_call':
        return {
          title: 'Creating Auction',
          description: 'Generating PSBT and auction address...',
          icon: '⚙️',
          color: 'blue',
        }
      case 'signing':
        return {
          title: 'Sign with Wallet',
          description: 'Please sign the transaction in your wallet to escrow your inscription',
          icon: '✍️',
          color: 'yellow',
          showSignButton: !state.txid,
        }
      case 'broadcasting':
        return {
          title: 'Broadcasting Transaction',
          description: 'Extracting transaction and broadcasting to Bitcoin network...',
          icon: '📡',
          color: 'blue',
        }
      case 'confirming':
        return {
          title: 'Waiting for Confirmation',
          description: `Transaction broadcast! Waiting for confirmations... (${state.confirmations || 0}/1)`,
          icon: '⏳',
          color: 'blue',
        }
      case 'success':
        return {
          title: 'Auction Created Successfully!',
          description: 'Your inscription has been escrowed and the auction is now active',
          icon: '✅',
          color: 'green',
        }
      case 'error':
        return {
          title: 'Error',
          description: state.error || 'An error occurred',
          icon: '❌',
          color: 'red',
        }
      default:
        return {
          title: 'Processing',
          description: 'Please wait...',
          icon: '⏳',
          color: 'gray',
        }
    }
  }

  const info = getStageInfo()

  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800',
    gray: 'bg-gray-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800',
  }

  return (
    <div className={`rounded-lg border p-8 text-center ${colorClasses[info.color as keyof typeof colorClasses]}`}>
      <div className="text-6xl mb-4">{info.icon}</div>
      <h2 className="text-2xl font-bold mb-2">{info.title}</h2>
      <p className="text-lg mb-6">{info.description}</p>

      {state.auctionAddress && (
        <div className="bg-white/80 dark:bg-gray-800/80 rounded-lg p-4 text-left mb-6">
          <h3 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">Auction Details:</h3>
          <div className="text-sm space-y-1 text-gray-700 dark:text-gray-300 break-all">
            <p><strong>Auction ID:</strong> {state.auctionId}</p>
            <p><strong>Auction Address:</strong> {state.auctionAddress}</p>
            {state.inscriptionInfo && (
              <>
                <p><strong>Inscription TXID:</strong> {state.inscriptionInfo.txid}</p>
                <p><strong>Inscription Vout:</strong> {state.inscriptionInfo.vout}</p>
              </>
            )}
          </div>
        </div>
      )}

      {state.txid && (
        <div className="bg-white/80 dark:bg-gray-800/80 rounded-lg p-4 text-left mb-6">
          <h3 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">Transaction:</h3>
          <div className="text-sm space-y-2 text-gray-700 dark:text-gray-300">
            <p className="break-all"><strong>TX ID:</strong> {state.txid}</p>
            <a 
              href={getMempoolLink(state.txid, 'testnet')} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 underline"
            >
              View on mempool.space →
            </a>
            {state.confirmations !== undefined && (
              <p><strong>Confirmations:</strong> {state.confirmations}</p>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-4 justify-center">
        {info.showSignButton && (
          <button 
            onClick={onSign}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-lg"
          >
            Sign with Wallet
          </button>
        )}

        {state.stage === 'error' && (
          <button 
            onClick={onRetry}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
          >
            Try Again
          </button>
        )}

        {state.stage === 'success' && (
          <>
            <button 
              onClick={onRetry}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              Create Another Auction
            </button>
            <button 
              onClick={() => window.location.href = '/'}
              className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500"
            >
              Back to Home
            </button>
          </>
        )}
      </div>

      {(state.stage === 'wallet_connect' || state.stage === 'api_call' || state.stage === 'broadcasting' || state.stage === 'confirming') && (
        <div className="mt-6">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-current"></div>
        </div>
      )}
    </div>
  )
}

