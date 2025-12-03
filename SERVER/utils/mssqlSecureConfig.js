/**
 * Secure MSSQL Configuration
 * - Uses encryption service to secure connection strings
 * - Provides both encrypted and plaintext modes
 * - For production: use MSSQL_ENCRYPTION_KEY in environment
 */

const EncryptionService = require('./encryptionService');

class MssqlSecureConfig {
  constructor() {
    // Initialize encryption service if master key is provided
    const masterKey = process.env.MSSQL_ENCRYPTION_KEY;
    this.encryptionEnabled = !!masterKey;
    
    if (this.encryptionEnabled) {
      try {
        this.encryptionService = new EncryptionService(masterKey);
        console.log('[MSSQL] Encryption service initialized');
      } catch (err) {
        console.error('[MSSQL] Failed to initialize encryption:', err.message);
        this.encryptionEnabled = false;
      }
    }
  }

  /**
   * Get secure connection string
   * - If MSSQL_ENCRYPTED_CONNECTION is set, decrypt it
   * - Otherwise, build from individual env variables
   */
  getConnectionString() {
    // Check for encrypted connection string in environment
    const encryptedConnection = process.env.MSSQL_ENCRYPTED_CONNECTION;
    
    if (encryptedConnection && this.encryptionEnabled) {
      try {
        const decrypted = this.encryptionService.decrypt(encryptedConnection);
        return decrypted;
      } catch (err) {
        console.error('[MSSQL] Failed to decrypt connection string:', err.message);
        console.warn('[MSSQL] Falling back to individual environment variables');
      }
    }

    // Build connection string from environment variables
    return EncryptionService.buildMssqlConnectionString(process.env);
  }

  /**
   * Encrypt and store connection string in environment
   * Useful during initialization or setup scripts
   */
  encryptAndStoreConnectionString() {
    if (!this.encryptionEnabled) {
      console.warn('[MSSQL] Encryption not enabled. Set MSSQL_ENCRYPTION_KEY to enable.');
      return null;
    }

    try {
      const connectionString = EncryptionService.buildMssqlConnectionString(process.env);
      const encrypted = this.encryptionService.encrypt(connectionString);
      
      return {
        encrypted,
        hint: 'Add this to your .env file as: MSSQL_ENCRYPTED_CONNECTION=' + encrypted
      };
    } catch (err) {
      console.error('[MSSQL] Failed to encrypt connection string:', err.message);
      return null;
    }
  }

  /**
   * Get config object for Sequelize
   */
  getSequelizeConfig() {
    const connectionString = this.getConnectionString();
    const parsed = EncryptionService.parseConnectionString(connectionString);

    return {
      host: parsed['Server']?.split(',')[0] || 'localhost',
      port: parseInt(parsed['Server']?.split(',')[1] || '1433'),
      database: parsed['Database'] || process.env.MSSQL_DB || '',
      username: parsed['User Id'] || process.env.MSSQL_USER || '',
      password: parsed['Password'] || process.env.MSSQL_PASSWORD || '',
      dialect: 'mssql',
      encrypt: parsed['Encrypt'] === 'true',
      trustServerCertificate: parsed['TrustServerCertificate'] === 'true',
      dialectOptions: {
        options: {
          encrypt: parsed['Encrypt'] === 'true',
          trustServerCertificate: true,
          enableKeepAlive: true
        }
      },
      pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
      },
      logging: process.env.DEBUG_MODE === 'true' ? console.debug : false
    };
  }

  /**
   * Status report
   */
  getStatus() {
    return {
      encryptionEnabled: this.encryptionEnabled,
      usingEncryptedConnection: !!process.env.MSSQL_ENCRYPTED_CONNECTION,
      mssqlHost: process.env.MSSQL_HOST,
      mssqlDb: process.env.MSSQL_DB,
      message: this.encryptionEnabled 
        ? 'Connection string encryption is ENABLED' 
        : 'Connection string encryption is DISABLED (set MSSQL_ENCRYPTION_KEY to enable)'
    };
  }
}

module.exports = new MssqlSecureConfig();
