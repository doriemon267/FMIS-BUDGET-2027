# ⚡ MSSQL Encryption - Command Reference Card

**Quick reference for all CLI commands**

---

## 🎯 Commands (5 Options)

### 1️⃣ Generate Master Key
```bash
cd SERVER
node encrypt-mssql-connection.js --generate-key
```
**Output:** 64-character hex string  
**Action:** Add to `.env` as `MSSQL_ENCRYPTION_KEY=...`

---

### 2️⃣ Encrypt Connection String
```bash
node encrypt-mssql-connection.js --encrypt
```
**Prerequisites:** `.env` has correct MSSQL settings + `MSSQL_ENCRYPTION_KEY`  
**Output:** Shows connection details + encrypted string  
**Action:** Add to `.env` as `MSSQL_ENCRYPTED_CONNECTION=...`

---

### 3️⃣ Decrypt Specific String
```bash
node encrypt-mssql-connection.js --decrypt "abc123:def456..."
```
**Use Case:** Verify an encrypted string is correct  
**Output:** Decrypted connection string with parsed details

---

### 4️⃣ Test Encryption/Decryption
```bash
node encrypt-mssql-connection.js --test
```
**Prerequisites:** Both `MSSQL_ENCRYPTION_KEY` and `MSSQL_ENCRYPTED_CONNECTION` set  
**Output:** "✓ Test PASSED" or error message  
**Use:** Verify everything works before production

---

### 5️⃣ Show Help
```bash
node encrypt-mssql-connection.js --help
```
**Output:** Help text with all commands

---

## 📋 Step-by-Step Workflow

### First Time Setup
```bash
# Step 1: Go to SERVER directory
cd SERVER

# Step 2: Generate master key
node encrypt-mssql-connection.js --generate-key
# Copy output key

# Step 3: Add key to .env
# Edit .env and add:
# MSSQL_ENCRYPTION_KEY=your_copied_key

# Step 4: Encrypt your connection string
node encrypt-mssql-connection.js --encrypt
# Copy output encrypted string

# Step 5: Add encrypted string to .env
# Edit .env and add:
# MSSQL_ENCRYPTED_CONNECTION=your_encrypted_string

# Step 6: Test
node encrypt-mssql-connection.js --test
# Should see: ✓ Test PASSED

# Step 7: Restart your server
# The connection will be auto-decrypted on startup
```

---

## 🔄 Rotation Workflow (Update Encryption Key)

```bash
# When you want to rotate your key:

cd SERVER

# Step 1: Generate new key
node encrypt-mssql-connection.js --generate-key

# Step 2: Add new key to .env
# MSSQL_ENCRYPTION_KEY=new_key

# Step 3: Encrypt with new key
node encrypt-mssql-connection.js --encrypt

# Step 4: Update .env with new encrypted string
# MSSQL_ENCRYPTED_CONNECTION=new_encrypted_string

# Step 5: Test
node encrypt-mssql-connection.js --test

# Step 6: Restart server
```

---

## ✅ Verification Workflow

```bash
cd SERVER

# Verify encryption works
node encrypt-mssql-connection.js --test

# Verify you can decrypt
node encrypt-mssql-connection.js --decrypt "your_encrypted_string"

# Check server logs show:
# [MSSQL] ✓ Connected with ENCRYPTED connection string
```

---

## 🆘 Troubleshooting Workflow

```bash
# If key generation fails:
# - Make sure you're in SERVER directory
# - Check .env syntax
# - Delete MSSQL_ENCRYPTION_KEY if exists

# If encryption fails:
# - Check MSSQL settings in .env (host, port, db, user, password)
# - Verify MSSQL_ENCRYPTION_KEY is set
# - Run: node encrypt-mssql-connection.js --generate-key again

# If decryption fails:
# - Check encrypted string hasn't been truncated
# - Verify you're using the same master key
# - Try: node encrypt-mssql-connection.js --decrypt "string"
# - If parse fails, regenerate encrypted string

# If test fails:
# - Verify BOTH keys in .env
# - Check .env syntax (no trailing spaces)
# - Regenerate: start from --generate-key
```

---

## 💾 Environment Variables Quick Reference

### After Setup, Your .env Should Have:
```env
# Encryption (required for security)
MSSQL_ENCRYPTION_KEY=64_character_hex_string
MSSQL_ENCRYPTED_CONNECTION=iv_hex:encrypted_hex

# Optional (falls back to these if not encrypted)
# MSSQL_HOST=...
# MSSQL_PORT=...
# MSSQL_DB=...
# MSSQL_USER=...
# MSSQL_PASSWORD=...

# Recommended for production
MSSQL_ENCRYPT=true
REDACT_LOGS=true
```

