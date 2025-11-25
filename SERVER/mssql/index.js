/**
 * MSSQL (Sequelize) initialization
 * - Uses environment variables to configure connection
 * - Exposes sequelize instance and DataTypes
 * - Safe to require even if MSSQL not configured (fail-open)
 */
const { Sequelize, DataTypes } = require('sequelize');

const enableMssql = (process.env.ENABLE_MSSQL === 'true') || !!process.env.MSSQL_HOST;

let sequelize = null;
if (enableMssql) {
  const dialectOptions = {};
  // If using Azure or encrypted connections
  if (process.env.MSSQL_ENCRYPT === 'true' || process.env.MSSQL_ENCRYPT === '1') {
    dialectOptions.options = { encrypt: true };
  }

  sequelize = new Sequelize(process.env.MSSQL_DB || process.env.MSSQL_DATABASE || '', process.env.MSSQL_USER || process.env.MSSQL_USERNAME || '', process.env.MSSQL_PASSWORD || '', {
    host: process.env.MSSQL_HOST || 'localhost',
    port: process.env.MSSQL_PORT ? Number(process.env.MSSQL_PORT) : 1433,
    dialect: 'mssql',
    dialectOptions,
    logging: process.env.DEBUG_MODE === 'true' ? console.debug : false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    define: {
      timestamps: false,
      freezeTableName: true
    }
  });

  (async () => {
    try {
      await sequelize.authenticate();
      console.log('[MSSQL] Connected to MSSQL');
    } catch (err) {
      console.warn('[MSSQL] Connection failed:', err.message);
    }
  })();
}

module.exports = { sequelize, DataTypes, enableMssql };
