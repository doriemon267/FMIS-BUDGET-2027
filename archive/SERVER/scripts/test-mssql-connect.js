/**
 * Quick script to test MSSQL connection using Sequelize
 * Run: node SERVER/scripts/test-mssql-connect.js
 */
// Load .env before setting suppression
require('dotenv').config();
// Apply deprecation suppression if requested (same logic as server index.js)
const SUPPRESS_NODE_DEPRECATION_WARNINGS = (process.env.SUPPRESS_NODE_DEPRECATION_WARNINGS || '').split(',').map(s => s && s.trim()).filter(Boolean);
if (SUPPRESS_NODE_DEPRECATION_WARNINGS.length > 0) {
  const origEmitWarning = process.emitWarning;
  process.emitWarning = function(warning, options) {
    try {
      let code = undefined;
      if (options && typeof options === 'string') {
        code = options;
      } else if (options && typeof options === 'object') {
        code = options.code || options.name;
      } else if (warning && typeof warning === 'object') {
        code = warning.code || warning.name;
      }
      if (code && SUPPRESS_NODE_DEPRECATION_WARNINGS.includes(code)) {
        return;
      }
    } catch (e) {
      /* ignore errors */
    }
    return origEmitWarning.apply(process, arguments);
  };
}
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
