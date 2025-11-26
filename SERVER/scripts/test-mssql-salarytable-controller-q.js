require('dotenv').config();
const controller = require('../controllers/mssqlSalaryTableController');
const SalaryTable = require('../mssql/models/SalaryTable');

(async () => {
  try {
    console.log('Test controller list with q empty');
    await controller.list({ query: { limit: 5 } }, { json: x => console.log('RES1', JSON.stringify(x, null, 2)), status: function(c) { this._status = c; return this; } });
    console.log('Test controller list with q=c');
    await controller.list({ query: { limit: 5, q: 'c' } }, { json: x => console.log('RES2', JSON.stringify(x, null, 2)), status: function(c) { this._status = c; return this; } });
    console.log('Test controller list with q=25');
    await controller.list({ query: { limit: 5, q: '25' } }, { json: x => console.log('RES3', JSON.stringify(x, null, 2)), status: function(c) { this._status = c; return this; } });
    process.exit(0);
  } catch (err) {
    console.error('Controller invocation failed:', err.stack || err.message || err);
    process.exit(1);
  }
})();
