# MSSQL Connection String Encryption Guide

## Overview

This guide explains how to encrypt your MSSQL connection string for secure storage. The implementation uses **AES-256-CBC encryption** with environment variables, making it safe for production deployments.

## Why Encrypt Connection Strings?

**Before (Unencrypted):**
```
MSSQL_PASSWORD=Xsm7NmDP
```
- Passwords stored as plain text in `.env`
- If `.env` is exposed → passwords compromised
- Visible in logs (unless redacted)
- Not suitable for production

**After (Encrypted):**
```
MSSQL_ENCRYPTION_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
MSSQL_ENCRYPTED_CONNECTION=xxx:yyy...
```
- Connection string encrypted at rest
- Master key kept separate
- Secure for production deployments
- Automatic decryption on server startup

## Installation

The encryption service is already integrated into your project:

### Files Created

1. **`SERVER/utils/encryptionService.js`**
   - Core encryption/decryption logic
   - AES-256-CBC implementation
   - Static utility methods

2. **`SERVER/utils/mssqlSecureConfig.js`**
   - Manages encrypted configurations
   - Automatically decrypts connection strings
   - Provides Sequelize configuration

3. **`SERVER/encrypt-mssql-connection.js`**
   - CLI tool for key generation
   - Connection string encryption
   - Testing utility

4. **`SERVER/.env.encrypted.example`**
   - Usage examples and documentation

## Quick Start (3 Steps)

### Step 1: Generate Master Key

```bash
cd SERVER
node encrypt-mssql-connection.js --generate-key
```

**Output:**
```
✓ Generated Master Key:
  a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2

📝 Add this to your .env file:
  MSSQL_ENCRYPTION_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

**Action:** Add the key to `.env`:
```env
MSSQL_ENCRYPTION_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

### Step 2: Encrypt Connection String

```bash
node encrypt-mssql-connection.js --encrypt
```

**Output:**
```
📊 Connection Details:
  Host: 172.16.4.10
  Port: 1433
  Database: HumanResourceDb
  User: edra
  Encrypt: false

✓ Encrypted Connection String:
  7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2a1b2c3d4e5f6:xyz...

📝 Add this to your .env file:
  MSSQL_ENCRYPTED_CONNECTION=7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2:xyz...
```

**Action:** Add the encrypted string to `.env`:
```env
MSSQL_ENCRYPTED_CONNECTION=7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2:xyz...
```

### Step 3: Test Decryption

```bash
node encrypt-mssql-connection.js --test
```

**Output:**
```
🧪 Running Encryption Test...

Original string:
  Server=localhost,1433;Database=TestDB;User Id=sa;Password=Test123!;

Encrypted:
  abc123:def456...

Decrypted:
  Server=localhost,1433;Database=TestDB;User Id=sa;Password=Test123!;

✓ Test PASSED: Encryption/Decryption working correctly!
```

**Action:** Restart your server. Connection will be automatically decrypted on startup.

## Usage Modes

### Mode 1: Encrypted Connection (Recommended for Production)

**`.env` file:**
```env
MSSQL_ENCRYPTION_KEY=your_master_key_here
MSSQL_ENCRYPTED_CONNECTION=your_encrypted_string_here
ENABLE_MSSQL=true
```

**Behavior:**
- Automatically decrypts `MSSQL_ENCRYPTED_CONNECTION` on startup
- Individual `MSSQL_*` variables are ignored
- Secure for production deployments

### Mode 2: Individual Variables (Development)

**`.env` file:**
```env
ENABLE_MSSQL=true
MSSQL_HOST=172.16.4.10\SQLServer
MSSQL_PORT=1433
MSSQL_DB=HumanResourceDb
MSSQL_USER=edra
MSSQL_PASSWORD=Xsm7NmDP
MSSQL_ENCRYPT=false
```

**Behavior:**
- Uses unencrypted individual variables
- Suitable for local development
- Note: passwords visible in plain text

### Mode 3: Hybrid (Flexible)

