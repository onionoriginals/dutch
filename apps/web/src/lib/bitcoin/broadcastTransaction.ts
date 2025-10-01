/**
 * Bitcoin Transaction Broadcasting and Monitoring
 * 
 * This module provides utilities to:
 * 1. Broadcast signed transactions to the Bitcoin network via mempool.space API
 * 2. Monitor transaction confirmation status
 * 3. Poll for confirmations with retry logic
 * 
 * Supports: mainnet, testnet, signet, regtest
 */

export interface BroadcastResult {
  success: boolean
  txid?: string
  error?: string
  errorCode?: string
}

export interface TransactionStatus {
  txid: string
  confirmed: boolean
  confirmations: number
  blockHeight?: number
  blockHash?: string
  blockTime?: number
  fee?: number
  size?: number
  vsize?: number
  status?: {
    confirmed: boolean
    block_height?: number
    block_hash?: string
    block_time?: number
  }
}

export interface ConfirmationPollOptions {
  targetConfirmations?: number
  maxAttempts?: number
  pollIntervalMs?: number
  onProgress?: (status: TransactionStatus) => void
}

/**
 * Gets the mempool.space API base URL for the given network
 */
function getMempoolApiBase(network?: 'mainnet' | 'testnet' | 'signet' | 'regtest'): string {
  const net = network || 'testnet' // Default to testnet for safety
  
  switch (net) {
    case 'mainnet':
      return 'https://mempool.space/api'
    case 'testnet':
      return 'https://mempool.space/testnet/api'
    case 'signet':
      return 'https://mempool.space/signet/api'
    case 'regtest':
      return 'http://localhost:3002/api' // Local regtest node
    default:
      return 'https://mempool.space/testnet/api'
  }
}

/**
 * Broadcasts a signed transaction to the Bitcoin network
 * 
 * @param signedTxHex - The fully signed transaction in hex format
 * @param network - Bitcoin network (mainnet, testnet, signet, regtest)
 * @returns BroadcastResult with success status and txid or error
 */
export async function broadcastTransaction(
  signedTxHex: string,
  network?: 'mainnet' | 'testnet' | 'signet' | 'regtest'
): Promise<BroadcastResult> {
  try {
    // Validate input
    if (!signedTxHex || typeof signedTxHex !== 'string') {
      return {
        success: false,
        error: 'Invalid transaction: must be a hex-encoded string',
        errorCode: 'INVALID_TX',
      }
    }
    
    // Remove any whitespace
    const cleanHex = signedTxHex.trim().replace(/\s/g, '')
    
    // Validate hex format
    if (!/^[0-9a-fA-F]+$/.test(cleanHex)) {
      return {
        success: false,
        error: 'Invalid transaction: must be valid hex',
        errorCode: 'INVALID_HEX',
      }
    }
    
    const apiBase = getMempoolApiBase(network)
    const url = `${apiBase}/tx`
    
    // Broadcast transaction
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: cleanHex,
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      
      // Parse common mempool.space error messages
      if (errorText.includes('insufficient fee')) {
        return {
          success: false,
          error: 'Transaction fee too low',
          errorCode: 'INSUFFICIENT_FEE',
        }
      }
      
      if (errorText.includes('already in block chain') || errorText.includes('txn-already-known')) {
        return {
          success: false,
          error: 'Transaction already broadcast',
          errorCode: 'TX_ALREADY_BROADCAST',
        }
      }
      
      if (errorText.includes('missing inputs') || errorText.includes('bad-txns-inputs-missingorspent')) {
        return {
          success: false,
          error: 'Transaction inputs missing or already spent',
          errorCode: 'MISSING_INPUTS',
        }
      }
      
      return {
        success: false,
        error: `Broadcast failed: ${errorText}`,
        errorCode: 'BROADCAST_FAILED',
      }
    }
    
    // mempool.space returns the txid as plain text
    const txid = await response.text()
    
    if (!txid || !/^[0-9a-fA-F]{64}$/.test(txid)) {
      return {
        success: false,
        error: 'Broadcast succeeded but received invalid txid',
        errorCode: 'INVALID_TXID',
      }
    }
    
    return {
      success: true,
      txid,
    }
  } catch (error: any) {
    // Handle network errors
    if (error?.message?.includes('fetch') || error?.message?.includes('network')) {
      return {
        success: false,
        error: 'Network error: Could not connect to mempool API',
        errorCode: 'NETWORK_ERROR',
      }
    }
    
    return {
      success: false,
      error: error?.message || 'Failed to broadcast transaction',
      errorCode: 'BROADCAST_ERROR',
    }
  }
}

/**
 * Gets the current status of a transaction
 * 
 * @param txid - Transaction ID to check
 * @param network - Bitcoin network
 * @returns TransactionStatus with confirmation details
 */
