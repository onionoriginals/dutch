/**
 * Example Usage of Inscription Verification
 * 
 * This file demonstrates how to use the inscription verification utilities.
 * These examples are for reference only and should not be run in production.
 */

import {
  verifyInscriptionOwnership,
  verifyMultipleInscriptions,
  checkAllValid,
  parseInscriptionId,
  getMempoolApiBase,
  type Network,
  type InscriptionVerificationResult
} from './verifyInscription'

// ============================================================================
// Example 1: Parse and validate an inscription ID
// ============================================================================

export async function exampleParseInscriptionId() {
  const inscriptionId = 'abc123def456789012345678901234567890123456789012345678901234567890i0'
  
  const parsed = parseInscriptionId(inscriptionId)
  
  if (parsed) {
    console.log('✓ Valid inscription ID')
    console.log('  TXID:', parsed.txid)
    console.log('  VOUT:', parsed.vout)
  } else {
    console.log('✗ Invalid inscription ID format')
  }
}

// ============================================================================
// Example 2: Verify a single inscription (testnet)
// ============================================================================

export async function exampleVerifySingleInscription() {
  // Example testnet inscription (replace with real values for testing)
  const inscriptionId = 'your_testnet_txid_here' + 'i0'
  const sellerAddress = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx'
  const network: Network = 'testnet'
  
  console.log('Verifying inscription ownership...')
  console.log('  Inscription:', inscriptionId)
  console.log('  Owner:', sellerAddress)
  console.log('  Network:', network)
  
  const result = await verifyInscriptionOwnership(
    inscriptionId,
    sellerAddress,
    network
  )
  
  if (result.valid) {
    console.log('✓ Verification successful!')
    console.log('  Address:', result.details?.address)
    console.log('  Value:', result.details?.value, 'sats')
    console.log('  Spent:', result.details?.spent ? 'Yes' : 'No')
  } else {
    console.log('✗ Verification failed')
    console.log('  Error:', result.error)
    console.log('  Code:', result.errorCode)
  }
  
  return result
}

// ============================================================================
// Example 3: Verify multiple inscriptions in parallel
// ============================================================================

export async function exampleVerifyMultipleInscriptions() {
  // Example: Clearing auction with 3 inscriptions
  const inscriptionIds = [
    'abc123...def456i0', // Replace with real inscription IDs
    'def456...abc789i1',
    'ghi789...xyz012i0',
  ]
  const sellerAddress = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx'
  const network: Network = 'testnet'
  
  console.log(`Verifying ${inscriptionIds.length} inscriptions in parallel...`)
  
  const results = await verifyMultipleInscriptions(
    inscriptionIds,
    sellerAddress,
    network
  )
  
  // Check overall validity
  const { allValid, errors } = checkAllValid(results)
  
  if (allValid) {
    console.log('✓ All inscriptions verified successfully!')
    results.forEach((result, i) => {
      console.log(`  ${i + 1}. ${inscriptionIds[i]} - ✓`)
    })
  } else {
    console.log(`✗ ${errors.length} inscription(s) failed verification:`)
    errors.forEach((err, i) => {
      console.log(`  ${i + 1}. ${err.inscriptionId || 'Unknown'} - ${err.error}`)
    })
  }
  
  return { results, allValid, errors }
}

// ============================================================================
// Example 4: Handle different error cases
// ============================================================================

export async function exampleHandleErrors() {
  const testCases = [
    {
      name: 'Invalid format',
      inscriptionId: 'invalid-format',
      expectedError: 'INVALID_FORMAT',
    },
    {
      name: 'Transaction not found',
      inscriptionId: '0000000000000000000000000000000000000000000000000000000000000000i0',
      expectedError: 'NOT_FOUND',
    },
    // Add more test cases as needed
  ]
  
  const sellerAddress = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx'
  const network: Network = 'testnet'
  
  console.log('Testing error handling...\n')
  
  for (const testCase of testCases) {
    console.log(`Test: ${testCase.name}`)
    const result = await verifyInscriptionOwnership(
      testCase.inscriptionId,
      sellerAddress,
      network
    )
    
    if (result.valid) {
      console.log('  ✗ Unexpected success')
    } else if (result.errorCode === testCase.expectedError) {
      console.log('  ✓ Got expected error:', result.errorCode)
    } else {
      console.log('  ? Got different error:', result.errorCode)
    }
    console.log()
  }
}

