# Inscription Verification API Documentation

## Overview

The inscription verification system validates Bitcoin inscription ownership through the mempool.space API before allowing auction creation. This document describes the verification process and API endpoints.

## Verification Flow

```
┌─────────────────────┐
│ User Submits Form   │
│ with Inscriptions   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Client-Side         │
│ Verification        │
│ (verifyInscription) │
└──────────┬──────────┘
           │
           ├─── [FAIL] ──► Show Error to User
           │
           ▼ [PASS]
┌─────────────────────┐
│ POST /api/          │
│ create-auction      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Server-Side         │
│ Verification        │
│ (mempool.space API) │
└──────────┬──────────┘
           │
           ├─── [FAIL] ──► Return 403 Error
           │
           ▼ [PASS]
┌─────────────────────┐
│ Create Auction      │
│ & Generate PSBT     │
└─────────────────────┘
```

## API Endpoints

### 1. Create Auction with Verification

**Endpoint:** `POST /api/create-auction`

**Description:** Creates a single-item Dutch auction with inscription ownership verification.

**Request Body:**
```json
{
  "asset": "abc123...def456i0",
  "startPrice": 0.01,
  "minPrice": 0.005,
  "duration": 3600,
  "decrementInterval": 60,
  "sellerAddress": "bc1q..."
}
```

**Request Fields:**
- `asset` (string, required): Inscription ID in format `<txid>i<vout>`
- `startPrice` (number, required): Starting price in BTC
- `minPrice` (number, required): Minimum/ending price in BTC
- `duration` (number, required): Auction duration in seconds
- `decrementInterval` (number, required): Price decrement interval in seconds
- `sellerAddress` (string, required): Bitcoin address that owns the inscription

**Success Response (200):**
```json
{
  "ok": true,
  "data": {
    "id": "abc123...def456:0:bc1q...",
    "address": "bc1q...",
    "psbt": "cHNid...",
    "inscriptionInfo": {
      "txid": "abc123...def456",
      "vout": 0,
      "address": "bc1q...",
      "value": 10000,
      "spent": false
    }
  }
}
```

**Error Responses:**

**400 - Invalid Inscription Format:**
```json
{
  "ok": false,
  "error": "Invalid inscriptionId format. Expected <txid>i<index>",
  "code": "VALIDATION_ERROR"
}
```

**404 - Transaction Not Found:**
```json
{
  "ok": false,
  "error": "Transaction abc123...def456 not found on testnet",
  "code": "NOT_FOUND"
}
```

**404 - Output Not Found:**
```json
{
  "ok": false,
  "error": "Output 0 not found in transaction abc123...def456",
  "code": "OUTPUT_NOT_FOUND"
}
```

**403 - Ownership Mismatch:**
```json
{
  "ok": false,
  "error": "Ownership mismatch: inscription is owned by bc1qxyz..., not bc1qabc...",
  "code": "OWNERSHIP_MISMATCH"
}
```

**403 - Already Spent:**
```json
{
  "ok": false,
  "error": "This inscription has already been spent and cannot be auctioned",
  "code": "ALREADY_SPENT"
}
```

### 2. Create Clearing Auction with Verification

**Endpoint:** `POST /api/clearing/create-auction`

**Description:** Creates a multi-item clearing auction (uniform price Dutch auction).

**Request Body:**
```json
{
  "inscriptionIds": [
    "abc123...def456i0",
    "def456...abc789i1",
    "ghi789...xyz012i0"
  ],
  "quantity": 3,
  "startPrice": 0.01,
  "minPrice": 0.005,
  "duration": 3600,
  "decrementInterval": 60,
  "sellerAddress": "bc1q..."
}
```

**Note:** Currently, clearing auction endpoint doesn't enforce inscription verification server-side. Client-side verification should be performed before calling this endpoint.

## mempool.space API Integration

### Transaction Details

**Endpoint:** `GET https://mempool.space/api/tx/{txid}`

**Response:**
```json
{
  "txid": "abc123...def456",
  "vout": [
    {
      "scriptpubkey_address": "bc1q...",
      "value": 10000,
      "scriptpubkey": "0014..."
    }
  ]
}
```

### Outspend Status

**Endpoint:** `GET https://mempool.space/api/tx/{txid}/outspends`

**Response:**
```json
[
  {
    "spent": false,
    "txid": null,
    "vin": null,
    "status": null
  }
]
```

## Error Codes Reference

| Code | HTTP Status | Description | User Action |
|------|-------------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request format | Check inscription ID format |
| `NOT_FOUND` | 404 | Transaction not found | Verify inscription ID and network |
| `OUTPUT_NOT_FOUND` | 404 | Output doesn't exist | Check vout index in inscription ID |
| `OWNERSHIP_MISMATCH` | 403 | Seller doesn't own inscription | Use correct seller address |
| `ALREADY_SPENT` | 403 | Inscription UTXO is spent | Cannot auction spent inscriptions |
| `INTERNAL_ERROR` | 500 | Server error | Try again later |

