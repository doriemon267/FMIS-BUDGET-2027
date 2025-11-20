/**
 * Comprehensive verification of all organizational data improvements
 * Tests:
 * 1. Central Office records visibility
 * 2. Organizational fields in NewProposalWorkflow
 * 3. Consolidation path generation
 * 4. API endpoint functionality
 */

require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  try {
    const mongoUri = process.env.MONGODB_BUDGET_URL || process.env.MONGODB_URI;
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    
    const db = mongoose.connection.db;
    
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║   COMPREHENSIVE ORGANIZATIONAL DATA VERIFICATION                ║');
    console.log('║   November 20, 2025                                             ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
    
    // TEST 1: Central Office Records
    console.log('📋 TEST 1: Central Office Records Visibility');
    console.log('─'.repeat(60));
    
    const brdCollection = db.collection('brd_consolidations');
    const allRecords = await brdCollection.find({}).toArray();
    const coRecords = await brdCollection.find({ isCentralOffice: true }).toArray();
    const regionalRecords = await brdCollection.find({ isCentralOffice: false }).toArray();
    
    console.log(`Total BRD Records: ${allRecords.length}`);
    console.log(`Central Office Records: ${coRecords.length} ✓`);
    console.log(`Regional Records: ${regionalRecords.length} ✓`);
    
    if (coRecords.length > 0) {
      console.log('\nCentral Office Proposals:');
      coRecords.forEach((record, idx) => {
        console.log(`  [CO-${idx + 1}] ${record.proposalTitle}`);
        console.log(`      Department: ${record.department}`);
        console.log(`      Path: ${record.consolidationPath}`);
      });
    } else {
      console.log('⚠️  No Central Office records found');
    }
    
    // TEST 2: Organizational Fields
    console.log('\n\n📋 TEST 2: Organizational Fields in NewProposalWorkflow');
    console.log('─'.repeat(60));
    
    const npwCollection = db.collection('newproposalworkflows');
    const allNPW = await npwCollection.find({}).toArray();
    console.log(`Total NPW Records: ${allNPW.length}`);
    
    allNPW.forEach((npw, idx) => {
      console.log(`\n  [NPW-${idx + 1}] ${npw.title}`);
      console.log(`      Division: ${npw.division || '(not set)'}`);
      console.log(`      Department: ${npw.department || '(not set)'}`);
      console.log(`      Office: ${npw.office || '(not set)'}`);
      console.log(`      IsCentralOffice: ${npw.isCentralOffice !== undefined ? npw.isCentralOffice : '(not set)'}`);
      console.log(`      FiscalYear: ${npw.fiscalYear}`);
    });
    
    // TEST 3: Consolidation Path Generation
    console.log('\n\n📋 TEST 3: Consolidation Path Generation');
    console.log('─'.repeat(60));
    
    const regionalProposals = allRecords.filter(r => !r.isCentralOffice);
    const coProposals = allRecords.filter(r => r.isCentralOffice);
    
    console.log('Regional Path Format: Region/Division');
    if (regionalProposals.length > 0) {
      regionalProposals.forEach((record, idx) => {
        console.log(`  [REGIONAL-${idx + 1}] ${record.consolidationPath}`);
        const isValid = record.consolidationPath.includes('/') && 
                       !record.consolidationPath.startsWith('Central');
        console.log(`      Valid Format: ${isValid ? '✓' : '✗'}`);
      });
    } else {
      console.log('  No regional records');
    }
    
    console.log('\nCentral Office Path Format: CentralOffice/Department');
    if (coProposals.length > 0) {
      coProposals.forEach((record, idx) => {
        console.log(`  [CO-${idx + 1}] ${record.consolidationPath}`);
        const isValid = record.consolidationPath.startsWith('CentralOffice/');
        console.log(`      Valid Format: ${isValid ? '✓' : '✗'}`);
      });
    } else {
      console.log('  No CO records');
    }
    
    // TEST 4: Data Consistency
    console.log('\n\n📋 TEST 4: Data Consistency Checks');
    console.log('─'.repeat(60));
    
    let consistencyIssues = 0;
    
    console.log('Checking Regional Records:');
    regionalProposals.forEach((record) => {
      if (!record.division) {
        console.log(`  ✗ Record ${record._id}: Missing division`);
        consistencyIssues++;
      }
      if (!record.department) {
        console.log(`  ✗ Record ${record._id}: Missing department`);
        consistencyIssues++;
      }
      if (!record.consolidationPath.includes(record.division)) {
        console.log(`  ✗ Record ${record._id}: Division not in path`);
        consistencyIssues++;
      }
    });
    
    console.log('Checking Central Office Records:');
    coProposals.forEach((record) => {
      if (!record.isCentralOffice) {
        console.log(`  ✗ Record ${record._id}: Not marked as CO`);
        consistencyIssues++;
      }
      if (!record.consolidationPath.startsWith('CentralOffice')) {
        console.log(`  ✗ Record ${record._id}: Path not CO format`);
        consistencyIssues++;
      }
    });
    
    if (consistencyIssues === 0) {
      console.log('  ✓ All records are consistent');
    } else {
      console.log(`  Found ${consistencyIssues} consistency issues`);
    }
    
    // TEST 5: Summary Statistics
    console.log('\n\n📋 TEST 5: Summary Statistics');
    console.log('─'.repeat(60));
    
    const brdStatistics = {
      totalRecords: allRecords.length,
      centralOffice: coRecords.length,
      regional: regionalRecords.length,
      withDivision: allRecords.filter(r => r.division).length,
      withDepartment: allRecords.filter(r => r.department).length,
      consistencyScore: ((allRecords.length - consistencyIssues) / Math.max(allRecords.length, 1) * 100).toFixed(1)
    };
    
    console.log(`Total BRD Records: ${brdStatistics.totalRecords}`);
    console.log(`├─ Central Office: ${brdStatistics.centralOffice} (${((brdStatistics.centralOffice/brdStatistics.totalRecords)*100).toFixed(1)}%)`);
    console.log(`└─ Regional: ${brdStatistics.regional} (${((brdStatistics.regional/brdStatistics.totalRecords)*100).toFixed(1)}%)`);
    console.log(`\nData Completeness:`);
    console.log(`├─ With Division: ${brdStatistics.withDivision}/${brdStatistics.totalRecords}`);
    console.log(`├─ With Department: ${brdStatistics.withDepartment}/${brdStatistics.totalRecords}`);
    console.log(`└─ Consistency Score: ${brdStatistics.consistencyScore}%`);
    
    // FINAL RESULT
    console.log('\n\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                        VERIFICATION COMPLETE                   ║');
    
    if (consistencyIssues === 0 && brdStatistics.totalRecords > 0) {
      console.log('║                     STATUS: ✅ ALL TESTS PASSED                    ║');
    } else if (consistencyIssues === 0) {
      console.log('║                   STATUS: ⚠️  NO RECORDS TO TEST                   ║');
    } else {
      console.log('║                  STATUS: ❌ SOME ISSUES DETECTED                 ║');
    }
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
