# Deployment Checklist - Secure Private Key Handling

## Pre-Deployment

### ☐ 1. Review Changes
- [ ] Read [SECURITY.md](./SECURITY.md)
- [ ] Read [ENCRYPTION_QUICKSTART.md](./ENCRYPTION_QUICKSTART.md)
- [ ] Review [CHANGELOG_SECURITY_FIX.md](./CHANGELOG_SECURITY_FIX.md)
- [ ] Understand encryption algorithm (AES-256-GCM + PBKDF2-SHA256)

### ☐ 2. Generate Encryption Password
```bash
# Generate a secure 32-byte password
openssl rand -base64 32

# Save output securely (next step)
```

**Generated Password:** `________________________` (DO NOT commit to git!)

### ☐ 3. Store Password in Secrets Manager
- [ ] Add to HashiCorp Vault
- [ ] Add to AWS Secrets Manager
- [ ] Add to Azure Key Vault
- [ ] Add to Google Secret Manager
- [ ] Add to Railway/Heroku config vars
- [ ] Add to `.env` file (for local only, gitignored)

**Storage Location:** `________________________`

### ☐ 4. Set Environment Variables

#### Production
```bash
export AUCTION_ENCRYPTION_PASSWORD="your-secure-password-here"
```
- [ ] Set in production environment
- [ ] Verify variable is set: `echo $AUCTION_ENCRYPTION_PASSWORD | wc -c` (should be > 20)
- [ ] Restart application to pick up new variable

#### Staging (Optional)
```bash
export AUCTION_ENCRYPTION_PASSWORD="different-staging-password"
```
- [ ] Set in staging environment
- [ ] Use different password than production

#### Development (Optional)
```bash
# Can use default 'changeit' or set custom
export AUCTION_ENCRYPTION_PASSWORD="dev-password-123"
```
- [ ] Set in development environment (optional)

### ☐ 5. Run Tests Locally
```bash
# Run all tests
bun test

# Run specific encryption tests
bun test apps/api/src/__tests__/secure-key-storage.test.ts

# Run integration tests
bun test apps/api/src/__tests__/create_escrow.test.ts
```
- [ ] All tests pass locally
- [ ] No errors in console

---

## Deployment

### ☐ 6. Deploy Code
```bash
# Example deployment commands
git pull origin main
bun install
bun run build
bun run start
```
- [ ] Code deployed successfully
- [ ] Application started without errors
- [ ] Logs show no encryption-related errors

### ☐ 7. Verify Deployment
```bash
# Check application is running
curl http://your-domain.com/health

# Expected response:
# {"ok":true,"network":"...","version":"..."}
```
- [ ] Health check passes
- [ ] No errors in logs

---

## Post-Deployment Verification

### ☐ 8. Test Encryption via API

#### Create Test Auction
```bash
curl -X POST http://your-domain.com/create-auction \
  -H "Content-Type: application/json" \
  -d '{
    "asset": "VALID_INSCRIPTION_ID_HERE",
    "startPrice": 100000,
    "minPrice": 50000,
    "duration": 3600,
    "decrementInterval": 60,
    "sellerAddress": "VALID_SELLER_ADDRESS"
  }'
```
- [ ] Request succeeds (200 OK)
- [ ] Response contains `id`, `address`, `psbt`
- [ ] Response does NOT contain any private keys
- [ ] Auction appears in `/auctions` endpoint

**Test Auction ID:** `________________________`

### ☐ 9. Verify Database Encryption

#### SQLite
```bash
sqlite3 /path/to/database.db \
  "SELECT encrypted_private_key FROM single_auctions WHERE id = 'TEST_AUCTION_ID' LIMIT 1;"
```

#### PostgreSQL
```bash
psql -d database_name -c \
  "SELECT encrypted_private_key FROM single_auctions WHERE id = 'TEST_AUCTION_ID' LIMIT 1;"
```

**Expected Output:**
```json
{"alg":"AES-256-GCM","kdf":"PBKDF2-SHA256","iter":100000,"iv":"...","salt":"...","ct":"..."}
```

**Verification:**
- [ ] Output is JSON format
- [ ] Contains `"alg":"AES-256-GCM"`
- [ ] Contains `"kdf":"PBKDF2-SHA256"`
- [ ] Contains `"iter":100000`
- [ ] Contains `iv`, `salt`, `ct` fields
- [ ] Does NOT contain plaintext private key
- [ ] Does NOT start with `enc_`

### ☐ 10. Check Logs
```bash
# View recent logs
tail -n 100 /path/to/logs/app.log

# Or for containerized deployments
docker logs container_name --tail 100
```

