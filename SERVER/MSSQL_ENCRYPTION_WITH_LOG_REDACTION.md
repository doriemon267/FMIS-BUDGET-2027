# MSSQL Encryption + Log Redaction Integration

## Overview

The MSSQL encryption system works seamlessly with your existing log redaction system to provide defense-in-depth security:

```
┌──────────────────────────────────────────────────┐
│         Defense-in-Depth Security                │
├──────────────────────────────────────────────────┤
│                                                   │
│  Layer 1: Connection String Encryption           │
│  ──────────────────────────────────────────────   │
│  Passwords encrypted at rest in .env              │
│  Decrypted only in memory on startup              │
│                                                   │
│  Layer 2: Log Redaction                          │
│  ──────────────────────────────────────────────   │
│  Any passwords that appear in logs are redacted   │
│  Emails, user IDs, message IDs also redacted      │
│                                                   │
│  Layer 3: Environment Variable Management        │
│  ──────────────────────────────────────────────   │
│  Never log raw environment variables              │
│  Use getStatus() instead of raw env vars          │
│                                                   │
└──────────────────────────────────────────────────┘
```

## Recommended Configuration

### Production `.env`

```env
# Enable both encryption and log redaction
ENABLE_MSSQL=true
MSSQL_ENCRYPTION_KEY=your_master_key_here
MSSQL_ENCRYPTED_CONNECTION=your_encrypted_string_here
MSSQL_ENCRYPT=true

# Enable log redaction
REDACT_LOGS=true
DEBUG_MODE=false

# Do NOT include these if using encrypted connection:
# MSSQL_PASSWORD=...  (would be exposed in logs)
# MSSQL_USER=...      (would be exposed in logs)
```

## How They Work Together

### Scenario 1: Password Leaked Without Redaction
```
❌ WITHOUT Encryption + Redaction:
   [MSSQL] Connected with password: Xsm7NmDP ← VISIBLE IN LOGS!

✅ WITH Encryption + Redaction:
   [MSSQL] Connected with ENCRYPTED connection string
```

### Scenario 2: Error Message with Credentials
```
❌ WITHOUT Encryption:
   Error: Cannot connect. Check password: Xsm7NmDP ← EXPOSED!

✅ WITH Encryption:
   Error: Cannot connect. Decryption failed.
   (actual password never appears)
```

### Scenario 3: Debug Information
```
❌ WITHOUT Encryption (Debug Mode):
   [DEBUG] MSSQL_PASSWORD=Xsm7NmDP ← EXPOSED!

✅ WITH Encryption (Debug Mode):
   [DEBUG] MSSQL encryption status: enabled
   [DEBUG] Using encrypted connection string
```

## Implementation Details

### Encryption Service (Auto-Redacted)

When using the encryption service:

```javascript
// ✅ Safe - Password encrypted and redacted
const service = new EncryptionService(process.env.MSSQL_ENCRYPTION_KEY);
const encrypted = service.encrypt(connectionString);
// Password in connectionString never logged

// ✅ Safe - Status doesn't reveal secrets
const status = mssqlSecureConfig.getStatus();
console.log(status);
// Output:
// {
//   encryptionEnabled: true,
//   usingEncryptedConnection: true,
//   mssqlHost: '172.16.4.10',      ← Host is OK to log
//   mssqlDb: 'HumanResourceDb',    ← DB name is OK to log
//   message: 'Connection string encryption is ENABLED'
// }
```

### Log Redaction (Catches Everything Else)

```javascript
// ❌ If someone tries to log password directly:
console.log('Password:', process.env.MSSQL_PASSWORD);

// ✓ With REDACT_LOGS=true, this becomes:
// Password: ***REDACTED***
```

## Startup Messages

### With Encryption Enabled

```
[MSSQL] ✓ Connected with ENCRYPTED connection string
```

### Without Encryption

```
[MSSQL] ✓ Connected (Note: encryption is not enabled - set MSSQL_ENCRYPTION_KEY to enable)
```

### If Decryption Fails

```
[MSSQL] Failed to decrypt connection string: [error details]
[MSSQL] Falling back to individual environment variables
[MSSQL] ⚠️  WARNING: Using unencrypted connection variables
```

## Best Practices

### ✅ DO: Use Encryption + Redaction Together

```env
# Production configuration
ENABLE_MSSQL=true
MSSQL_ENCRYPTION_KEY=your_key
MSSQL_ENCRYPTED_CONNECTION=your_encrypted_conn
MSSQL_ENCRYPT=true
REDACT_LOGS=true
```

### ✅ DO: Check Encryption Status Safely

