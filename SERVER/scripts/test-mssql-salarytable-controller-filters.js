require('dotenv').config();
const controller = require('../controllers/mssqlSalaryTableController');

const runTest = async (query) => {
  try {
    console.log('--- Query:', JSON.stringify(query));
    await controller.list({ query }, { json: x => console.log('RESP:', JSON.stringify(x, null, 2)), status: code => ({ _status: code }) });
  } catch (err) {
    console.error('Error running controller list:', err.stack || err.message || err);
  }
};

(async () => {
  await runTest({ limit: 5 });
  await runTest({ limit: 5, StatusOfAppointment: 'CASUAL' });
  await runTest({ limit: 5, SG: '25' });
  await runTest({ limit: 5, Source: 'SSL4.4' });
  await runTest({ limit: 5, EncodedBy: '294703' });
  await runTest({ limit: 5, MonthlyRate_min: '10000', MonthlyRate_max: '40000' });
  await runTest({ limit: 5, DailyRate_min: '1000' });
  await runTest({ limit: 5, sortField: 'SG', sortDir: 'DESC' });
  process.exit(0);
})();
