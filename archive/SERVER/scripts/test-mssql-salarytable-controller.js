require('dotenv').config();
const controller = require('../controllers/mssqlSalaryTableController');
const SalaryTable = require('../mssql/models/SalaryTable');

(async () => {
  try {
    console.log('Testing controller.list directly...');
    const req = { query: { limit: 5 } };
    const res = {
      json: (x) => { console.log('RES JSON:', JSON.stringify(x, null, 2)); },
      status: function (code) { this._status = code; return this; }
    };
    await controller.list(req, res);
  } catch (err) {
    console.error('Controller invocation failed:', err.stack || err.message || err);
    process.exit(1);
  }
})();
