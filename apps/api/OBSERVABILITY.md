# Observability and Logging

This document describes the observability features implemented in the API, including structured logging, sensitive data redaction, and enhanced health monitoring.

## Features

### 1. Structured Logging

The API uses a custom structured logging utility (`src/utils/logger.ts`) that provides:

- **Multiple log levels**: `debug`, `info`, `warn`, `error`
- **JSON output**: Configurable via `LOG_FORMAT=json` environment variable
- **Contextual data**: Attach structured context to each log entry
- **Timestamps**: ISO 8601 formatted timestamps on all log entries

#### Usage

```typescript
import { logger } from './utils/logger'

// Basic logging
logger.info('User action completed', { userId: '123', action: 'create-auction' })
logger.warn('Rate limit approaching', { remaining: 10, limit: 100 })
logger.error('Database error', { error: err.message, query: 'SELECT ...' })

// HTTP request/response logging
logger.request('POST', '/api/auctions', { query: { status: 'active' } })
logger.response('POST', '/api/auctions', 201, 45.2) // status, duration in ms
```

### 2. Sensitive Data Redaction

All logs automatically redact sensitive information including:

- **Private keys**: Hex strings (64 chars), WIF format, any field containing `privateKey`, `privKey`, `secretKey`
- **Seed phrases**: 12-24 word mnemonic phrases
- **API keys and tokens**: Fields like `apiKey`, `apiSecret`, `token`, `authorization`
- **Passwords**: Any field containing `password`, `pwd`, `pass`
- **Ownership data**: `sellerAddress`, `ownerAddress`, `buyerAddress`

#### Redaction Examples

```typescript
// Input
logger.info('Seed import', { 
  seed: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
  userId: '123'
})

// Output
[2025-09-30T07:42:13.813Z] INFO: Seed import {"seed":"[REDACTED]","userId":"123"}

// Private key redaction
logger.info('Key generated', {
  publicKey: '02abc123...',
  privateKey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
})

// Output
[2025-09-30T07:42:13.813Z] INFO: Key generated {"publicKey":"02abc123...","privateKey":"[REDACTED]"}
```

### 3. Enhanced Health Endpoint

The `/health` endpoint provides comprehensive service health information:

```json
GET /health

{
  "status": "healthy",  // or "degraded"
  "ok": true,
  "timestamp": "2025-09-30T07:36:57.348Z",
  "version": "0.1.0",
  "network": "testnet",
  "uptime": {
    "milliseconds": 53000,
    "seconds": 53,
    "human": "0m 53s"
  },
  "database": {
    "connected": true,
    "responseTimeMs": 1
  },
  "counts": {
    "active": 4,
    "sold": 0,
    "expired": 0,
    "total": 4
  },
  "environment": {
    "nodeEnv": "development",
    "platform": "bun",
    "bunVersion": "1.2.23"
  }
}
```

**Health Status Logic:**
- `healthy`: Database is connected and responding
- `degraded`: Database connection failed or queries timing out

### 4. Request/Response Logging

All API requests and responses are automatically logged with:

- HTTP method and path
- Response status code
- User agent (truncated to 100 chars)
- Automatic redaction of sensitive data

**Note:** Static assets (`.css`, `.js`, `.html`) and the `/health` endpoint are excluded from request logging to reduce noise.

### 5. Error Logging

Errors are logged with full context including:

- Error message
- Stack trace (first 3 lines)
- Request method and path
- Error type/name
- HTTP status code

Example error log:

```json
{
  "timestamp": "2025-09-30T07:42:13.813Z",
  "level": "error",
  "message": "Internal server error",
  "context": {
    "method": "POST",
    "path": "/create-auction",
    "error": "Database connection failed",
    "stack": "Error: Database connection failed\n    at ...\n    at ...",
    "errorName": "DatabaseError"
  }
}
```

### 6. Audit Logging

The service database (`src/services/db.ts`) maintains an audit log of all sensitive operations:

- Seed import/rotation
- Auction recovery
- Transaction monitoring
- Blockchain updates

All audit logs automatically apply sensitive data redaction.

## Configuration

### Environment Variables

- `LOG_LEVEL`: Minimum log level (`debug`, `info`, `warn`, `error`). Default: `info`
- `LOG_FORMAT`: Output format (`text` or `json`). Default: `text` in development, `json` in production
- `NODE_ENV`: Environment name (affects default log format)

### Examples

```bash
# Development (human-readable logs)
LOG_LEVEL=debug bun run dev

# Production (JSON logs for log aggregation)
NODE_ENV=production LOG_FORMAT=json LOG_LEVEL=info bun start

# Debug mode
LOG_LEVEL=debug bun run dev
```

## Testing

Run the logging tests to verify redaction:

```bash
bun test src/__tests__/logger.test.ts
```

The test suite covers:
- ✓ Seed phrase redaction
- ✓ Private key redaction (by field name and pattern)
- ✓ API key and token redaction
- ✓ Ownership data redaction
- ✓ Nested object redaction
- ✓ Array redaction
- ✓ Safe value preservation
- ✓ Structured logging functionality

## Best Practices

### 1. Always Use the Logger

```typescript
// ❌ DON'T
console.log('User logged in', { userId, password })

// ✅ DO
logger.info('User logged in', { userId }) // password excluded
```

### 2. Provide Rich Context

```typescript
// ❌ DON'T
logger.error('Failed')

// ✅ DO
logger.error('Auction creation failed', {
  operation: 'create-auction',
  inscriptionId,
  error: err.message,
  duration: Date.now() - startTime
})
```

### 3. Use Appropriate Log Levels

- `debug`: Detailed information for debugging (not shown by default)
- `info`: General informational messages (user actions, state changes)
- `warn`: Warning conditions that might need attention (rate limits, deprecated features)
- `error`: Error conditions requiring immediate attention

### 4. Never Log Sensitive Data Directly

The logger automatically redacts known sensitive fields, but:

```typescript
// ❌ AVOID - even though it will be redacted
logger.info('Processing', { privateKey: userKey })

// ✅ BETTER - don't include sensitive data at all
logger.info('Processing', { publicKey: pubKey })
```

## Monitoring and Alerting

### Recommended Metrics

Monitor these health endpoint fields:

1. **`status`**: Alert if `degraded` for > 5 minutes
2. **`database.connected`**: Alert if `false`
3. **`database.responseTimeMs`**: Alert if > 1000ms
4. **`uptime.seconds`**: Track for availability SLAs
5. **`counts.total`**: Monitor for unexpected drops

### Log Aggregation

In production with `LOG_FORMAT=json`, logs can be ingested by:

- **Datadog**: Use the Datadog agent with JSON parsing
- **Elasticsearch**: Ship logs via Filebeat or Fluentd
- **CloudWatch Logs**: Use the CloudWatch agent
- **Grafana Loki**: Use Promtail for log shipping

Example Loki query:

```logql
{app="dutch-api"} | json | level="error" | line_format "{{.message}}"
```

## Security Considerations

1. **Rate Limiting**: Consider rate-limiting access to `/health` to prevent abuse
2. **Audit Log Retention**: Implement log rotation and retention policies
3. **Sensitive Data**: Never disable redaction in production
4. **Log Access**: Restrict access to logs containing redacted but potentially useful information

## Future Enhancements

Potential improvements:

- [ ] Distributed tracing with OpenTelemetry
- [ ] Prometheus metrics endpoint
- [ ] Request ID propagation
- [ ] Log sampling for high-volume endpoints
- [ ] Configurable redaction patterns
- [ ] Log retention and rotation policies