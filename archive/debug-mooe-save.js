#!/usr/bin/env node
/**
 * Debug script to test MOOE save operations
 * Usage: node debug-mooe-save.js
 */

const fs = require('fs');
const path = require('path');

// Load .env manually
const envPath = path.join(__dirname, 'SERVER', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && !key.startsWith('#')) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
}

const mongoose = require('mongoose');
const MooeProposal = require('./SERVER/models/MooeProposal');
const Settings = require('./SERVER/models/Settings');

async function testMOOESave() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_BUDGET_URL);
    console.log('✓ Connected to MongoDB');

    // Get active settings
    const activeSettings = await Settings.findOne({ isActive: true });
    if (!activeSettings) {
      console.log('❌ No active settings found');
      return;
    }

    const fiscalYear = activeSettings.fiscalYear;
    const region = 'NATIONAL CAPITAL REGION'; // Change as needed

    console.log(`\nTesting MOOE save for FY ${fiscalYear}, Region: ${region}`);
    console.log('=' .repeat(80));

    // 1. Count existing MOOE entries before
    const beforeCount = await MooeProposal.countDocuments({
      fiscalYear,
      region
    });
    console.log(`\nBefore: ${beforeCount} MOOE entries for ${region}`);

    // 2. Check if there are draft entries
    const draftEntries = await MooeProposal.find({
      fiscalYear,
      region,
      status: 'Draft'
    }).limit(5).lean();

    console.log(`\nDraft entries found: ${draftEntries.length}`);
    if (draftEntries.length > 0) {
      console.log('\nSample draft entries:');
      draftEntries.forEach(entry => {
        console.log(`  - ${entry.accountingTitle} (UACS: ${entry.uacsCode})`);
        console.log(`    Income: ${entry.income}, Subsidy: ${entry.subsidy}`);
        console.log(`    ProposalId: ${entry.proposalId || 'NONE'}`);
        console.log(`    Status: ${entry.status}`);
      });
    }

    // 3. Check for entries with missing proposalId
    const noProposalId = await MooeProposal.countDocuments({
      fiscalYear,
      region,
      proposalId: { $exists: false }
    });
    console.log(`\n⚠️  Entries WITHOUT proposalId: ${noProposalId}`);

    // 4. Get sample data with proposalId
    const withProposalId = await MooeProposal.find({
      fiscalYear,
      region,
      proposalId: { $exists: true, $ne: null }
    }).select('accountingTitle uacsCode proposalId income subsidy status').limit(3).lean();

    console.log(`\nEntries WITH proposalId: ${withProposalId.length}`);
    if (withProposalId.length > 0) {
      console.log('Sample entries:');
      withProposalId.forEach(entry => {
        console.log(`  - ${entry.accountingTitle} (UACS: ${entry.uacsCode})`);
        console.log(`    ProposalId: ${entry.proposalId}`);
        console.log(`    Income: ${entry.income}, Subsidy: ${entry.subsidy}`);
        console.log(`    Status: ${entry.status}`);
      });
    }

    // 5. Check collection info
    const stats = await MooeProposal.collection.stats();
    console.log(`\n📊 MooeProposal Collection Stats:`);
    console.log(`   Total documents: ${stats.count}`);
    console.log(`   Avg object size: ${Math.round(stats.avgObjSize)} bytes`);

    // 6. Simulate a save operation to check for errors
    console.log(`\n🧪 Testing sample upsert operation...`);
    const testResult = await MooeProposal.updateOne(
      {
        uacsCode: '5020102000',
        fiscalYear,
        region,
        proposalId: { $exists: false }
      },
      {
        $set: {
          accountingTitle: 'TEST ENTRY',
          income: 100,
          subsidy: 50,
          status: 'Draft',
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );

    console.log(`   Result: ${testResult.matchedCount} matched, ${testResult.upsertedCount} upserted, ${testResult.modifiedCount} modified`);

    // 7. Verify the test entry was saved
    const testEntry = await MooeProposal.findOne({
      accountingTitle: 'TEST ENTRY'
    }).lean();

    if (testEntry) {
      console.log(`   ✓ Test entry confirmed in database`);
      console.log(`     Id: ${testEntry._id}`);
      console.log(`     Income: ${testEntry.income}, Subsidy: ${testEntry.subsidy}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('✓ Debug test completed');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  } finally {
    await mongoose.disconnect();
  }
}

testMOOESave();
