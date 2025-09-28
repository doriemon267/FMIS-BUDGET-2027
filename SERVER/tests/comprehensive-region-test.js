/**
 * Comprehensive test to understand the actual Region filtering issue
 */
const mongoose = require('mongoose');

async function comprehensiveRegionTest() {
  try {
    await mongoose.connect('mongodb://172.16.4.98:27017/fmis_budget');
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    console.log('\n=== COMPREHENSIVE REGION FILTERING TEST ===');
    
    // Get all overtime records
    const allRecords = await db.collection('overtimepays').find({}).toArray();
    console.log(`\n📊 Total overtime records: ${allRecords.length}`);
    
    // Group by region
    const regionGroups = {};
    allRecords.forEach(record => {
      const region = record.region || 'UNKNOWN';
      if (!regionGroups[region]) {
        regionGroups[region] = [];
      }
      regionGroups[region].push(record);
    });
    
    console.log('\n📋 Records by Region:');
    Object.keys(regionGroups).forEach(region => {
      console.log(`\n${region}: ${regionGroups[region].length} records`);
      regionGroups[region].forEach((record, i) => {
        console.log(`  ${i+1}. ${record.employeeFullName}`);
        console.log(`     Dept: ${record.department || 'N/A'}`);
        console.log(`     Div: ${record.division || 'N/A'}`);
        console.log(`     Status: ${record.status || 'N/A'}`);
        console.log(`     OrigLevel: ${record.originalLevel || 'N/A'}`);
      });
    });
    
    // Test specific scenario: What would REGION I user see?
    console.log('\n\n🎯 TESTING REGION I USER FILTERING');
    const regionName = 'REGION I';
    
    const submissionFilters = {
      $and: [
        { region: regionName },
        {
          $or: [
            // Own region-level data (no department/division specified, any status)
            { 
              $and: [
                { region: regionName },
                { $or: [{ department: { $exists: false } }, { department: null }, { department: "" }, { department: "N/A" }] }
              ]
            },
            // Submitted department/division data within their region
            { 
              $and: [
                { $or: [
                  { department: { $exists: true, $ne: null, $ne: "", $ne: "N/A" } },
                  { division: { $exists: true, $ne: null, $ne: "", $ne: "N/A" } }
                ] },
                { region: regionName },
                { 
                  $or: [
                    { status: 'Submitted' },
                    { status: 'Approved' }
                  ]
                }
              ]
            }
          ]
        }
      ]
    };
    
    console.log('Filter being applied:');
    console.log(JSON.stringify(submissionFilters, null, 2));
    
    const regionIResults = await db.collection('overtimepays').find(submissionFilters).toArray();
    
    console.log(`\n📊 REGION I filter results: ${regionIResults.length} records`);
    regionIResults.forEach((record, i) => {
      console.log(`${i+1}. ${record.employeeFullName}`);
      console.log(`   Dept: ${record.department || 'N/A'}`);
      console.log(`   Div: ${record.division || 'N/A'}`);
      console.log(`   Status: ${record.status || 'N/A'}`);
      
      // Analyze why this record was included
      const hasNoDept = !record.department || record.department === null || record.department === "" || record.department === "N/A";
      const hasNoDiv = !record.division || record.division === null || record.division === "" || record.division === "N/A";
      const isSubmitted = record.status === 'Submitted' || record.status === 'Approved';
      
      if (hasNoDept && hasNoDiv) {
        console.log(`   ✅ CORRECT: Pure region data`);
      } else if (isSubmitted) {
        console.log(`   ✅ CORRECT: Has dept/div but is submitted`);
      } else {
        console.log(`   ❌ ERROR: Has dept/div but NOT submitted - should not show!`);
      }
    });
    
    // Also test what happens without submission workflow (simple region filter)
    console.log(`\n\n🧪 TESTING WITHOUT SUBMISSION WORKFLOW (simple region filter):`);
    const simpleResults = await db.collection('overtimepays').find({ region: regionName }).toArray();
    console.log(`Simple filter results: ${simpleResults.length} records`);
    
    if (simpleResults.length > regionIResults.length) {
      console.log(`❌ PROBLEM IDENTIFIED: Simple filter shows ${simpleResults.length} but submission filter shows ${regionIResults.length}`);
      console.log('This suggests the submission workflow is NOT being applied!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

comprehensiveRegionTest();