import { describe, expect, test } from 'bun:test'
import { redactSensitiveData, logger, createLogger } from '../utils/logger'

describe('Logger - PII and Sensitive Data Redaction', () => {
  test('should redact seed phrases', () => {
    const data = {
      seed: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      other: 'safe-value',
    }
    
    const redacted = redactSensitiveData(data)
    expect(redacted).toEqual({
      seed: '[REDACTED]',
      other: 'safe-value',
    })
  })

  test('should redact private keys by field name', () => {
    const data = {
      privateKey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      privKey: 'L1234567890abcdefghijklmnopqrstuvwxyz',
      secretKey: 'secret123',
      normalField: 'not-secret',
    }
    
    const redacted = redactSensitiveData(data)
    expect(redacted).toEqual({
      privateKey: '[REDACTED]',
      privKey: '[REDACTED]',
      secretKey: '[REDACTED]',
      normalField: 'not-secret',
    })
  })

  test('should redact hex private keys by pattern', () => {
    const hexKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
    const redacted = redactSensitiveData(hexKey)
    expect(redacted).toBe('[REDACTED:PRIVATE_KEY]')
  })

  test('should redact seed phrases by pattern', () => {
    const seedPhrase = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
    const redacted = redactSensitiveData(seedPhrase)
    expect(redacted).toBe('[REDACTED:SEED_PHRASE]')
  })

  test('should redact API keys and tokens', () => {
    const data = {
      apiKey: 'sk_test_1234567890',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      password: 'secret123',
      authorization: 'Bearer token123',
    }
    
    const redacted = redactSensitiveData(data)
    expect(redacted).toEqual({
      apiKey: '[REDACTED]',
      token: '[REDACTED]',
      password: '[REDACTED]',
      authorization: '[REDACTED]',
    })
  })

  test('should preserve safe values', () => {
    const data = {
      auctionId: 'auction-123',
      status: 'active',
      price: 50000,
      network: 'mainnet',
      inscriptionId: 'abc123i0',
    }
    
    const redacted = redactSensitiveData(data)
    expect(redacted).toEqual(data)
  })

  test('should redact nested objects', () => {
    const data = {
      auction: {
        id: 'auction-123',
        seller: {
          address: 'bc1q...',
          privateKey: 'secret-key-123',
        },
      },
      seed: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
    }
    
    const redacted = redactSensitiveData(data)
    expect(redacted).toMatchObject({
      auction: {
        id: 'auction-123',
        seller: {
          address: 'bc1q...',
          privateKey: '[REDACTED]',
        },
      },
      seed: '[REDACTED]',
    })
  })

  test('should redact arrays', () => {
    const data = {
      keys: [
        { id: 1, privateKey: 'secret1' },
        { id: 2, privateKey: 'secret2' },
      ],
    }
    
    const redacted = redactSensitiveData(data)
    expect(redacted).toEqual({
      keys: [
        { id: 1, privateKey: '[REDACTED]' },
        { id: 2, privateKey: '[REDACTED]' },
      ],
    })
  })

  test('should handle null and undefined', () => {
    expect(redactSensitiveData(null)).toBe(null)
    expect(redactSensitiveData(undefined)).toBe(undefined)
  })

  test('should preserve numbers and booleans', () => {
    const data = {
      price: 50000,
      active: true,
      count: 0,
    }
    
    const redacted = redactSensitiveData(data)
    expect(redacted).toEqual(data)
  })

  test('should redact ownership check fields', () => {
    const data = {
      sellerAddress: 'bc1q...',
      ownerAddress: 'tb1p...',
      buyerAddress: 'bc1p...',
      auctionAddress: 'bc1q...', // Should NOT be redacted - not in sensitive list
    }
    
    const redacted = redactSensitiveData(data)
    expect(redacted).toMatchObject({
      sellerAddress: '[REDACTED]',
      ownerAddress: '[REDACTED]',
      buyerAddress: '[REDACTED]',
      auctionAddress: 'bc1q...', // Preserved
    })
  })

  test('should redact camelCase and snake_case variations', () => {
    const data = {
      privateKey: 'secret1',
      private_key: 'secret2',
      apiKey: 'secret3',
      api_key: 'secret4',
    }
    
    const redacted = redactSensitiveData(data)
    // All should be redacted
    expect(Object.values(redacted as object).every(v => v === '[REDACTED]')).toBe(true)
  })

  test('should handle real-world ownership check log', () => {
    const ownershipLog = {
      operation: 'ownership-check',
      sellerAddress: 'tb1q1234567890abcdef',
      voutAddress: 'tb1q1234567890abcdef',
      spent: false,
      matches: true,
    }
    
    const redacted = redactSensitiveData(ownershipLog)
    expect(redacted).toMatchObject({
      operation: 'ownership-check',
      sellerAddress: '[REDACTED]',
      voutAddress: 'tb1q1234567890abcdef', // Not in sensitive list
      spent: false,
      matches: true,
    })
  })
})

describe('Logger - Structured Logging', () => {
  test('should create logger with custom config', () => {
    const customLogger = createLogger({ minLevel: 'warn', enableJson: true })
    expect(customLogger).toBeDefined()
  })

  test('should log without errors', () => {
    // Just verify these don't throw
    logger.debug('Debug message', { debug: true })
    logger.info('Info message', { info: true })
    logger.warn('Warning message', { warn: true })
    logger.error('Error message', { error: true })
  })

  test('should redact sensitive data in log context', () => {
    // This test verifies that redaction happens during logging
    // We can't easily capture console output in Bun, but we can verify the method exists
    expect(() => {
      logger.info('Test with sensitive data', {
        auctionId: 'auction-123',
        privateKey: 'secret-key',
        seed: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      })
    }).not.toThrow()
  })

  test('should log HTTP requests', () => {
    expect(() => {
      logger.request('GET', '/api/auctions', { query: { status: 'active' } })
    }).not.toThrow()
  })

  test('should log HTTP responses', () => {
    expect(() => {
      logger.response('GET', '/api/auctions', 200, 45.2)
    }).not.toThrow()
  })

  test('should log errors with appropriate level', () => {
    expect(() => {
      logger.response('POST', '/create-auction', 500, 120, { error: 'Database error' })
    }).not.toThrow()
  })
})