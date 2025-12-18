require('dotenv').config();
const axios = require('axios');
const yargs = require('yargs');

const argv = yargs(process.argv.slice(2))
  .option('base', { type: 'string', default: process.env.API_BASE_URL || 'http://localhost:3000', description: 'API base URL' })
  .option('dev-user', { type: 'string', default: process.env.DEV_USER_ID || '00000000-0000-0000-0000-000000000000', description: 'X-Dev-User-Id header for mock auth' })
  .help()
  .argv;

(async () => {
  try {
    const url = `${argv.base.replace(/\/$/, '')}/api/mssql/salarytable?limit=3`;
    console.log('GET', url);
    const res = await axios.get(url, { headers: { 'X-Dev-User-Id': argv['dev-user'] } });
    console.log('Response keys:', Object.keys(res.data || {}));
    console.log('Count:', res.data.count);
    if (Array.isArray(res.data.data) && res.data.data.length > 0) {
      console.log('Sample row keys:', Object.keys(res.data.data[0] || {}));
      console.log('Sample row data:', JSON.stringify(res.data.data[0], null, 2));
    } else {
      console.log('Received non-array or empty data:', JSON.stringify(res.data, null, 2));
    }
  } catch (err) {
    console.error('Error calling SalaryTable:', (err.response && err.response.data) || err.message || err);
  }
})();
