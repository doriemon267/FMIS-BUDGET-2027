#!/usr/bin/env node
/**
 * workflowRefSanity.js
 * Quick sanity checker for workflowRef / proposalId linkage across line item getByParams endpoints.
 *
 * Usage: node SERVER/test-scripts/workflowRefSanity.js <workflowRef>
 * If workflowRef not provided, script will attempt to create a minimal proposal (requires auth cookie/JWT if server enforces auth).
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const APP_PORT = process.env.APP_PORT || 5005;
const BASE = `http://localhost:${APP_PORT}`;
const wfArg = process.argv[2];

// Optional: load token from env FILE .env or process.env.JWT_TOKEN
let token = process.env.JWT_TOKEN || null;
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, 'utf8');
    const match = raw.match(/JWT_TOKEN=(.+)/);
    if (match) token = match[1].trim();
  }
} catch (_) {}

const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

async function maybeCreateProposal() {
  if (wfArg) return wfArg;
  console.log('No workflowRef argument supplied; attempting creation of a minimal proposal...');
  try {
    const payload = {
      title: 'Sanity Test Proposal',
      description: 'Auto-created for workflowRef sanity test',
      projectedCorporateIncome: 1000,
      projectedSubsidy: 500,
      modelType: 'Initial',
      fiscalYear: new Date().getFullYear(),
      region: 'TEST_REGION'
    };
    const res = await axios.post(`${BASE}/api/allproposal/proposals`, payload, { headers: authHeaders });
    const wfId = res.data?.data?._id;
    if (!wfId) throw new Error('Proposal creation succeeded but _id missing');
    console.log('Created proposal workflowRef:', wfId);
    return wfId;
  } catch (e) {
    console.warn('Failed to auto-create proposal; provide workflowRef manually. Error:', e.message);
    return null;
  }
}

async function run() {
  const workflowRef = await maybeCreateProposal();
  if (!workflowRef) {
    console.error('Cannot proceed without a workflowRef. Exiting.');
    process.exit(1);
  }
  const endpoints = [
    { name: 'Income getByParams', url: `${BASE}/income/getByParams?proposalId=${workflowRef}` },
    { name: 'MOOE getByParams', url: `${BASE}/mooe/getByParams?proposalId=${workflowRef}` },
    { name: 'CapitalOutlay getByParams', url: `${BASE}/capital-outlay/getByParams?proposalId=${workflowRef}` },
    { name: 'PersonnelServices getByParams', url: `${BASE}/api/personnel/getByParams?proposalId=${workflowRef}` }
  ];
  const results = [];
  for (const ep of endpoints) {
    try {
      const res = await axios.get(ep.url, { headers: { ...authHeaders, 'X-Workflow-Ref': workflowRef } });
      const data = Array.isArray(res.data) ? res.data : (res.data?.data || res.data?.items || []);
      results.push({ endpoint: ep.name, status: res.status, count: Array.isArray(data) ? data.length : 'n/a' });
    } catch (e) {
      results.push({ endpoint: ep.name, status: e.response?.status || 'ERR', error: e.message });
    }
  }
  console.table(results);
  const failures = results.filter(r => r.status !== 200);
  if (failures.length) {
    console.log('\nFailures detected:');
    failures.forEach(f => console.log(` - ${f.endpoint}: ${f.status} ${f.error || ''}`));
    process.exitCode = 1;
  } else {
    console.log('\nAll endpoints responded with 200.');
  }
}
run();
