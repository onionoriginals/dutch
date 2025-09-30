import { test, expect, describe } from 'bun:test'
import { parseInscriptionId, getMempoolApiBase, type Network } from './verifyInscription'

describe('parseInscriptionId', () => {
  test('should parse valid inscription ID', () => {
    const result = parseInscriptionId('abc123def456789012345678901234567890123456789012345678901234567890i0')
    expect(result).not.toBeNull()
    expect(result?.txid).toBe('abc123def456789012345678901234567890123456789012345678901234567890')
    expect(result?.vout).toBe(0)
  })

  test('should parse inscription ID with non-zero vout', () => {
    const result = parseInscriptionId('abc123def456789012345678901234567890123456789012345678901234567890i5')
    expect(result).not.toBeNull()
    expect(result?.txid).toBe('abc123def456789012345678901234567890123456789012345678901234567890')
    expect(result?.vout).toBe(5)
  })

  test('should handle uppercase hex characters', () => {
    const result = parseInscriptionId('ABC123DEF456789012345678901234567890123456789012345678901234567890i1')
    expect(result).not.toBeNull()
    expect(result?.txid).toBe('ABC123DEF456789012345678901234567890123456789012345678901234567890')
    expect(result?.vout).toBe(1)
  })

  test('should reject inscription ID with invalid format (no i separator)', () => {
    const result = parseInscriptionId('abc123def4567890123456789012345678901234567890123456789012345678900')
    expect(result).toBeNull()
  })

  test('should reject inscription ID with txid too short', () => {
    const result = parseInscriptionId('abc123i0')
    expect(result).toBeNull()
  })

  test('should reject inscription ID with txid too long', () => {
    const result = parseInscriptionId('abc123def456789012345678901234567890123456789012345678901234567890ABCi0')
    expect(result).toBeNull()
  })

  test('should reject inscription ID with non-hex characters', () => {
    const result = parseInscriptionId('xyz123def456789012345678901234567890123456789012345678901234567890i0')
    expect(result).toBeNull()
  })

  test('should reject inscription ID with negative vout', () => {
    const result = parseInscriptionId('abc123def456789012345678901234567890123456789012345678901234567890i-1')
    expect(result).toBeNull()
  })

  test('should trim whitespace', () => {
    const result = parseInscriptionId('  abc123def456789012345678901234567890123456789012345678901234567890i0  ')
    expect(result).not.toBeNull()
    expect(result?.vout).toBe(0)
  })
})

describe('getMempoolApiBase', () => {
  test('should return mainnet API URL', () => {
    const url = getMempoolApiBase('mainnet')
    expect(url).toBe('https://mempool.space/api')
  })

  test('should return testnet API URL', () => {
    const url = getMempoolApiBase('testnet')
    expect(url).toBe('https://mempool.space/testnet/api')
  })

  test('should return signet API URL', () => {
    const url = getMempoolApiBase('signet')
    expect(url).toBe('https://mempool.space/signet/api')
  })

  test('should return regtest API URL', () => {
    const url = getMempoolApiBase('regtest')
    expect(url).toBe('http://localhost:3002/api')
  })

  test('should default to mainnet for unknown network', () => {
    const url = getMempoolApiBase('unknown' as Network)
    expect(url).toBe('https://mempool.space/api')
  })
})

// Note: Integration tests with actual API calls would require network access
// and real inscription data, so they should be run separately or mocked