---

## 📊 Expected Outputs

### --generate-key Output
```
✓ Generated Master Key:
  a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2

📝 Add this to your .env file:
  MSSQL_ENCRYPTION_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

### --encrypt Output
```
📊 Connection Details:
  Host: 172.16.4.10
  Port: 1433
  Database: HumanResourceDb
  User: edra
  Encrypt: false

✓ Encrypted Connection String:
  7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2:...

📝 Add this to your .env file:
  MSSQL_ENCRYPTED_CONNECTION=7h8i9j0k...
```

### --test Output (Success)
```
🧪 Running Encryption Test...

Original string:
  Server=localhost,1433;Database=TestDB;...

Encrypted:
  abc123:def456...

Decrypted:
  Server=localhost,1433;Database=TestDB;...

✓ Test PASSED: Encryption/Decryption working correctly!
```

### --test Output (Failure)
```
❌ Error: MSSQL_ENCRYPTION_KEY not found in .env
   Run: node encrypt-mssql-connection.js --generate-key
```

---

## 🎯 Common Scenarios

### Scenario 1: First Time Implementation
```bash
1. node encrypt-mssql-connection.js --generate-key
2. node encrypt-mssql-connection.js --encrypt
3. Add both to .env
4. node encrypt-mssql-connection.js --test
5. Restart server
```

### Scenario 2: Verify Existing Encryption
```bash
node encrypt-mssql-connection.js --test
# If pass → good to go
# If fail → regenerate
```

### Scenario 3: Change Database Credentials
```bash
1. Update MSSQL_HOST, MSSQL_PORT, MSSQL_DB, MSSQL_USER, MSSQL_PASSWORD in .env
2. node encrypt-mssql-connection.js --encrypt
3. Update MSSQL_ENCRYPTED_CONNECTION in .env
4. node encrypt-mssql-connection.js --test
5. Restart server
```

### Scenario 4: Rotate Encryption Key
```bash
1. node encrypt-mssql-connection.js --generate-key
2. Update MSSQL_ENCRYPTION_KEY in .env
3. node encrypt-mssql-connection.js --encrypt
4. Update MSSQL_ENCRYPTED_CONNECTION in .env
5. node encrypt-mssql-connection.js --test
6. Restart server
```

### Scenario 5: Troubleshoot Connection Issue
```bash
1. node encrypt-mssql-connection.js --test
2. If fails: node encrypt-mssql-connection.js --decrypt "your_encrypted_string"
3. Verify decrypted string looks correct
4. If not: regenerate from --encrypt
5. Restart server
```

---

## 📍 Working Directory

All commands must be run from `SERVER` directory:

```bash
# ✅ Correct
cd SERVER
node encrypt-mssql-connection.js --generate-key

# ❌ Wrong (won't work)
cd PROJECT_ROOT
node SERVER/encrypt-mssql-connection.js --generate-key

# ❌ Wrong (won't work)
node encrypt-mssql-connection.js --generate-key
```

---

## 🔗 Quick Links to Documentation

| Command | Learn More |
|---------|-----------|
| `--generate-key` | See MSSQL_ENCRYPTION_QUICK_START.md |
| `--encrypt` | See MSSQL_ENCRYPTION_GUIDE.md → Usage Modes |
| `--decrypt` | See MSSQL_ENCRYPTION_GUIDE.md → API Reference |
| `--test` | See MSSQL_ENCRYPTION_GUIDE.md → Testing |
| All commands | See MSSQL_ENCRYPTION_INDEX.md → Commands Reference |

---

## 💡 Tips & Tricks

### Tip 1: Copy-Paste Output
After `--generate-key`, copy entire output key (64 chars)

### Tip 2: Keep Backup
Save your master key in secure location (password manager, vault)

### Tip 3: Different Keys for Different Environments
```bash
# Development: one key
MSSQL_ENCRYPTION_KEY=dev_key

# Production: different key (from secrets manager)
MSSQL_ENCRYPTION_KEY=prod_key
```

### Tip 4: Verify After Changes
Always run `--test` after updating any MSSQL settings

### Tip 5: Check .env Syntax
After editing, ensure no trailing spaces or extra characters

---

## ⚠️ Important Notes

⚠️ **ALWAYS run from SERVER directory**  
⚠️ **Copy output EXACTLY (spaces matter)**  
⚠️ **Never commit `.env` to git**  
⚠️ **Back up your MSSQL_ENCRYPTION_KEY**  
⚠️ **Test before production deployment**

---

**Bookmark this page for quick reference!**