```env
# Encryption keys (optional)
MSSQL_ENCRYPTION_KEY=your_master_key

# Individual variables (fallback)
MSSQL_HOST=172.16.4.10\SQLServer
MSSQL_PORT=1433
MSSQL_DB=HumanResourceDb
MSSQL_USER=edra
MSSQL_PASSWORD=Xsm7NmDP

# If MSSQL_ENCRYPTED_CONNECTION is set, it takes priority
# MSSQL_ENCRYPTED_CONNECTION=xxx:yyy
```

**Behavior:**
- If `MSSQL_ENCRYPTED_CONNECTION` is set → uses encrypted version
- Otherwise → falls back to individual variables
- Useful during migration

## API Reference

### EncryptionService

```javascript
const EncryptionService = require('./utils/encryptionService');

// Initialize with master key
const service = new EncryptionService(process.env.MSSQL_ENCRYPTION_KEY);

// Encrypt a string
const encrypted = service.encrypt('Server=localhost;...;Password=secret;');
// Returns: "abc123:def456..."

// Decrypt a string
const decrypted = service.decrypt('abc123:def456...');
// Returns: "Server=localhost;...;Password=secret;"

// Generate a random master key
const masterKey = EncryptionService.generateMasterKey();
// Returns: "a1b2c3d4e5f6..."

// Build connection string from env
const connStr = EncryptionService.buildMssqlConnectionString(process.env);

// Parse connection string into object
const parsed = EncryptionService.parseConnectionString(connStr);
// Returns: { Server: '...', Database: '...', 'User Id': '...', ... }
```

### MssqlSecureConfig

```javascript
const mssqlSecureConfig = require('./utils/mssqlSecureConfig');

// Get decrypted connection string
const connStr = mssqlSecureConfig.getConnectionString();

// Get Sequelize configuration
const config = mssqlSecureConfig.getSequelizeConfig();

// Get encryption status
const status = mssqlSecureConfig.getStatus();
// Returns: { 
//   encryptionEnabled: true,
//   usingEncryptedConnection: true,
//   mssqlHost: '172.16.4.10',
//   mssqlDb: 'HumanResourceDb',
//   message: 'Connection string encryption is ENABLED'
// }

// Encrypt and display encrypted string
const result = mssqlSecureConfig.encryptAndStoreConnectionString();
```

## Commands Reference

### Generate Master Key
```bash
node SERVER/encrypt-mssql-connection.js --generate-key
```

### Encrypt Connection String
```bash
node SERVER/encrypt-mssql-connection.js --encrypt
```

### Decrypt a Specific String
```bash
node SERVER/encrypt-mssql-connection.js --decrypt "abc123:def456..."
```

### Test Encryption/Decryption
```bash
node SERVER/encrypt-mssql-connection.js --test
```

### Show Help
```bash
node SERVER/encrypt-mssql-connection.js --help
```

## Security Best Practices

### 1. Protect Your Master Key

```env
# ❌ DON'T: Commit to git
MSSQL_ENCRYPTION_KEY=secret_key

# ✅ DO: Use environment variables
# Set via CI/CD, secrets manager, or secure env file
```

### 2. Use Encrypted Connections for Production

```env
# ✅ Recommended for Production
MSSQL_ENCRYPTION_KEY=your_secure_key
MSSQL_ENCRYPTED_CONNECTION=your_encrypted_string
MSSQL_ENCRYPT=true
```

### 3. Enable Log Redaction

```env
# Prevent passwords from appearing in logs
REDACT_LOGS=true
```

### 4. Rotate Keys Periodically

```bash
# Generate new key
node encrypt-mssql-connection.js --generate-key

# Encrypt with new key
node encrypt-mssql-connection.js --encrypt

# Update .env and restart
```

### 5. Secure `.env` File

- Never commit `.env` to git
- Use proper file permissions (600)
- Store in secure location
- Use secrets manager in production (AWS Secrets, Azure Key Vault, etc.)

## Troubleshooting

### "MSSQL_ENCRYPTION_KEY not found"
```
Error: Master key is required for encryption service
```
**Solution:** Run `node encrypt-mssql-connection.js --generate-key` first

