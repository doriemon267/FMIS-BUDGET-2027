/**
 * Quick script to test MSSQL connection using Sequelize
 * Run: node SERVER/scripts/test-mssql-connect.js
 */
require('dotenv').config();
const { sequelize, enableMssql } = require('../mssql');

(async function () {
  if (!enableMssql) {
    console.log('MSSQL disabled. Set ENABLE_MSSQL=true and configure env');
    process.exit(0);
  }
  try {
    console.log('Attempting to authenticate with MSSQL:', {
      host: process.env.MSSQL_HOST,
      port: process.env.MSSQL_PORT,
      instance: process.env.MSSQL_INSTANCE
    });
    await sequelize.authenticate();
    console.log('✅ MSSQL connection successful');
    process.exit(0);
  } catch (err) {
    console.error('❌ MSSQL connection failed:', err.message || err);
    console.error(err);
    process.exit(2);
  }
})();
