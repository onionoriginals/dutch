/**
 * Bitcoin Inscription Ownership Verification
 * 
 * This module provides utilities to verify inscription ownership by querying
 * the mempool.space API. It checks that:
 * 1. The inscription exists (transaction and output are valid)
 * 2. The seller owns the inscription (address matches)
 * 3. The inscription UTXO hasn't been spent
 */

export type Network = 'mainnet' | 'testnet' | 'signet' | 'regtest'

export interface InscriptionVerificationResult {
  valid: boolean
  error?: string
  errorCode?: 'NOT_FOUND' | 'OWNERSHIP_MISMATCH' | 'ALREADY_SPENT' | 'INVALID_FORMAT' | 'NETWORK_ERROR'
  details?: {
    txid: string
    vout: number
    address?: string
    value?: number
    spent: boolean
  }
}

interface MempoolTransaction {
  txid: string
  vout?: Array<{
    scriptpubkey_address?: string
    value: number
    scriptpubkey?: string
  }>
}

interface MempoolOutspend {
  spent: boolean
  txid?: string
  vin?: number
  status?: {
    confirmed: boolean
    block_height?: number
  }
}

/**
 * Get the mempool.space API base URL for a given network
 */
export function getMempoolApiBase(network: Network): string {
  switch (network) {
    case 'mainnet':
      return 'https://mempool.space/api'
    case 'testnet':
      return 'https://mempool.space/testnet/api'
    case 'signet':
      return 'https://mempool.space/signet/api'
    case 'regtest':
      return 'http://localhost:3002/api'
    default:
      return 'https://mempool.space/api'
  }
}

/**
 * Parse an inscription ID into txid and vout components
 * Inscription IDs follow the format: <txid>i<vout>
 * 
 * @param inscriptionId - The inscription ID (e.g., "abc123...i0")
 * @returns Object with txid and vout, or null if invalid format
 */
export function parseInscriptionId(inscriptionId: string): { txid: string; vout: number } | null {
  // Validate format: 64 hex chars + 'i' + digits
  const inscriptionRegex = /^([0-9a-fA-F]{64})i(\d+)$/
  const match = inscriptionId.trim().match(inscriptionRegex)
  
  if (!match) {
    return null
  }
  
  const [, txid, voutStr] = match
  const vout = parseInt(voutStr, 10)
  
  if (!Number.isFinite(vout) || vout < 0) {
    return null
  }
  
  return { txid, vout }
}

/**
 * Verify inscription ownership by checking mempool.space API
 * 
 * This function performs the following checks:
 * 1. Validates inscription ID format
 * 2. Fetches transaction data from mempool.space
 * 3. Verifies the output at the specified vout exists
 * 4. Checks that the output address matches the seller's address
 * 5. Verifies the output hasn't been spent
 * 
 * @param inscriptionId - The inscription ID (format: <txid>i<vout>)
 * @param sellerAddress - The expected owner's Bitcoin address
 * @param network - The Bitcoin network to query (default: 'mainnet')
 * @returns Verification result with validation status and details
 */
export async function verifyInscriptionOwnership(
  inscriptionId: string,
  sellerAddress: string,
  network: Network = 'mainnet'
): Promise<InscriptionVerificationResult> {
  // Parse inscription ID
  const parsed = parseInscriptionId(inscriptionId)
  
  if (!parsed) {
    return {
      valid: false,
      error: 'Invalid inscription ID format. Expected format: <txid>i<vout> (e.g., abc123...i0)',
      errorCode: 'INVALID_FORMAT',
    }
  }
  
  const { txid, vout } = parsed
  const apiBase = getMempoolApiBase(network)
  
  try {
    // Fetch transaction details
    const txResponse = await fetch(`${apiBase}/tx/${txid}`)
    
    if (!txResponse.ok) {
      if (txResponse.status === 404) {
        return {
          valid: false,
          error: `Transaction ${txid} not found on ${network}`,
          errorCode: 'NOT_FOUND',
          details: { txid, vout, spent: false },
        }
      }
      throw new Error(`HTTP ${txResponse.status}: ${txResponse.statusText}`)
    }
    
    const txData: MempoolTransaction = await txResponse.json()
    
    // Check if the output exists
    const output = txData.vout?.[vout]
    
    if (!output) {
      return {
        valid: false,
        error: `Output ${vout} not found in transaction ${txid}`,
        errorCode: 'NOT_FOUND',
        details: { txid, vout, spent: false },
      }
    }
    
    // Fetch outspend status
    const outspendsResponse = await fetch(`${apiBase}/tx/${txid}/outspends`)
    
    if (!outspendsResponse.ok) {
      throw new Error(`Failed to fetch outspend status: HTTP ${outspendsResponse.status}`)
    }
    
    const outspends: MempoolOutspend[] = await outspendsResponse.json()
    const outspend = outspends[vout]
    
    if (!outspend) {
      return {
        valid: false,
        error: `Outspend data not available for output ${vout}`,
        errorCode: 'NOT_FOUND',
        details: { txid, vout, spent: false },
      }
    }
    
    // Check ownership
    const outputAddress = output.scriptpubkey_address ?? ''
    const ownershipMatch = outputAddress === sellerAddress
    
    if (!ownershipMatch) {
      return {
        valid: false,
        error: `Ownership mismatch. The inscription is owned by ${outputAddress || 'unknown address'}, not ${sellerAddress}`,
        errorCode: 'OWNERSHIP_MISMATCH',
        details: {
          txid,
          vout,
          address: outputAddress,
          value: output.value,
          spent: outspend.spent,
        },
      }
    }
    
    // Check if spent
    if (outspend.spent) {
      return {
        valid: false,
        error: 'This inscription has already been spent and cannot be auctioned',
        errorCode: 'ALREADY_SPENT',
        details: {
          txid,
          vout,
          address: outputAddress,
          value: output.value,
          spent: true,
        },
      }
    }
    
    // All checks passed
    return {
      valid: true,
      details: {
        txid,
        vout,
        address: outputAddress,
        value: output.value,
        spent: false,
      },
    }
  } catch (error) {
    // Network or parsing errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return {
      valid: false,
      error: `Network error while verifying inscription: ${errorMessage}`,
      errorCode: 'NETWORK_ERROR',
      details: { txid, vout, spent: false },
    }
  }
}

/**
 * Verify multiple inscriptions in parallel
 * Useful for clearing auctions with multiple items
 * 
 * @param inscriptionIds - Array of inscription IDs to verify
 * @param sellerAddress - The expected owner's Bitcoin address
 * @param network - The Bitcoin network to query (default: 'mainnet')
 * @returns Array of verification results in the same order as input
 */
export async function verifyMultipleInscriptions(
  inscriptionIds: string[],
  sellerAddress: string,
  network: Network = 'mainnet'
): Promise<InscriptionVerificationResult[]> {
  const verificationPromises = inscriptionIds.map((id) =>
    verifyInscriptionOwnership(id, sellerAddress, network)
  )
  
  return Promise.all(verificationPromises)
}

/**
 * Check if all inscriptions in an array are valid
 * 
 * @param results - Array of verification results
 * @returns Object with overall validity and list of errors
 */
export function checkAllValid(results: InscriptionVerificationResult[]): {
  allValid: boolean
  errors: Array<{ inscriptionId?: string; error: string }>
} {
  const allValid = results.every((r) => r.valid)
  const errors = results
    .filter((r) => !r.valid)
    .map((r) => ({
      inscriptionId: r.details ? `${r.details.txid}i${r.details.vout}` : undefined,
      error: r.error || 'Unknown error',
    }))
  
  return { allValid, errors }
}
