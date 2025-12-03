/**
 * Encryption Service for MSSQL Connection String
 * - Encrypts/decrypts sensitive connection strings
 * - Uses AES-256-CBC encryption
 * - Safe to use for production data
 */

const crypto = require('crypto');

class EncryptionService {
  /**
   * Constructor
   * @param {string} masterKey - The encryption key (should be 32 bytes for AES-256)
   */
  constructor(masterKey) {
    if (!masterKey) {
      throw new Error('Master key is required for encryption service');
    }
    // Ensure key is exactly 32 bytes for AES-256
    this.key = this.normalizeKey(masterKey);
  }

  /**
   * Normalize key to 32 bytes using SHA-256
   * @param {string} masterKey - Raw master key
   * @returns {Buffer} - 32-byte encryption key
   */
  normalizeKey(masterKey) {
    return crypto.createHash('sha256').update(String(masterKey)).digest();
  }

  /**
   * Encrypt a connection string
   * @param {string} connectionString - The connection string to encrypt
   * @returns {string} - IV:EncryptedData format (hex encoded)
   */
  encrypt(connectionString) {
    if (!connectionString) {
      throw new Error('Connection string cannot be empty');
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.key, iv);
    
    let encrypted = cipher.update(String(connectionString), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Return IV and encrypted data separated by colon
    return `${iv.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt a connection string
   * @param {string} encryptedString - The encrypted string in IV:EncryptedData format
   * @returns {string} - Decrypted connection string
   */
  decrypt(encryptedString) {
    if (!encryptedString || typeof encryptedString !== 'string') {
      throw new Error('Invalid encrypted string format');
    }

    const parts = encryptedString.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted string format (expected IV:EncryptedData)');
    }

    try {
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      
      const decipher = crypto.createDecipheriv('aes-256-cbc', this.key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (err) {
      throw new Error(`Decryption failed: ${err.message}`);
    }
  }

  /**
   * Generate a random master key
   * @returns {string} - Random 32-byte key as hex string
   */
  static generateMasterKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create MSSQL connection string from environment variables
   * @param {object} envVars - Environment variables object
   * @returns {string} - MSSQL connection string
   */
  static buildMssqlConnectionString(envVars) {
    const {
      MSSQL_HOST = 'localhost',
      MSSQL_PORT = '1433',
      MSSQL_DB = '',
      MSSQL_USER = '',
      MSSQL_PASSWORD = '',
      MSSQL_ENCRYPT = 'false'
    } = envVars;

    const encrypt = MSSQL_ENCRYPT === 'true' || MSSQL_ENCRYPT === '1';
    const connectionString = `Server=${MSSQL_HOST},${MSSQL_PORT};Database=${MSSQL_DB};User Id=${MSSQL_USER};Password=${MSSQL_PASSWORD};Encrypt=${encrypt};TrustServerCertificate=true;`;
    
    return connectionString;
  }

  /**
   * Parse connection string into object
   * @param {string} connectionString - MSSQL connection string
   * @returns {object} - Parsed connection object
   */
  static parseConnectionString(connectionString) {
    const obj = {};
    const pairs = connectionString.split(';').filter(p => p.trim());
    
    pairs.forEach(pair => {
      const [key, value] = pair.split('=').map(s => s.trim());
      if (key && value) {
        obj[key] = value;
      }
    });
    
    return obj;
  }
}

module.exports = EncryptionService;
