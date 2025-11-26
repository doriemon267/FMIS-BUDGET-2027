require('dotenv').config();
const axios = require('axios');

const base = process.env.API_BASE_URL || 'http://localhost:3000';
(async () => {
  try {
    const url = `${base}/api/mssql/salarytable?limit=3`;
    console.log('GET', url);
    const res = await axios.get(url);
    console.log('Response keys:', Object.keys(res.data));
    console.log('Count:', res.data.count);
    if (Array.isArray(res.data.data)) {
      console.log('Sample row keys:', Object.keys(res.data.data[0] || {}));
      console.log('Sample row data:', JSON.stringify(res.data.data[0], null, 2));
    } else {
      console.log('Received non-array data:', JSON.stringify(res.data, null, 2));
    }
  } catch (err) {
    console.error('Error calling SalaryTable:', (err.response && err.response.data) || err.message || err);
  }
})();
