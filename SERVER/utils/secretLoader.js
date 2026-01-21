const crypto = require('crypto');

function deriveKey(passphrase) {
  return crypto.createHash('sha256').update(String(passphrase)).digest();
}

function decryptString(encString, passphrase) {
  if (!encString || typeof encString !== 'string') return encString;
  if (!encString.startsWith('ENC(') || !encString.endsWith(')')) return encString;
  const inner = encString.slice(4, -1);
  const parts = inner.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted format');
  const iv = Buffer.from(parts[0], 'base64');
  const data = Buffer.from(parts[1], 'base64');
  const auth = Buffer.from(parts[2], 'base64');
  const key = deriveKey(passphrase);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(auth);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
}

function loadEncryptedEnv() {
  const pass = process.env.ENV_ENCRYPTION_KEY;
  if (!pass) {
    console.log('[secrets] ENV_ENCRYPTION_KEY not set — skipping env decryption');
    return;
  }

  Object.keys(process.env).forEach((k) => {
    const v = process.env[k];
    if (typeof v === 'string' && v.startsWith('ENC(') && v.endsWith(')')) {
      try {
        process.env[k] = decryptString(v, pass);
        console.log(`[secrets] Decrypted environment variable ${k}`);
      } catch (err) {
        console.error(`[secrets] Failed to decrypt ${k}: ${err.message}`);
      }
    }
  });
}

// Run automatically when required
loadEncryptedEnv();

module.exports = { loadEncryptedEnv, decryptString };