## Client-Side Verification

### Function Signature

```typescript
async function verifyInscriptionOwnership(
  inscriptionId: string,
  sellerAddress: string,
  network: Network = 'mainnet'
): Promise<InscriptionVerificationResult>
```

### Usage Example

```typescript
import { verifyInscriptionOwnership } from '@/lib/bitcoin/verifyInscription'

const result = await verifyInscriptionOwnership(
  'abc123...def456i0',
  'bc1q...',
  'testnet'
)

if (result.valid) {
  // Proceed with auction creation
  console.log('Verified:', result.details)
} else {
  // Show error to user
  console.error('Error:', result.error)
}
```

### Batch Verification

```typescript
import { verifyMultipleInscriptions } from '@/lib/bitcoin/verifyInscription'

const results = await verifyMultipleInscriptions(
  ['inscription1i0', 'inscription2i1'],
  'bc1q...',
  'testnet'
)

const allValid = results.every(r => r.valid)
```

## Network Configuration

### Environment Variables

**Backend (API):**
```bash
BITCOIN_NETWORK=testnet  # mainnet, testnet, signet, regtest
```

**Frontend (Web):**
```bash
PUBLIC_BITCOIN_NETWORK=testnet  # mainnet, testnet, signet, regtest
```

### Network API URLs

| Network | API Base URL |
|---------|--------------|
| Mainnet | `https://mempool.space/api` |
| Testnet | `https://mempool.space/testnet/api` |
| Signet | `https://mempool.space/signet/api` |
| Regtest | `http://localhost:3002/api` |

## Security Considerations

1. **Double Verification:** Both client and server verify ownership
2. **Rate Limiting:** Consider rate limiting mempool.space API calls
3. **Caching:** Cache verification results to reduce API calls
4. **Input Validation:** Validate inscription ID format before API calls
5. **Network Validation:** Ensure verification happens on correct network

## Rate Limits

mempool.space public API:
- No authentication required
- Fair use policy applies
- Recommended: 1 request per second
- Consider caching results for frequently verified inscriptions

## Testing

### Test Networks

**Testnet:**
```bash
# Use testnet inscriptions for testing
export PUBLIC_BITCOIN_NETWORK=testnet
export BITCOIN_NETWORK=testnet
```

**Regtest (Local):**
```bash
# Requires local mempool.space instance
export PUBLIC_BITCOIN_NETWORK=regtest
export BITCOIN_NETWORK=regtest
```

### Mock Data for Testing

For unit tests, mock the verification function:

```typescript
import { vi } from 'vitest'
import * as verifyModule from '@/lib/bitcoin/verifyInscription'

vi.spyOn(verifyModule, 'verifyInscriptionOwnership').mockResolvedValue({
  valid: true,
  details: {
    txid: 'abc123...def456',
    vout: 0,
    address: 'bc1q...',
    value: 10000,
    spent: false
  }
})
```

## Monitoring

### Key Metrics to Track

1. **Verification Success Rate:** % of successful verifications
2. **Verification Latency:** Time to verify inscriptions
3. **Error Types:** Distribution of error codes
4. **Network Errors:** mempool.space API failures

### Logging

The API logs verification attempts:

```typescript
logger.info('Ownership verification', {
  operation: 'ownership-check',
  inscriptionId: 'abc123...i0',
  ownerMatches: true,
  spent: false,
  sellerAddress: 'bc1q...',  // Redacted in logs
  voutAddress: 'bc1q...'     // Redacted in logs
})
```

## Troubleshooting

### Common Issues

1. **"Transaction not found"**
   - Verify inscription ID is correct
   - Check network setting matches inscription network
   - Ensure transaction is confirmed

2. **"Ownership mismatch"**
   - Use address that currently owns the inscription
   - Check for recent transfers

3. **"Network timeout"**
   - mempool.space API may be slow
   - Retry after a few seconds
   - Check internet connection

4. **"Output not found"**
   - Verify vout index in inscription ID
   - Some transactions may have fewer outputs

## Future Enhancements

1. **Caching Layer:** Redis cache for verification results
2. **Retry Logic:** Automatic retry for transient failures
3. **Rate Limiting:** Client-side rate limiting for API calls
4. **Fallback APIs:** Multiple mempool API providers
5. **Webhook Notifications:** Alert on spend status changes

## Support

For API issues or questions:
- Check error code and message
- Review mempool.space API status
- Verify network configuration
- See implementation in `apps/api/src/index.ts` (lines 932-1111)
