require('dotenv').config();
const { validateSniConfig, sequelize, enableMssql } = require('../mssql');
(async () => {
  try {
    if (!enableMssql) {
      console.log('MSSQL disabled. Set ENABLE_MSSQL=true to enable connection');
      process.exit(0);
    }
    try {
      validateSniConfig();
      console.log('SNI config is valid.');
    } catch (err) {
      console.error('SNI validation failed:', err.message);
      process.exit(2);
    }
    // Also optionally test connection
    try {
      await sequelize.authenticate();
      console.log('MSSQL connection OK.');
      process.exit(0);
    } catch (errConn) {
      console.error('MSSQL connection failed:', errConn.message);
      process.exit(3);
    }
  } catch (e) {
    console.error('Failed to run SNI check:', e.message);
    process.exit(1);
  }
})();
