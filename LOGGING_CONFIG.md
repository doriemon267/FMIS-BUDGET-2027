# Server Logging Configuration

## Overview
The server now has a flexible logging system that supports:
- **Debug Mode**: Toggle verbose logging on/off
- **Log Redaction**: Automatically mask sensitive data (emails, user IDs, etc.)

## Environment Variables (in `.env`)

### `DEBUG_MODE` (Default: `false`)
Controls verbosity of logs across the entire server.

```env
DEBUG_MODE=false   # Production: Only errors and warnings shown
DEBUG_MODE=true    # Development: All logs shown
```

**What's affected:**
- `console.log()` - Hidden in production, shown in debug mode
- `console.info()` - Hidden in production, shown in debug mode
- `console.debug()` - Hidden in production, shown in debug mode
- `console.warn()` - Always shown (critical)
- `console.error()` - Always shown (critical)

### `REDACT_LOGS` (Default: `true`)
Automatically masks sensitive information in all logs.

```env
REDACT_LOGS=true   # Production: Redact emails, IDs, message IDs
REDACT_LOGS=false  # Development: Show raw values (for debugging)
```

**What gets redacted:**
- ✅ Email addresses: `user@domain.com` → `u***@d***com`
- ✅ MongoDB ObjectIds: `ObjectId('691bbe...')` → `[OBJECT_ID]`
- ✅ Email message IDs: `<668a128a-4118...@gmail.com>` → `[EMAIL_MSG_ID]`
- ✅ Phone numbers: `09171234567` → `[PHONE]`

## Usage Examples

### Production (Default)
```env
DEBUG_MODE=false
REDACT_LOGS=true
```
- Only errors/warnings logged
- All sensitive data masked
- **Minimal performance impact** ✨

### Development with Debug
```env
DEBUG_MODE=true
REDACT_LOGS=true
```
- All logs shown with debug info
- Sensitive data still masked
- Good for troubleshooting without security risks

### Development with Raw Values (For Testing)
```env
DEBUG_MODE=true
REDACT_LOGS=false
```
- All logs shown with actual values
- No redaction
- **Use only locally for testing!**

## Log Flow

```
console.log/warn/error call
    ↓
[index.js global handler]
    ↓
[Check DEBUG_MODE and REDACT_LOGS]
    ↓
[Apply redaction if enabled]
    ↓
Output to console
```

## Files Affected
- `SERVER/index.js` - Global console replacement
- `SERVER/utils/logRedactor.js` - Redaction utility
- `SERVER/utils/debugLogger.js` - Debug filtering utility
- All controller files with `console.log/warn/error` calls

## Performance Impact

| Config | Log Output | Sensitive Data | Performance |
|--------|-----------|-----------------|-------------|
| Debug=true, Redact=true | Full | Masked | Slower |
| **Debug=false, Redact=true** | **Errors only** | **Masked** | **⚡ Fast** |
| Debug=false, Redact=false | Errors only | Raw | Fast |
| Debug=true, Redact=false | Full | Raw | Slower |

**Recommended for Production:** `DEBUG_MODE=false` + `REDACT_LOGS=true`

## Testing the Configuration

### Check current settings
```bash
# View .env file
cat SERVER/.env | grep -E "DEBUG_MODE|REDACT_LOGS"
```

### See debug logs in action
```bash
# Set to debug mode
echo "DEBUG_MODE=true" >> SERVER/.env

# Restart server and make a proposal action
# You'll see verbose logs like:
# [sendWorkflowEmails] Starting email delivery process...
# [sendWorkflowEmails] Looking up region: [OBJECT_ID]
# [sendWorkflowEmails] Sending email to u***@d***com...
```

### Turn off debug mode
```bash
# Change DEBUG_MODE back to false
# Restart server - logs will be minimal
```
