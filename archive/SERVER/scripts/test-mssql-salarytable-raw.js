require('dotenv').config();
const SalaryTable = require('../mssql/models/SalaryTable');
const { sequelize, enableMssql } = require('../mssql');

(async () => {
  try {
    if (!enableMssql) {
      console.log('MSSQL not enabled. Enable via ENABLE_MSSQL=true');
      process.exit(0);
    }
    if (!SalaryTable) {
      console.log('SalaryTable model not available');
      process.exit(1);
    }
    await sequelize.authenticate();
    const result = await SalaryTable.findAll({ limit: 5 });
    console.log('Rows:', result.length);
    console.log(JSON.stringify(result.map(r => r.toJSON()), null, 2));
  } catch (err) {
    console.error('Raw query failed:', err.stack || err.message || err);
    process.exit(1);
  }
})();