// ============================================================================
// Example 5: Get API base URL for different networks
// ============================================================================

export function exampleGetApiUrls() {
  const networks: Network[] = ['mainnet', 'testnet', 'signet', 'regtest']
  
  console.log('mempool.space API URLs by network:\n')
  
  networks.forEach(network => {
    const apiBase = getMempoolApiBase(network)
    console.log(`  ${network.padEnd(10)}: ${apiBase}`)
  })
}

// ============================================================================
// Example 6: Integration with Create Auction flow
// ============================================================================

export async function exampleCreateAuctionWorkflow() {
  // Simulates the workflow in CreateAuctionWizard
  
  const formData = {
    inscriptionIds: `abc123...def456i0
def456...abc789i1
ghi789...xyz012i0`,
    sellerAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
    startPrice: 0.01,
    endPrice: 0.005,
    // ... other fields
  }
  
  // Step 1: Parse inscription IDs
  const inscriptionIds = formData.inscriptionIds
    .split('\n')
    .map(id => id.trim())
    .filter(id => id.length > 0)
  
  console.log(`Step 1: Parsed ${inscriptionIds.length} inscription IDs`)
  
  // Step 2: Validate seller address
  if (!formData.sellerAddress) {
    console.error('✗ Seller address is required')
    return
  }
  
  console.log('Step 2: Seller address validated')
  
  // Step 3: Verify inscription ownership
  console.log('Step 3: Verifying inscription ownership...')
  
  const network: Network = 'testnet' // or from environment
  const results = await verifyMultipleInscriptions(
    inscriptionIds,
    formData.sellerAddress,
    network
  )
  
  const { allValid, errors } = checkAllValid(results)
  
  if (!allValid) {
    console.error('✗ Verification failed:')
    errors.forEach((err, i) => {
      console.error(`  ${i + 1}. ${err.error}`)
    })
    return
  }
  
  console.log('✓ Step 3: All inscriptions verified')
  
  // Step 4: Create auction (would call API here)
  console.log('Step 4: Creating auction...')
  console.log('  (API call would happen here)')
  
  return {
    success: true,
    inscriptionCount: inscriptionIds.length,
    verificationResults: results,
  }
}

// ============================================================================
// Example 7: Check verification details
// ============================================================================

export function exampleInspectVerificationResult(
  result: InscriptionVerificationResult
) {
  console.log('Verification Result:')
  console.log('  Valid:', result.valid ? 'Yes ✓' : 'No ✗')
  
  if (result.details) {
    console.log('  Details:')
    console.log('    TXID:', result.details.txid)
    console.log('    VOUT:', result.details.vout)
    console.log('    Address:', result.details.address || 'Unknown')
    console.log('    Value:', result.details.value || 0, 'sats')
    console.log('    Spent:', result.details.spent ? 'Yes' : 'No')
  }
  
  if (!result.valid) {
    console.log('  Error:')
    console.log('    Code:', result.errorCode)
    console.log('    Message:', result.error)
  }
}

// ============================================================================
// Run all examples (comment out in production)
// ============================================================================

export async function runAllExamples() {
  console.log('='.repeat(80))
  console.log('Inscription Verification Examples')
  console.log('='.repeat(80))
  console.log()
  
  // Example 1
  console.log('Example 1: Parse Inscription ID')
  console.log('-'.repeat(80))
  exampleParseInscriptionId()
  console.log()
  
  // Example 5
  console.log('Example 5: API URLs by Network')
  console.log('-'.repeat(80))
  exampleGetApiUrls()
  console.log()
  
  // Note: Examples 2-4, 6-7 require network access and real data
  console.log('⚠️  Examples 2-4, 6-7 require network access and real inscription data')
  console.log('    Uncomment and modify with real values to test')
  console.log()
  
  console.log('='.repeat(80))
}

// Uncomment to run examples:
// runAllExamples().catch(console.error)