**Verify:**
- [ ] No private keys in logs
- [ ] No encryption errors
- [ ] No decryption failures
- [ ] Audit log entries for `auction_stored` present

### ☐ 11. Verify Audit Trail
```bash
# SQLite
sqlite3 database.db "SELECT * FROM audit_logs WHERE event = 'auction_stored' ORDER BY created_at DESC LIMIT 5;"

# PostgreSQL
psql -d database_name -c "SELECT * FROM audit_logs WHERE event = 'auction_stored' ORDER BY created_at DESC LIMIT 5;"
```
- [ ] Audit entries exist for new auctions
- [ ] Timestamps are correct
- [ ] No sensitive data in audit logs

---

## Security Verification

### ☐ 12. Security Checklist
- [ ] `AUCTION_ENCRYPTION_PASSWORD` set (not using default `changeit`)
- [ ] Password stored in secrets manager (not in code)
- [ ] Password has sufficient entropy (32+ bytes)
- [ ] Passwords different per environment (prod vs staging vs dev)
- [ ] Database shows encrypted format (JSON with AES-256-GCM)
- [ ] No private keys in API responses
- [ ] No private keys in logs
- [ ] No private keys in error messages
- [ ] Audit logs enabled and working
- [ ] Health endpoint doesn't expose sensitive info

### ☐ 13. Test Decryption (Recovery Scenario)
```bash
# Using Bun REPL or script
bun -e "
import { db } from '@originals/dutch';
const auction = db.getAuction('TEST_AUCTION_ID');
const password = process.env.AUCTION_ENCRYPTION_PASSWORD;
const privateKey = await db.decryptToUtf8(auction.encrypted_private_key, password);
console.log('Decryption successful, key length:', privateKey.length);
"
```
- [ ] Decryption succeeds with correct password
- [ ] Private key hex string recovered (64 characters)
- [ ] Test with wrong password fails

---

## Monitoring Setup

### ☐ 14. Configure Alerts
Set up monitoring for:
- [ ] Failed decryption attempts
- [ ] Unusual audit log activity
- [ ] Database access patterns
- [ ] Environment variable changes
- [ ] Application errors related to encryption

**Monitoring Tools Used:** `________________________`

### ☐ 15. Document Password Location
**Production Password Stored At:**
- Path: `________________________`
- Access: `________________________` (who has access)
- Backup: `________________________` (backup location)

**Staging Password Stored At:**
- Path: `________________________`
- Access: `________________________`

---

## Rollback Plan (If Needed)

### ☐ 16. Rollback Preparation
If issues arise, rollback procedure:

1. **Revert Code:**
   ```bash
   git revert <commit-hash>
   git push origin main
   ```

2. **Old auctions will still work** (backward compatible)

3. **New auctions created during deployment:**
   - Will have proper encryption
   - Will remain encrypted (safe)
   - Can be manually fixed if needed

**Rollback Decision Maker:** `________________________`

---

## Handoff

### ☐ 17. Team Notification
- [ ] Notify team of successful deployment
- [ ] Share test auction ID for reference
- [ ] Document any issues encountered
- [ ] Update runbooks with new procedures

### ☐ 18. Documentation Update
- [ ] Update internal wiki with encryption info
- [ ] Add password rotation schedule (quarterly recommended)
- [ ] Document access control for secrets
- [ ] Schedule next password rotation date

**Next Password Rotation Date:** `________________________`

---

## Sign-Off

### Deployed By
**Name:** `________________________`  
**Date:** `________________________`  
**Time:** `________________________`  

### Verified By
**Name:** `________________________`  
**Date:** `________________________`  
**Time:** `________________________`  

### Approved By
**Name:** `________________________`  
**Date:** `________________________`  
**Time:** `________________________`  

---

## Emergency Contacts

**Security Lead:** `________________________`  
**DevOps Lead:** `________________________`  
**On-Call Engineer:** `________________________`  

---

## Additional Notes

Use this space for deployment-specific notes:

```
[Space for notes]






```

---

## Post-Deployment Tasks (30 Days)

- [ ] **Week 1:** Monitor logs daily for encryption errors
- [ ] **Week 2:** Review audit trail for anomalies
- [ ] **Week 3:** Verify backup procedures include encryption keys
- [ ] **Week 4:** Schedule password rotation planning meeting
- [ ] **Ongoing:** Monitor for security advisories related to AES/PBKDF2

---

## References

- [SECURITY.md](./SECURITY.md) - Full security documentation
- [ENCRYPTION_QUICKSTART.md](./ENCRYPTION_QUICKSTART.md) - Developer reference
- [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - Technical details
- [CHANGELOG_SECURITY_FIX.md](./CHANGELOG_SECURITY_FIX.md) - Change history