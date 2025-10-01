# Security Architecture: Inscription Verification

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interface                           │
│                  (Create Auction Wizard)                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ User submits auction
                             │ with inscription IDs
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Client-Side Layer                             │
│         (verifyInscription.ts - Pre-submission Check)            │
├─────────────────────────────────────────────────────────────────┤
│  ✓ Format Validation                                             │
│  ✓ mempool.space API Query                                       │
│  ✓ Ownership Check                                               │
│  ✓ Spend Status Check                                            │
│  ✓ User-Friendly Error Display                                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ [PASS] - Submit to API
                             │ [FAIL] - Show error to user
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API Gateway Layer                           │
│                    (Elysia HTTP Server)                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ POST /api/create-auction
                             │ POST /api/clearing/create-auction
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Server-Side Layer (NEW)                         │
│              (index.ts - Security Enforcement)                   │
├─────────────────────────────────────────────────────────────────┤
│  🔒 SECURITY CHECKPOINT                                          │
│     ├── Format Validation                                        │
│     ├── Transaction Existence                                    │
│     ├── Ownership Verification                                   │
│     ├── Spend Status Verification                                │
│     └── Comprehensive Logging                                    │
│                                                                   │
│  [ALL PASS] → Create Auction                                     │
│  [ANY FAIL] → Return 403 Error                                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ Query blockchain data
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    mempool.space API                             │
│                  (Blockchain Data Source)                        │
├─────────────────────────────────────────────────────────────────┤
│  GET /tx/{txid}          - Transaction details                   │
│  GET /tx/{txid}/outspends - UTXO spend status                   │
└─────────────────────────────────────────────────────────────────┘
```

## Verification Flow Comparison

### BEFORE: Vulnerable Architecture ❌

```
┌──────────┐       ┌──────────┐       ┌──────────┐
│  Client  │──────▶│   API    │──────▶│    DB    │
│          │       │ (No Check)│       │          │
└──────────┘       └──────────┘       └──────────┘
     │                                      │
     │                                      │
  Optional                              Auction
  Client                                Created
  Verify                             (Unverified!)
   (Can
   Bypass)
```

**Vulnerability:** Attacker can skip client verification and POST directly to API

### AFTER: Secure Architecture ✅

```
┌──────────┐       ┌──────────────────┐       ┌──────────┐
│  Client  │──────▶│       API        │──────▶│    DB    │
│          │       │  ┌────────────┐  │       │          │
└──────────┘       │  │  VERIFY    │  │       └──────────┘
     │             │  │  OWNERSHIP │  │            │
     │             │  │  & SPEND   │  │            │
  Optional         │  │  STATUS    │  │         Auction
  Client           │  └────────────┘  │         Created
  Verify           │        │         │       (Verified!)
  (Bonus           │        ▼         │
   Speed)          │  [PASS] or       │
                   │  [FAIL→403]      │
                   │        │         │
                   │        ▼         │
                   │  ┌────────────┐  │
                   │  │ mempool.   │  │
                   │  │ space API  │  │
                   │  └────────────┘  │
                   └──────────────────┘
```

**Security:** Server ALWAYS verifies, regardless of client behavior

## Defense in Depth

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: Client-Side Validation (UX Enhancement)        │
├─────────────────────────────────────────────────────────┤
│  • Fast feedback to user                                │
│  • Reduces invalid API calls                            │
│  • NOT security boundary                                │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 2: API Input Validation (Basic Protection)        │
├─────────────────────────────────────────────────────────┤
│  • Parameter presence checks                            │
│  • Type validation                                      │
│  • Format validation                                    │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 3: Ownership Verification (SECURITY BOUNDARY) 🔒  │
├─────────────────────────────────────────────────────────┤
│  • Transaction existence check                          │
│  • Output ownership verification                        │
│  • UTXO spend status check                             │
│  • All-or-nothing verification                          │
│  • Comprehensive logging                                │
│  • THIS IS THE CRITICAL SECURITY LAYER                  │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 4: Database & Business Logic                      │
├─────────────────────────────────────────────────────────┤
│  • Auction creation                                     │
│  • PSBT generation                                      │
│  • Transaction tracking                                 │
└─────────────────────────────────────────────────────────┘
```

## Attack Surface Analysis

### Before Fix

