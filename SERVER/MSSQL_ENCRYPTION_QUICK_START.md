# MSSQL Connection String Encryption - Quick Start

## TL;DR (5 minutes)

### 1. Generate Key
```bash
cd SERVER
node encrypt-mssql-connection.js --generate-key
```
Copy the output key.

### 2. Update `.env`
Add the key you just copied:
```env
MSSQL_ENCRYPTION_KEY=your_copied_key_here
```

### 3. Encrypt Connection String
```bash
node encrypt-mssql-connection.js --encrypt
```
Copy the encrypted string output.

### 4. Update `.env` Again
Add the encrypted connection string:
```env
MSSQL_ENCRYPTION_KEY=your_key_here
MSSQL_ENCRYPTED_CONNECTION=your_encrypted_string_here
```

### 5. Test & Restart
```bash
node encrypt-mssql-connection.js --test
```
If test passes, restart your server. Done! ✓

---

## Why This Matters

**Before:** Your password is in plain text
```
MSSQL_PASSWORD=Xsm7NmDP  ← Anyone with .env can see it
```

**After:** Your password is encrypted
```
MSSQL_ENCRYPTED_CONNECTION=abc123:xyz789...  ← Can't read without key
```

---

## What Was Added

| File | Purpose |
|------|---------|
| `utils/encryptionService.js` | Core encryption (AES-256) |
| `utils/mssqlSecureConfig.js` | Auto-decrypt on startup |
| `encrypt-mssql-connection.js` | CLI tool (key gen, encrypt, test) |
| `MSSQL_ENCRYPTION_GUIDE.md` | Full documentation |
| `.env.encrypted.example` | Configuration examples |

---

## For Production

✅ **Recommended setup:**
```env
MSSQL_ENCRYPTION_KEY=your_secure_key_64_chars
MSSQL_ENCRYPTED_CONNECTION=your_encrypted_string
MSSQL_ENCRYPT=true
REDACT_LOGS=true
```

---

## Troubleshooting

**Q: Command not found?**
```
Make sure you're in SERVER directory:
cd SERVER
```

**Q: Generation shows error?**
```
Your current .env may be invalid syntax. Check MSSQL_ENCRYPTION_KEY is not already set.
```

**Q: Test fails?**
```
1. Delete both keys from .env
2. Run generate command again
3. Add ONLY the MSSQL_ENCRYPTION_KEY
4. Run encrypt command
5. Add BOTH keys to .env
```

---

## Next Steps

1. ✅ Migrate your current setup (use the 5-minute guide above)
2. ✅ Test locally with `--test` command
3. ✅ Restart server
4. ✅ Verify MSSQL connection works
5. ✅ Read full guide: `MSSQL_ENCRYPTION_GUIDE.md`

---

**Questions?** See `MSSQL_ENCRYPTION_GUIDE.md` for complete documentation.