### "Invalid encrypted string format"
```
Error: Invalid encrypted string format (expected IV:EncryptedData)
```
**Solution:** Check that the encrypted string hasn't been truncated or corrupted

### "Decryption failed"
```
Error: Decryption failed: Unsupported state or unable to authenticate data
```
**Solutions:**
1. Verify you're using the correct `MSSQL_ENCRYPTION_KEY`
2. Ensure `MSSQL_ENCRYPTED_CONNECTION` hasn't been modified
3. Regenerate the encrypted string: `node encrypt-mssql-connection.js --encrypt`

### Connection works unencrypted but fails with encryption

**Possible causes:**
1. Wrong master key
2. Encrypted string was modified
3. Connection string has special characters

**Solution:**
1. Run: `node encrypt-mssql-connection.js --decrypt "your_encrypted_string"`
2. Verify the decrypted connection string matches expected format
3. If incorrect, regenerate: `node encrypt-mssql-connection.js --encrypt`

## Migration Path

### From Unencrypted to Encrypted

**Current state (unencrypted):**
```env
MSSQL_HOST=172.16.4.10\SQLServer
MSSQL_PORT=1433
MSSQL_DB=HumanResourceDb
MSSQL_USER=edra
MSSQL_PASSWORD=Xsm7NmDP
```

**Step 1:** Generate key
```bash
cd SERVER && node encrypt-mssql-connection.js --generate-key
```

**Step 2:** Add key to `.env`
```env
MSSQL_ENCRYPTION_KEY=a1b2c3d4e5f6...
MSSQL_HOST=172.16.4.10\SQLServer
MSSQL_PORT=1433
MSSQL_DB=HumanResourceDb
MSSQL_USER=edra
MSSQL_PASSWORD=Xsm7NmDP
```

**Step 3:** Encrypt connection string
```bash
node encrypt-mssql-connection.js --encrypt
```

**Step 4:** Add encrypted string to `.env`
```env
MSSQL_ENCRYPTION_KEY=a1b2c3d4e5f6...
MSSQL_ENCRYPTED_CONNECTION=xxx:yyy...
MSSQL_HOST=172.16.4.10\SQLServer
MSSQL_PORT=1433
MSSQL_DB=HumanResourceDb
MSSQL_USER=edra
MSSQL_PASSWORD=Xsm7NmDP
```

**Step 5:** Test
```bash
node encrypt-mssql-connection.js --test
```

**Step 6:** (Optional) Remove individual variables
```env
MSSQL_ENCRYPTION_KEY=a1b2c3d4e5f6...
MSSQL_ENCRYPTED_CONNECTION=xxx:yyy...
```

**Step 7:** Restart server

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `MSSQL_ENCRYPTION_KEY` | Master key for encryption (32 bytes, hex encoded) | `a1b2c3d4e5f6...` |
| `MSSQL_ENCRYPTED_CONNECTION` | Encrypted connection string (IV:EncryptedData format) | `abc123:def456...` |
| `MSSQL_HOST` | Database server hostname or IP | `172.16.4.10\SQLServer` |
| `MSSQL_PORT` | Database server port | `1433` |
| `MSSQL_DB` | Database name | `HumanResourceDb` |
| `MSSQL_USER` | Database username | `edra` |
| `MSSQL_PASSWORD` | Database password | `Xsm7NmDP` |
| `MSSQL_ENCRYPT` | Enable SSL/TLS encryption | `true` or `false` |
| `ENABLE_MSSQL` | Enable MSSQL integration | `true` |
| `REDACT_LOGS` | Redact sensitive data from logs | `true` |

## See Also

- [EncryptionService](./utils/encryptionService.js) - Core encryption logic
- [MssqlSecureConfig](./utils/mssqlSecureConfig.js) - Configuration management
- [MSSQL Connection Setup](./mssql/index.js) - Connection initialization
- [.env.encrypted.example](./.env.encrypted.example) - Configuration examples