```
┌─────────────────────────────────────────┐
│          Attack Vectors                  │
├─────────────────────────────────────────┤
│ ✗ Direct API POST (HIGH RISK)           │
│ ✗ Bypass client verification            │
│ ✗ List unowned inscriptions             │
│ ✗ Auction spent inscriptions            │
│ ✗ No server-side validation             │
└─────────────────────────────────────────┘
          │
          │ Attacker uses curl/Postman
          ▼
    Fraudulent Auction Created ⚠️
```

### After Fix

```
┌─────────────────────────────────────────┐
│          Attack Vectors                  │
├─────────────────────────────────────────┤
│ ✓ Direct API POST (BLOCKED)             │
│ ✓ Bypass attempt (DETECTED)             │
│ ✓ Unowned inscription (REJECTED)        │
│ ✓ Spent inscription (REJECTED)          │
│ ✓ Server verification (ENFORCED)        │
└─────────────────────────────────────────┘
          │
          │ Server verification catches all attacks
          ▼
    403 Error with Details ✓
```

## Trust Boundaries

```
┌──────────────────────────────────────────────────────┐
│                UNTRUSTED ZONE                         │
│  ┌────────────────────────────────────────────────┐  │
│  │  User's Browser (Can be manipulated)          │  │
│  │  - Client-side JavaScript                     │  │
│  │  - Form validation                            │  │
│  │  - Network requests                           │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
                       │
                       │ HTTPS
                       │
   ════════════════════▼════════════════════════════
        TRUST BOUNDARY (API Gateway)
   ═════════════════════════════════════════════════
                       │
┌──────────────────────┼────────────────────────────────┐
│               TRUSTED ZONE                            │
│  ┌─────────────────────────────────────────────────┐ │
│  │  Server-Side Verification (Cannot be bypassed) │ │
│  │  - Ownership checks                            │ │
│  │  - Blockchain queries                          │ │
│  │  - Security logging                            │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │  Database (Verified data only)                 │ │
│  │  - Auction records                             │ │
│  │  - Transaction data                            │ │
│  └─────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────┘
```

## Security Properties

### Confidentiality
- ✅ No sensitive data exposed in error messages
- ✅ Addresses logged but can be redacted
- ✅ Transaction details from public blockchain only

### Integrity
- ✅ All inscriptions verified before auction creation
- ✅ Cannot create auction for unowned inscriptions
- ✅ Cannot auction already-spent inscriptions
- ✅ All-or-nothing transaction semantic

### Availability
- ✅ Graceful error handling
- ✅ Clear error messages for debugging
- ✅ Logging for monitoring
- ⚠️ Dependent on mempool.space API availability

### Authentication
- ✅ Ownership verified via blockchain data
- ✅ Cannot impersonate other users
- ✅ Cryptographic proof through Bitcoin addresses

### Authorization
- ✅ Only inscription owners can auction their inscriptions
- ✅ Server enforces ownership rules
- ✅ No privilege escalation possible

### Auditability
- ✅ All verification attempts logged
- ✅ Success and failure events tracked
- ✅ Detailed error information captured
- ✅ Security events identifiable

## Performance Considerations

```
┌─────────────────────────────────────────────────────────┐
│  Verification Performance (per inscription)              │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Client Request                                          │
│       │                                                  │
│       ▼                                                  │
│  Format Check           (~1ms)                          │
│       │                                                  │
│       ▼                                                  │
│  API: GET /tx/{txid}    (~200-500ms)                    │
│       │                                                  │
│       ▼                                                  │
│  Ownership Check        (~1ms)                          │
│       │                                                  │
│       ▼                                                  │
│  API: GET outspends     (~200-500ms)                    │
│       │                                                  │
│       ▼                                                  │
│  Spend Check            (~1ms)                          │
│       │                                                  │
│       ▼                                                  │
│  TOTAL: ~400-1000ms per inscription                     │
│                                                          │
│  10 inscriptions = 4-10 seconds (sequential)            │
│  Could be optimized to 400-1000ms with parallel         │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Conclusion

The security architecture now implements proper defense-in-depth with:
1. Client-side validation for UX
2. Server-side enforcement for security
3. Blockchain verification for authenticity
4. Comprehensive logging for auditability

**Status:** ✅ SECURE