```javascript
const status = mssqlSecureConfig.getStatus();
if (status.encryptionEnabled) {
  console.log('✓ Encryption is ENABLED');
} else {
  console.warn('⚠️  Encryption is not enabled');
}
```

### ❌ DON'T: Log Raw Environment Variables

```javascript
// ❌ BAD - Could expose secrets
console.log('MSSQL Config:', {
  host: process.env.MSSQL_HOST,
  user: process.env.MSSQL_USER,
  password: process.env.MSSQL_PASSWORD  // EXPOSED!
});

// ✅ GOOD - Use safe status
console.log('MSSQL Config:', mssqlSecureConfig.getStatus());
```

### ❌ DON'T: Disable Log Redaction

```env
# ❌ DANGEROUS in production
REDACT_LOGS=false
```

### ❌ DON'T: Mix Encrypted and Unencrypted

```env
# ❌ Confusing - which takes priority?
MSSQL_ENCRYPTED_CONNECTION=xxx:yyy
MSSQL_PASSWORD=unencrypted_password

# ✅ Use one or the other
```

## Monitoring and Alerts

### Set Up Alerts For

1. **Failed Decryption**
   ```
   Pattern: "[MSSQL] Failed to decrypt connection string"
   Action: Check MSSQL_ENCRYPTION_KEY and MSSQL_ENCRYPTED_CONNECTION
   ```

2. **Encryption Not Enabled**
   ```
   Pattern: "encryption is not enabled"
   Action: Verify production deployment has keys
   ```

3. **Connection Failures**
   ```
   Pattern: "[MSSQL] Connection failed"
   Action: Verify database is accessible
   ```

## Audit Trail

### What Gets Logged (Safe)
```
[MSSQL] ✓ Connected with ENCRYPTED connection string
[MSSQL] Encryption service initialized
[INFO] MSSQL status: encryptionEnabled=true
```

### What Doesn't Get Logged (Protected)
```
❌ Password: Xsm7NmDP
❌ Connection string: Server=...;Password=...;
❌ Decrypted values
❌ MSSQL_ENCRYPTION_KEY
```

## Troubleshooting Encrypted Logs

### Issue: Can't Find Password in Logs

**This is expected!**

With encryption + redaction enabled:
- Passwords are encrypted when at rest
- Decrypted only in memory
- Never logged even if decrypt fails

### Issue: Need to Debug Connection

**Safe approach:**

```bash
# Use the test command (doesn't expose passwords)
node SERVER/encrypt-mssql-connection.js --test

# Or enable DEBUG_MODE for more info (still redacted)
# DEBUG_MODE=true
```

### Issue: Something Still in Logs

**Run log redaction check:**

```bash
# Check what would be redacted
REDACT_LOGS=true DEBUG_MODE=true npm start

# Look for: ***REDACTED***
```

## Security Checklist

```
Pre-Deployment
─────────────
☐ MSSQL_ENCRYPTION_KEY is set and not in git
☐ MSSQL_ENCRYPTED_CONNECTION is set correctly
☐ REDACT_LOGS=true in production
☐ Individual MSSQL_* password vars are removed or commented
☐ .env file is git-ignored
☐ Log files don't contain passwords (spot check)

Post-Deployment
──────────────
☐ MSSQL connection works
☐ Logs show "Connected with ENCRYPTED connection string"
☐ Application functions normally
☐ No decryption errors in logs
☐ Passwords don't appear anywhere in output

Ongoing
──────
☐ Monitor logs for decryption failures
☐ Audit .env access and permissions
☐ Plan key rotation schedule
☐ Update disaster recovery procedures
```

## Integration Examples

### With Existing Log System

```javascript
// From SERVER/utils/logRedactor.js
const { logger: redactLogger } = require("./utils/logRedactor");

// ✓ Safe - MSSQL encryption works with this
if (shouldRedact) {
  redactLogger.log('[MSSQL] Connected with encrypted connection');
} else {
  console.log('[MSSQL] Connected');
}
```

### With Existing Auth System

```javascript
// Your existing code continues to work
const { sequelize } = require('./mssql');

// ✓ Sequelize gets properly configured connection
// ✓ No password appears in connection string
const models = require('./models');
```

## See Also

- [MSSQL_ENCRYPTION_GUIDE.md](./MSSQL_ENCRYPTION_GUIDE.md) - Full encryption guide
- [SERVER/utils/logRedactor.js](./utils/logRedactor.js) - Log redaction implementation
- [SERVER/utils/encryptionService.js](./utils/encryptionService.js) - Encryption implementation
- [PRODUCTION_SECURITY.md](./PRODUCTION_SECURITY.md) - Overall security guide

---

**Summary:** Encryption + Log Redaction = Defense-in-Depth Security ✅
