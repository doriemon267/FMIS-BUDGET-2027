require('dotenv').config();
const mongoose = require('mongoose');

const budgetUri = process.env.MONGODB_BUDGET_URL || process.env.MONGODB_URL;
const mainUri = process.env.MONGODB_MAIN_URL;

async function testUri(uri, name) {
  if (!uri) {
    console.log(`No URI provided for ${name}`);
    return;
  }
  console.log(`Testing ${name} at ${uri}`);
  try {
    const conn = await mongoose.createConnection(uri, { connectTimeoutMS: 5000 }).asPromise();
    console.log(`✅ Connected to ${name}`);
    await conn.close();
  } catch (err) {
    console.error(`❌ Failed to connect to ${name}:`, err.message || err);
  }
}

(async function () {
  await testUri(budgetUri, 'MONGODB_BUDGET_URL');
  await testUri(mainUri, 'MONGODB_MAIN_URL');
  process.exit(0);
})();
