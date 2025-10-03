# DID:WEBVH Integration

This document describes the integration of WebVHManager for did:webvh DID creation and management in the Dutch auction platform.

## Overview

The WebVHManager has been integrated into the user creation flow to automatically create and manage Decentralized Identifiers (DIDs) using the `did:webvh` method. Each user now gets a unique DID when they create their first auction.

## Components

### 1. WebVHManager (`packages/dutch/src/webvh-manager.ts`)

A new manager class that handles:
- Creating new did:webvh DIDs for users
- Storing DID documents in JSONL format
- Retrieving DID documents by user address or DID
- Version history management
- Listing all DIDs

**Key Features:**
- Deterministic DID identifier generation from user address
- JSONL format for version history (per did:webvh spec)
- Multikey verification method support
- Service endpoint configuration
- Automatic version tracking

### 2. Database Integration

The `WebVHManager` has been integrated into `SecureDutchyDatabase`:

```typescript
// In packages/dutch/src/database.ts
import { WebVHManager } from './webvh-manager'

export class SecureDutchyDatabase {
  public webvhManager: WebVHManager;
  
  constructor(dbPath: string, mempoolClient?: MempoolClientLike) {
    // ... existing setup
    this.webvhManager = new WebVHManager(this.db)
    this.initialize()
  }
}
```

**Database Schema:**
```sql
CREATE TABLE IF NOT EXISTS dids (
  id TEXT PRIMARY KEY,
  user_address TEXT NOT NULL,
  did TEXT NOT NULL UNIQUE,
  jsonl TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dids_user_address ON dids(user_address);
CREATE INDEX IF NOT EXISTS idx_dids_did ON dids(did);
```

### 3. API Endpoints

New DID-related endpoints have been added to the API:

#### POST /api/did/create
Creates a new DID for a user.

**Request:**
```json
{
  "userAddress": "tb1p...",
  "publicKeyMultibase": "z6Mk..." (optional),
  "serviceEndpoints": [
    {
      "id": "did:webvh:123#service-1",
      "type": "LinkedDomains",
      "serviceEndpoint": "https://example.com"
    }
  ] (optional)
}
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
      "authentication": [...],
      "service": [...]
    }
  }
}
```

#### GET /api/did/:userAddress
Retrieves DID information for a user by their address.

**Response:**
```json
{
  "ok": true,
  "data": {
    "did": "did:webvh:a1b2c3d4e5f6g7h8",
    "didDocument": { ... }
  }
}
```

#### GET /api/did/:userAddress/did.jsonl
Returns the DID document in JSONL format (as per did:webvh spec).

**Response:**
```jsonl
{"versionId":"1-abc123","versionTime":"2025-10-03T18:00:00.000Z","parameters":{"method":"did:webvh:0.1"},"state":{...didDocument...}}
```

**Headers:**
- `Content-Type: application/jsonl`
- `Content-Disposition: attachment; filename="a1b2c3d4e5f6g7h8.jsonl"`

#### GET /api/did/resolve/:did
Resolves a DID to its document. Accepts either full DID (`did:webvh:123`) or just the identifier (`123`).

**Response:**
```json
{
  "ok": true,
  "data": {
    "did": "did:webvh:a1b2c3d4e5f6g7h8",
    "didDocument": { ... }
  }
}
```

#### GET /api/did/list
Lists all DIDs in the system.

**Response:**
```json
{
  "ok": true,
  "data": {
    "dids": [
      {
        "id": "a1b2c3d4e5f6g7h8",
        "did": "did:webvh:a1b2c3d4e5f6g7h8",
        "userAddress": "tb1p...",
        "createdAt": 1696348800,
        "updatedAt": 1696348800
      }
    ]
  }
}
```

### 4. Automatic DID Creation

DIDs are automatically created for new users when they create an auction:

**Integration Points:**
- `POST /api/create-auction` - Single auction creation
- `POST /api/clearing/create-auction` - Clearing auction creation

**Flow:**
1. User submits auction creation request with their `sellerAddress`
2. System checks if user already has a DID
3. If not, automatically creates a new DID for the user
4. Logs the creation event
5. Continues with auction creation
6. If DID creation fails, logs warning but continues (non-blocking)

**Example Log:**
```json
{
  "level": "info",
  "operation": "auto-did-create",
  "userAddress": "tb1p...",
  "message": "DID auto-created for new user"
}
```

## DID Document Structure

Each DID follows the did:webvh specification:

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
  "capabilityInvocation": ["did:webvh:a1b2c3d4e5f6g7h8#key-1"],
  "service": []
}
```

## JSONL Format

The did.jsonl file contains version history in JSONL format:

```jsonl
{"versionId":"1-abc123","versionTime":"2025-10-03T18:00:00.000Z","parameters":{"method":"did:webvh:0.1"},"state":{...didDocument...}}
{"versionId":"2-def456","versionTime":"2025-10-03T19:00:00.000Z","parameters":{"method":"did:webvh:0.1"},"state":{...updatedDocument...}}
```

Each line represents a version of the DID document with:
- `versionId`: Unique version identifier (sequential number + hash)
- `versionTime`: ISO 8601 timestamp of the version
- `parameters`: Method-specific parameters
- `state`: The DID document at this version

## Security Considerations

1. **Deterministic IDs**: DID identifiers are generated using SHA-256 hash of user address + timestamp for uniqueness
2. **Public Keys**: Public keys are currently generated deterministically from user address (placeholder - should use wallet keys in production)
3. **Version Integrity**: Each version includes a hash of the document for integrity verification
4. **Database Storage**: DIDs are stored in SQLite with proper indexing for efficient retrieval
5. **Non-blocking**: DID creation is non-blocking - auction creation continues even if DID creation fails

## Testing

A comprehensive test suite has been created at `apps/api/src/__tests__/did-creation.test.ts` covering:

- ✅ DID creation for new users
- ✅ DID retrieval by user address
- ✅ DID resolution by DID identifier
- ✅ JSONL format generation and retrieval
- ✅ Idempotency (same user gets same DID)
- ✅ Custom public key support
- ✅ Service endpoint configuration
- ✅ DID listing
- ✅ Auto-creation during auction flow

## Future Enhancements

1. **Wallet Integration**: Use actual wallet public keys instead of deterministic generation
2. **DID Updates**: Implement DID document update functionality with proper versioning
3. **DID Deactivation**: Add support for deactivating DIDs
4. **Key Rotation**: Implement key rotation with updateKeys parameter
5. **Advanced Verification**: Add support for additional verification relationship types
6. **DID Resolution Protocol**: Implement full did:webvh resolution protocol
7. **Off-chain Storage**: Consider IPFS or other decentralized storage for did.jsonl files

## Usage Example

### Creating an auction (auto-creates DID)

```bash
curl -X POST http://localhost:3000/api/create-auction \
  -H "Content-Type: application/json" \
  -d '{
    "asset": "abc123...i0",
    "startPrice": 1000000,
    "minPrice": 100000,
    "duration": 3600,
    "decrementInterval": 60,
    "sellerAddress": "tb1p..."
  }'
```

### Retrieving user's DID

```bash
curl http://localhost:3000/api/did/tb1p...
```

### Downloading did.jsonl

```bash
curl http://localhost:3000/api/did/tb1p.../did.jsonl -o did.jsonl
```

### Resolving a DID

```bash
curl http://localhost:3000/api/did/resolve/did:webvh:a1b2c3d4e5f6g7h8
```

## Conclusion

The WebVHManager integration provides a complete DID infrastructure for the Dutch auction platform, enabling each user to have a decentralized identifier that can be used for authentication, verification, and identity management across the platform.