export async function getTransactionStatus(
  txid: string,
  network?: 'mainnet' | 'testnet' | 'signet' | 'regtest'
): Promise<TransactionStatus | null> {
  try {
    if (!txid || !/^[0-9a-fA-F]{64}$/.test(txid)) {
      return null
    }
    
    const apiBase = getMempoolApiBase(network)
    const url = `${apiBase}/tx/${txid}`
    
    const response = await fetch(url)
    if (!response.ok) {
      return null
    }
    
    const data = await response.json()
    
    const confirmed = data.status?.confirmed || false
    const blockHeight = data.status?.block_height
    
    // Calculate confirmations
    let confirmations = 0
    if (confirmed && blockHeight) {
      // Get current block height
      try {
        const tipResponse = await fetch(`${apiBase}/blocks/tip/height`)
        if (tipResponse.ok) {
          const tipHeight = parseInt(await tipResponse.text(), 10)
          confirmations = tipHeight - blockHeight + 1
        }
      } catch {
        // Fallback: if we can't get tip height, assume 1 confirmation if confirmed
        confirmations = 1
      }
    }
    
    return {
      txid,
      confirmed,
      confirmations,
      blockHeight: data.status?.block_height,
      blockHash: data.status?.block_hash,
      blockTime: data.status?.block_time,
      fee: data.fee,
      size: data.size,
      vsize: data.weight ? Math.ceil(data.weight / 4) : undefined,
      status: data.status,
    }
  } catch (error) {
    console.error('Error fetching transaction status:', error)
    return null
  }
}

/**
 * Polls for transaction confirmations with retry logic
 * 
 * @param txid - Transaction ID to monitor
 * @param network - Bitcoin network
 * @param options - Polling configuration options
 * @returns Promise that resolves when target confirmations are reached
 */
export async function pollForConfirmations(
  txid: string,
  network?: 'mainnet' | 'testnet' | 'signet' | 'regtest',
  options?: ConfirmationPollOptions
): Promise<TransactionStatus> {
  const {
    targetConfirmations = 1,
    maxAttempts = 60, // 5 minutes with 5s intervals
    pollIntervalMs = 5000,
    onProgress,
  } = options || {}
  
  let attempts = 0
  
  while (attempts < maxAttempts) {
    attempts++
    
    const status = await getTransactionStatus(txid, network)
    
    if (status) {
      // Call progress callback if provided
      if (onProgress) {
        onProgress(status)
      }
      
      // Check if we've reached target confirmations
      if (status.confirmed && status.confirmations >= targetConfirmations) {
        return status
      }
    }
    
    // Wait before next poll
    if (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
    }
  }
  
  throw new Error(`Timeout: Transaction ${txid} did not reach ${targetConfirmations} confirmation(s) after ${maxAttempts} attempts`)
}

/**
 * Gets a mempool.space transaction explorer link
 * 
 * @param txid - Transaction ID
 * @param network - Bitcoin network
 * @returns URL to transaction on mempool.space
 */
export function getMempoolLink(
  txid: string,
  network?: 'mainnet' | 'testnet' | 'signet' | 'regtest'
): string {
  const net = network || 'testnet'
  
  switch (net) {
    case 'mainnet':
      return `https://mempool.space/tx/${txid}`
    case 'testnet':
      return `https://mempool.space/testnet/tx/${txid}`
    case 'signet':
      return `https://mempool.space/signet/tx/${txid}`
    case 'regtest':
      return `http://localhost:3002/tx/${txid}`
    default:
      return `https://mempool.space/testnet/tx/${txid}`
  }
}

/**
 * Attempts to detect if a string is a PSBT (base64) or raw transaction hex
 * 
 * @param data - String that could be PSBT base64 or transaction hex
 * @returns Object indicating the type and whether it needs conversion
 */
export function detectTransactionFormat(data: string): {
  isPsbt: boolean
  isHex: boolean
  needsConversion: boolean
} {
  // Remove whitespace
  const clean = data.trim()
  
  // PSBTs in base64 typically start with "cHNi" (base64 for "psbt")
  const isPsbtBase64 = clean.startsWith('cHNi') || clean.startsWith('cHNC')
  
  // Check if it's valid hex (even length, only hex chars)
  const isHex = /^[0-9a-fA-F]+$/.test(clean) && clean.length % 2 === 0
  
  // PSBT magic bytes in hex: 70736274 ("psbt" in ASCII)
  const isPsbtHex = isHex && clean.toLowerCase().startsWith('70736274')
  
  const isPsbt = isPsbtBase64 || isPsbtHex
  
  return {
    isPsbt,
    isHex: isHex && !isPsbtHex,
    needsConversion: isPsbt,
  }
}

/**
 * Converts signed PSBT to raw transaction hex for broadcasting
 * 
 * Note: This is a client-side fallback. Most wallets should return the raw hex directly,
 * but some return the signed PSBT. This function handles both cases.
 * 
 * Since we can't include bitcoinjs-lib in the browser bundle easily, we'll make an
 * API call to extract the transaction hex from the PSBT.
 * 
 * @param signedPsbt - Signed PSBT in base64 or hex format
 * @returns Raw transaction hex ready for broadcasting
 */
export async function extractTransactionFromPsbt(signedPsbt: string): Promise<string> {
  // First, check if it's already raw transaction hex
  const format = detectTransactionFormat(signedPsbt)
  
  if (!format.needsConversion && format.isHex) {
    // Already raw transaction hex, return as-is
    return signedPsbt
  }
  
  if (!format.isPsbt) {
    throw new Error('Invalid format: not a PSBT or transaction hex')
  }
  
  // It's a PSBT, we need to extract the transaction
  // Make an API call to extract it server-side where we have bitcoinjs-lib
  try {
    const response = await fetch('/api/psbt/extract-transaction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        psbt: signedPsbt,
      }),
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || 'Failed to extract transaction from PSBT')
    }
    
    const data = await response.json()
    
    if (!data.ok || !data.data?.transactionHex) {
      throw new Error('Invalid response from PSBT extraction API')
    }
    
    return data.data.transactionHex
  } catch (error: any) {
    throw new Error(`Failed to extract transaction from PSBT: ${error.message}`)
  }
}
