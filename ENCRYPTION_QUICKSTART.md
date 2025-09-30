# Encryption Quick Start Guide

## For Developers

### 🔐 What Changed?

Private keys are now **properly encrypted** using AES-256-GCM before being stored in the database.

**Before:**
```typescript
database.storeAuction(auction, `enc_${privateKey}`)  // ❌ Symbolic prefix, plaintext
```

**After:**
```typescript
const encrypted = await database.encryptUtf8(privateKey, password)  // ✅ Real encryption
await database.storeAuction(auction, encrypted)
```

### 🚀 Quick Setup

#### Development
```bash
# Default password is 'changeit' - no setup needed for dev
bun run dev
```

#### Production
```bash
# 1. Generate a secure password
export AUCTION_ENCRYPTION_PASSWORD=$(openssl rand -base64 32)

# 2. Save to your secrets manager
echo $AUCTION_ENCRYPTION_PASSWORD > /secure/location/encryption-password.txt
chmod 600 /secure/location/encryption-password.txt

# 3. Start the application
bun run start
```

### 📝 Environment Variables

| Variable | Priority | Default | Production Required? |
|----------|----------|---------|---------------------|
| `AUCTION_ENCRYPTION_PASSWORD` | 1st | - | ✅ YES |
| `ENCRYPTION_PASSWORD` | 2nd | - | ✅ YES |
| Default | 3rd | `changeit` | ❌ NO (insecure) |

### ✅ Verify It's Working

#### Option 1: Check the Database
```bash
# SQLite
sqlite3 ./data/database.db 'SELECT encrypted_private_key FROM single_auctions LIMIT 1;'

# Should output JSON like:
# {"alg":"AES-256-GCM","kdf":"PBKDF2-SHA256",...}
```

#### Option 2: Run Unit Tests
```bash
bun test apps/api/src/__tests__/secure-key-storage.test.ts
```

#### Option 3: API Test
```bash
# Create an auction
curl -X POST http://localhost:3000/create-auction \
  -H "Content-Type: application/json" \
  -d '{
    "asset": "YOUR_INSCRIPTION_ID",
    "startPrice": 100000,
    "minPrice": 50000,
    "duration": 3600,
    "decrementInterval": 60,
    "sellerAddress": "tb1q..."
  }'

# Response should NOT contain any private keys
```

### 🔍 What to Look For

#### ✅ Correct (Encrypted)
```json
{
  "alg": "AES-256-GCM",
  "kdf": "PBKDF2-SHA256",
  "iter": 100000,
  "iv": "xJ3k5L7m9N1p3R5t",
  "salt": "aB2cD4eF6gH8iJ0k",
  "ct": "zY1xW3vU5tS7rQ9p"
}
```

#### ❌ Incorrect (Plaintext)
```
enc_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
```

### 🛠️ Common Tasks

#### Encrypt a Private Key
```typescript
import { db } from '@originals/dutch'

const password = process.env.AUCTION_ENCRYPTION_PASSWORD || 'changeit'
const encrypted = await db.encryptUtf8('your-private-key-hex', password)
```

#### Decrypt a Private Key (for recovery)
```typescript
import { db } from '@originals/dutch'

const auction = db.getAuction('auction-id')
const password = process.env.AUCTION_ENCRYPTION_PASSWORD || 'changeit'
const privateKey = await db.decryptToUtf8(auction.encrypted_private_key!, password)
```

#### Generate New Auction Keys
```typescript
import { db } from '@originals/dutch'

const password = process.env.AUCTION_ENCRYPTION_PASSWORD || 'changeit'
const { keyPair, address } = await db.generateAuctionKeyPair('auction-id', { password })
const encrypted = await db.encryptUtf8(keyPair.privateKeyHex, password)
```

### 🚨 Security Warnings

#### ⚠️ DO NOT
- Use `changeit` password in production
- Log private keys (encrypted or not)
- Return private keys in API responses
- Commit encryption passwords to git
- Share passwords across environments

#### ✅ DO
- Set `AUCTION_ENCRYPTION_PASSWORD` in production
- Use a secrets manager (Vault, AWS Secrets Manager, etc.)
- Rotate passwords periodically
- Monitor audit logs
- Keep backups of master seed

### 📚 Further Reading

- **Full Documentation**: See [SECURITY.md](./SECURITY.md)
- **Implementation Details**: See [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)
- **Code Reference**: `apps/api/src/index.ts` lines 703-738

### 🐛 Troubleshooting

#### Problem: "Wrong password" error when decrypting
**Solution:** Check that `AUCTION_ENCRYPTION_PASSWORD` matches the password used during encryption.

#### Problem: Database shows `enc_...` format
**Solution:** Old auctions not migrated. Either:
1. Re-create auctions with new encryption
2. Run migration script (see IMPLEMENTATION_SUMMARY.md)

#### Problem: Tests failing
**Solution:** Ensure test environment has proper encryption password set, or use default for tests.

#### Problem: "Cannot decrypt" errors in production
**Solution:** 
1. Check environment variable is set
2. Verify password hasn't changed
3. Check audit logs for clues
4. Consult disaster recovery docs

### 📞 Support

For security issues, see [SECURITY.md](./SECURITY.md) section on "Disaster Recovery" and "Compliance".