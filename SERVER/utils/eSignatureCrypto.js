const crypto = require('crypto');

const KEY_ENV = 'ESIGNATURE_IMAGE_ENCRYPTION_KEY';
const ENCRYPTED_PREFIX = 'enc:v1:';

const resolveKeyBuffer = () => {
  const raw = String(process.env[KEY_ENV] || '').trim();
  if (!raw) return null;

  if (/^[a-fA-F0-9]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }

  if (raw.startsWith('base64:')) {
    try {
      const key = Buffer.from(raw.slice(7), 'base64');
      if (key.length === 32) return key;
    } catch (_) {}
  }

  try {
    const asBase64 = Buffer.from(raw, 'base64');
    if (asBase64.length === 32) return asBase64;
  } catch (_) {}

  return crypto.createHash('sha256').update(raw).digest();
};

const encryptESignatureDataUrl = (plainText) => {
  const source = String(plainText || '');
  if (!source) return source;

  const key = resolveKeyBuffer();
  if (!key) return source;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(source, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${ENCRYPTED_PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
};

const decryptESignatureDataUrl = (cipherText) => {
  const value = String(cipherText || '');
  if (!value) return value;
  if (!value.startsWith(ENCRYPTED_PREFIX)) return value;

  const key = resolveKeyBuffer();
  if (!key) {
    throw new Error(`${KEY_ENV} is required to decrypt encrypted e-signatures`);
  }

  const payload = value.slice(ENCRYPTED_PREFIX.length);
  const [ivB64, tagB64, encryptedB64] = payload.split(':');
  if (!ivB64 || !tagB64 || !encryptedB64) {
    throw new Error('Invalid encrypted e-signature payload format');
  }

  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const encrypted = Buffer.from(encryptedB64, 'base64');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
};

module.exports = {
  encryptESignatureDataUrl,
  decryptESignatureDataUrl,
  ENCRYPTED_PREFIX
};
