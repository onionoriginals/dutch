/**
 * Structured logging utility with PII/sensitive data redaction
 * Supports multiple log levels and JSON output for observability
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogContext {
  [key: string]: unknown
}

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: LogContext
}

/**
 * Patterns for detecting sensitive data that should be redacted
 */
const SENSITIVE_PATTERNS = {
  // Seed phrases (12-24 words)
  seed: /\b(seed|mnemonic|phrase)\b/i,
  // Private keys (hex strings, WIF format)
  privateKey: /\b(private[_-]?key|priv[_-]?key|secret[_-]?key|wif)\b/i,
  // API keys, tokens, passwords
  apiKey: /\b(api[_-]?key|api[_-]?secret|token|password|pwd|pass)\b/i,
  // Bitcoin addresses in values (not keys)
  // We're more lenient here - only redact if it looks like sensitive ownership data
  ownerAddress: /\b(owner[_-]?address|seller[_-]?address|buyer[_-]?address)\b/i,
  // Authorization headers
  authorization: /\b(authorization|auth[_-]?token)\b/i,
}

/**
 * Field names that should always be redacted
 */
const SENSITIVE_FIELDS = new Set([
  'seed',
  'newSeed',
  'masterSeed',
  'mnemonic',
  'privateKey',
  'privKey',
  'secretKey',
  'privateKeyHex',
  'wif',
  'password',
  'pwd',
  'pass',
  'apiKey',
  'apiSecret',
  'token',
  'authToken',
  'authorization',
  'secret',
])

/**
 * Redacts sensitive values from an object
 * Returns a new object with sensitive fields replaced with '[REDACTED]'
 */
export function redactSensitiveData(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data
  }

  if (typeof data === 'string') {
    // Check if the string looks like a private key (64 hex chars) or seed phrase
    if (/^[0-9a-fA-F]{64}$/.test(data)) {
      return '[REDACTED:PRIVATE_KEY]'
    }
    // Check for seed phrases (12+ words)
    const words = data.trim().split(/\s+/)
    if (words.length >= 12 && words.length <= 24) {
      return '[REDACTED:SEED_PHRASE]'
    }
    return data
  }

  if (typeof data === 'number' || typeof data === 'boolean') {
    return data
  }

  if (Array.isArray(data)) {
    return data.map(item => redactSensitiveData(item))
  }

  if (typeof data === 'object') {
    const redacted: Record<string, unknown> = {}
    
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase()
      
      // Check if field name is in sensitive list
      if (SENSITIVE_FIELDS.has(key) || SENSITIVE_FIELDS.has(lowerKey)) {
        redacted[key] = '[REDACTED]'
        continue
      }

      // Check if field name matches sensitive patterns
      let isSensitive = false
      for (const pattern of Object.values(SENSITIVE_PATTERNS)) {
        if (pattern.test(key)) {
          isSensitive = true
          break
        }
      }

      if (isSensitive) {
        redacted[key] = '[REDACTED]'
      } else {
        redacted[key] = redactSensitiveData(value)
      }
    }
    
    return redacted
  }

  return data
}

/**
 * Logger configuration
 */
interface LoggerConfig {
  minLevel: LogLevel
  enableConsole: boolean
  enableJson: boolean
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

class Logger {
  private config: LoggerConfig

  constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      minLevel: (Bun.env.LOG_LEVEL as LogLevel) || 'info',
      enableConsole: true,
      enableJson: Bun.env.LOG_FORMAT === 'json' || Bun.env.NODE_ENV === 'production',
      ...config,
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.minLevel]
  }

  private formatLog(level: LogLevel, message: string, context?: LogContext): string {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: context ? redactSensitiveData(context) as LogContext : undefined,
    }

    if (this.config.enableJson) {
      return JSON.stringify(entry)
    }

    // Human-readable format for development
    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : ''
    return `[${entry.timestamp}] ${level.toUpperCase()}: ${message}${contextStr}`
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (!this.shouldLog(level)) {
      return
    }

    const formatted = this.formatLog(level, message, context)

    if (this.config.enableConsole) {
      switch (level) {
        case 'error':
          console.error(formatted)
          break
        case 'warn':
          console.warn(formatted)
          break
        case 'debug':
          console.debug(formatted)
          break
        default:
          console.log(formatted)
      }
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context)
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context)
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context)
  }

  error(message: string, context?: LogContext): void {
    this.log('error', message, context)
  }

  /**
   * Special method for HTTP request logging
   */
  request(method: string, path: string, context?: LogContext): void {
    this.info(`${method} ${path}`, { type: 'request', ...context })
  }

  /**
   * Special method for HTTP response logging
   */
  response(method: string, path: string, status: number, duration?: number, context?: LogContext): void {
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info'
    this.log(level, `${method} ${path} ${status}`, {
      type: 'response',
      status,
      durationMs: duration,
      ...context,
    })
  }
}

/**
 * Default logger instance
 */
export const logger = new Logger()

/**
 * Create a child logger with additional context
 */
export function createLogger(config?: Partial<LoggerConfig>): Logger {
  return new Logger(config)
}