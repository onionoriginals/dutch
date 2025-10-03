# Quick Start Guide - DID Integration

## Overview

The Dutch auction platform now automatically creates `did:webvh` identifiers for all users. This guide shows you how to use the new DID functionality.

## For Users

### Automatic DID Creation

When you create an auction, you automatically get a DID:

```bash
# Create an auction
curl -X POST http://localhost:3000/api/create-auction \
  -H "Content-Type: application/json" \
  -d '{
    "asset": "your_inscription_id",
    "startPrice": 1000000,
    "minPrice": 100000,
    "duration": 3600,
    "decrementInterval": 60,
    "sellerAddress": "your_bitcoin_address"
  }'

# A DID is automatically created for your_bitcoin_address
```

### Retrieve Your DID

```bash
curl http://localhost:3000/api/did/your_bitcoin_address
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "did": "did:webvh:a1b2c3d4e5f6g7h8",
    "didDocument": {
      "@context": ["https://www.w3.org/ns/did/v1", ...],
      "id": "did:webvh:a1b2c3d4e5f6g7h8",
      "verificationMethod": [...],
      "authentication": [...]
    }
  }
}
```

### Download Your DID Document

```bash
curl http://localhost:3000/api/did/your_bitcoin_address/did.jsonl -o my-did.jsonl
```

This downloads your DID in the standard JSONL format.

## For Developers

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/did/create` | POST | Create a new DID |
| `/api/did/:userAddress` | GET | Get DID by user address |
| `/api/did/:userAddress/did.jsonl` | GET | Download DID in JSONL format |
| `/api/did/resolve/:did` | GET | Resolve a DID |
| `/api/did/list` | GET | List all DIDs |

### Using WebVHManager in Code

```typescript
import { db } from '@originals/dutch'

// Create a DID
const result = await db.webvhManager.createDID({
  userAddress: 'tb1p...',
  publicKeyMultibase: 'z6Mk...', // optional
  serviceEndpoints: [            // optional
    {
      id: 'did:webvh:123#service-1',
      type: 'LinkedDomains',
      serviceEndpoint: 'https://example.com'
    }
  ]
})

// Get DID by user address
const did = db.webvhManager.getDIDByUserAddress('tb1p...')

// Resolve DID
const resolved = db.webvhManager.getDIDByDID('did:webvh:123')

// List all DIDs
const allDIDs = db.webvhManager.listDIDs()
```

### Testing

Run the test suite:

```bash
bun test apps/api/src/__tests__/did-creation.test.ts
```

### Verification

Verify the integration is working:

```bash
node scripts/verify-did-integration.js
```

Should output:
```
🎉 All checks passed! DID:WEBVH integration is complete.
```

## DID Document Structure

Your DID document follows the W3C DID specification:

```json
{
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://w3id.org/security/multikey/v1"
  ],
  "id": "did:webvh:a1b2c3d4e5f6g7h8",
  "verificationMethod": [
    {
      "id": "did:webvh:a1b2c3d4e5f6g7h8#key-1",
      "type": "Multikey",
      "controller": "did:webvh:a1b2c3d4e5f6g7h8",
      "publicKeyMultibase": "z6Mk..."
    }
  ],
  "authentication": ["did:webvh:a1b2c3d4e5f6g7h8#key-1"],
  "assertionMethod": ["did:webvh:a1b2c3d4e5f6g7h8#key-1"],
  "capabilityInvocation": ["did:webvh:a1b2c3d4e5f6g7h8#key-1"]
}
```

## JSONL Format

The `did.jsonl` file contains version history:

```jsonl
{"versionId":"1-abc123","versionTime":"2025-10-03T19:00:00.000Z","parameters":{"method":"did:webvh:0.1"},"state":{...didDocument...}}
```

Each line represents a version of your DID document.

## Common Use Cases

### Check if User Has DID

```typescript
const existingDID = db.webvhManager.getDIDByUserAddress(userAddress)
if (!existingDID) {
  // Create new DID
  await db.webvhManager.createDID({ userAddress })
}
```

### Add Service Endpoints

```typescript
await db.webvhManager.createDID({
  userAddress: 'tb1p...',
  serviceEndpoints: [
    {
      id: 'did:webvh:123#profile',
      type: 'Profile',
      serviceEndpoint: 'https://myprofile.com'
    }
  ]
})
```

### Resolve DID by Multiple Methods

```typescript
// By user address
const did1 = db.webvhManager.getDIDByUserAddress('tb1p...')

// By full DID
const did2 = db.webvhManager.getDIDByDID('did:webvh:123')

// Both return the same structure
```

## FAQ

**Q: Do I need to create a DID manually?**  
A: No, a DID is automatically created when you create your first auction.

**Q: Can I have multiple DIDs?**  
A: Each user address gets one DID. Creating another auction with the same address returns the existing DID.

**Q: What is the JSONL format?**  
A: JSONL (JSON Lines) is a format where each line is a valid JSON object. For DIDs, each line represents a version of your DID document.

**Q: Can I update my DID?**  
A: Currently, DIDs are created once. Update functionality is planned for future releases.

**Q: Is my DID publicly accessible?**  
A: Yes, DIDs can be resolved by anyone using the `/api/did/resolve/:did` endpoint.

## Support

For more detailed information, see:
- [DID_WEBVH_INTEGRATION.md](./DID_WEBVH_INTEGRATION.md) - Complete integration guide
- [INTEGRATION_SUMMARY.md](./INTEGRATION_SUMMARY.md) - Technical summary

## Examples

### Complete Flow Example

```bash
# 1. Create an auction (auto-creates DID)
curl -X POST http://localhost:3000/api/create-auction \
  -H "Content-Type: application/json" \
  -d '{
    "asset": "abc123...i0",
    "startPrice": 1000000,
    "minPrice": 100000,
    "duration": 3600,
    "decrementInterval": 60,
    "sellerAddress": "tb1ptest123"
  }'

# 2. Check your DID was created
curl http://localhost:3000/api/did/tb1ptest123

# 3. Download your DID document
curl http://localhost:3000/api/did/tb1ptest123/did.jsonl -o my-did.jsonl

# 4. View the JSONL file
cat my-did.jsonl | jq

# 5. Resolve by DID (using the DID from step 2)
curl http://localhost:3000/api/did/resolve/did:webvh:a1b2c3d4e5f6g7h8

# 6. List all DIDs in the system
curl http://localhost:3000/api/did/list
```

## Next Steps

- Explore the API endpoints
- Integrate DIDs into your application
- Use DIDs for authentication and verification
- Build on top of the DID infrastructure

---

**Note**: This integration uses `did:webvh` which is designed for verifiable history. Each DID maintains a complete version history in the JSONL format.
