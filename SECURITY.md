# Security Documentation

## Private Key Encryption

### Overview

The auction creation flow generates private keys for each auction and stores them securely in the database using **AES-256-GCM encryption** with **PBKDF2-SHA256** key derivation.

### Implementation

#### Encryption Algorithm
- **Cipher**: AES-256-GCM (Galois/Counter Mode)
- **Key Derivation**: PBKDF2-SHA256
- **Iterations**: 100,000
- **Salt**: 16 bytes (random per encryption)
- **IV**: 12 bytes (random per encryption)

#### Storage Format

Encrypted private keys are stored as JSON with the following structure:

```json
{
  "alg": "AES-256-GCM",
  "kdf": "PBKDF2-SHA256",
  "iter": 100000,
  "iv": "<base64-encoded-iv>",
  "salt": "<base64-encoded-salt>",
  "ct": "<base64-encoded-ciphertext>"
}
```

### Environment Variables

#### Required for Production

Set an encryption password using one of these environment variables (checked in order):

1. `AUCTION_ENCRYPTION_PASSWORD` - Specific to auction key encryption
2. `ENCRYPTION_PASSWORD` - General encryption password
3. Default: `changeit` (NOT suitable for production)

**⚠️ WARNING**: The default password `changeit` is only suitable for development. **You MUST set a strong, unique password in production.**

#### Example Configuration

```bash
# Production
export AUCTION_ENCRYPTION_PASSWORD="your-strong-random-password-here"

# OR use a general encryption password
export ENCRYPTION_PASSWORD="your-strong-random-password-here"
```

#### Generating a Strong Password

```bash
# Generate a secure random password (Linux/macOS)
openssl rand -base64 32

# Or using Bun
bun -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Key Rotation

Currently, the system does not support automatic key rotation. To implement key rotation:

1. **Master Seed Rotation**: Use the existing `rotateMasterMnemonic` method in `SecureDutchyDatabase`
2. **Encryption Password Rotation**: Re-encrypt all private keys with a new password (requires database migration)

### Security Best Practices

#### DO ✅
- Set `AUCTION_ENCRYPTION_PASSWORD` to a strong, unique value in production
- Use a secrets management system (e.g., HashiCorp Vault, AWS Secrets Manager) to store the password
- Rotate encryption passwords periodically (e.g., quarterly)
- Restrict database access to only necessary services
- Enable database encryption at rest
- Use TLS for all database connections
- Monitor audit logs for suspicious activity

#### DON'T ❌
- Use the default `changeit` password in production
- Hardcode encryption passwords in source code
- Log or expose encrypted private keys in API responses
- Store encryption passwords in version control
- Share encryption passwords across environments

### Verification

#### Unit Tests

Run the secure key storage tests:

```bash
bun test apps/api/src/__tests__/secure-key-storage.test.ts
```

#### Integration Tests

Test the full auction creation flow:

```bash
bun test apps/api/src/__tests__/create_escrow.test.ts
```

### Audit Trail

All encryption-related operations are logged to the `audit_logs` table:
- `seed_created`: Master seed generation
- `seed_imported`: Master seed import
- `seed_rotated`: Master seed rotation
- `auction_stored`: Auction creation with encrypted key

### Database Schema

#### SQLite (`single_auctions` table)

```sql
CREATE TABLE single_auctions (
  id TEXT PRIMARY KEY,
  -- ... other fields ...
  encrypted_private_key TEXT,  -- Stores AES-256-GCM encrypted private key
  -- ... other fields ...
);
```

#### PostgreSQL (same schema)

The PostgreSQL implementation (`database.pg.ts`) uses the same encryption mechanism and schema.

### Disaster Recovery

In case of encryption password loss:

1. **If master seed is available**: Private keys can be re-derived deterministically using `generateAuctionKeyPair(auctionId)`
2. **If master seed is lost**: Private keys cannot be recovered

**Important**: Always maintain secure backups of:
- Master seed (via `/seed/backup-with-warnings` endpoint - use with extreme caution)
- Encryption passwords (in secure secrets management)

### Compliance

This implementation provides:
- ✅ **Encryption at application layer**: AES-256-GCM
- ✅ **Key derivation**: PBKDF2-SHA256 with 100k iterations
- ✅ **Unique salts**: Each encryption uses random salt and IV
- ✅ **Audit logging**: All key operations logged
- ✅ **No plaintext exposure**: Private keys never stored unencrypted

### API Security

The `/create-auction` endpoint:
- ✅ Validates inscription ownership via blockchain API
- ✅ Checks UTXO is unspent
- ✅ Generates deterministic auction keys
- ✅ Encrypts private keys before storage
- ✅ Never returns private keys in responses
- ✅ Never logs private keys

### Future Enhancements

Planned security improvements:
- [ ] Encryption password rotation utility
- [ ] Hardware Security Module (HSM) integration
- [ ] Multi-signature auction escrow
- [ ] Time-locked key recovery
- [ ] Automated key expiration after auction settlement