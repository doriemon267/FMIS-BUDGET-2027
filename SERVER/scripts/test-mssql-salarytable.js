// Simple test script to call the MSSQL SalaryTable endpoints
require('dotenv').config();
const axios = require('axios');

const port = process.env.PORT || 5005;
const baseUrl = process.env.SERVER_URL || `http://localhost:${port}`;
const token = process.env.AUTH_TOKEN || '';
const devUserId = process.env.DEV_USER_ID || '';

const headers = token ? { Authorization: `Bearer ${token}` } : {};
if (devUserId) headers['X-Dev-User-Id'] = devUserId;
const client = axios.create({ baseURL: baseUrl, timeout: 30000, headers });

async function run() {
  try {
    console.log('[Test] Calling list endpoint...');
    const listRes = await client.get('/api/mssql/salarytable');
    console.log('[Test] list status:', listRes.status, 'count:', listRes.data?.count);
    console.log(JSON.stringify(listRes.data?.data?.slice(0, 3), null, 2));

    if (listRes.data?.data?.length > 0) {
      const id = listRes.data.data[0].Id || listRes.data.data[0].id || listRes.data.data[0].ID;
      if (id) {
        console.log('[Test] Fetching single by id', id);
        const single = await client.get(`/api/mssql/salarytable/${id}`);
        console.log('[Test] single status:', single.status);
        console.log(JSON.stringify(single.data?.data, null, 2));
      } else {
        console.log('[Test] no id field found in first row');
      }
    }
  } catch (err) {
    if (err.response) {
      console.error('[Test] Request failed:', err.response.status, err.response.data);
    } else {
      console.error('[Test] Error:', err.message || err);
    }
    process.exit(1);
  }
}

run().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
