/**
 * Test script to update organizational information for a consolidation record
 * Usage: node update-org-info.js [consolidationId] [division] [department] [office] [isCentralOffice]
 */

require('dotenv').config();
const mongoose = require('mongoose');
const BRDConsolidation = require('./SERVER/models/BRDConsolidation');

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: node update-org-info.js [consolidationId] [division] [department] [office] [isCentralOffice]');
  console.log('\nExample:');
  console.log('  node update-org-info.js 66e8f8f8f8f8f8f8f8f8f8f8 "ADMINISTRATIVE AND FINANCE DIVISION" "HEAD OFFICE" "CO" true');
  console.log('  node update-org-info.js 66e8f8f8f8f8f8f8f8f8f8f8 "HUMAN RESOURCES DIVISION" "HR SERVICES" "REGIONAL" false');
  process.exit(1);
}

const consolidationId = args[0];
const division = args[1];
const department = args[2];
const office = args[3];
const isCentralOffice = args[4] ? args[4].toLowerCase() === 'true' : undefined;

(async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/fmis-db';
    console.log('Connecting to MongoDB:', mongoUri.replace(/:[^@]*@/, ':***@'));
    
    await mongoose.connect(mongoUri);
    console.log('✓ Connected to MongoDB');

    // Find the consolidation record
    console.log(`\nFetching consolidation record: ${consolidationId}`);
    let record = await BRDConsolidation.findById(consolidationId);
    
    if (!record) {
      console.error('✗ Consolidation record not found');
      process.exit(1);
    }

    console.log('\nCurrent values:');
    console.log(`  Region: ${record.region}`);
    console.log(`  Division: ${record.division}`);
    console.log(`  Department: ${record.department}`);
    console.log(`  Office: ${record.office || 'N/A'}`);
    console.log(`  IsCentralOffice: ${record.isCentralOffice}`);
    console.log(`  ConsolidationPath: ${record.consolidationPath}`);

    // Prepare update
    const updateData = {};
    if (division) {
      updateData.division = division;
      console.log(`  → Division: ${division}`);
    }
    if (department) {
      updateData.department = department;
      console.log(`  → Department: ${department}`);
    }
    if (office) {
      updateData.office = office;
      console.log(`  → Office: ${office}`);
    }
    if (isCentralOffice !== undefined) {
      updateData.isCentralOffice = isCentralOffice;
      console.log(`  → IsCentralOffice: ${isCentralOffice}`);
    }

    // Regenerate consolidation path if needed
    if (division || department || isCentralOffice !== undefined) {
      const newDivision = division || record.division;
      const newDepartment = department || record.department;
      const newCO = isCentralOffice !== undefined ? isCentralOffice : record.isCentralOffice;
      
      const newPath = newCO 
        ? `CentralOffice/${newDepartment}`
        : `${record.region}/${newDivision}`;
      
      updateData.consolidationPath = newPath;
      console.log(`  → ConsolidationPath: ${newPath}`);
    }

    console.log('\nUpdating record...');
    record = await BRDConsolidation.findByIdAndUpdate(
      consolidationId,
      updateData,
      { new: true, runValidators: true }
    );

    console.log('\n✓ Record updated successfully!');
    console.log('\nNew values:');
    console.log(`  Region: ${record.region}`);
    console.log(`  Division: ${record.division}`);
    console.log(`  Department: ${record.department}`);
    console.log(`  Office: ${record.office || 'N/A'}`);
    console.log(`  IsCentralOffice: ${record.isCentralOffice}`);
    console.log(`  ConsolidationPath: ${record.consolidationPath}`);

    process.exit(0);
  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  }
})();
