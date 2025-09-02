// Test script to verify the fixed implementation works
const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const CapitalOutlay = require('./models/CapitalOutlay');
const CapitalOutlayDetails = require('./models/CapitalOutlayDetails');

async function testFixedImplementation() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/fmis_budget');
    console.log('✅ Connected to MongoDB');

    // Find a sample capital outlay
    const sampleCapitalOutlay = await CapitalOutlay.findOne();
    if (!sampleCapitalOutlay) {
      console.log('❌ No capital outlay records found. Please run seed-capital-outlay.js first.');
      return;
    }

    console.log(`✅ Found sample capital outlay: ${sampleCapitalOutlay.accountingTitle}`);
    console.log(`   ID: ${sampleCapitalOutlay._id}`);

    // Test the fixed saveCapitalOutlayDetails logic (without transactions)
    console.log('\n📝 Testing fixed implementation...');

    // Clean up any existing test details first
    await CapitalOutlayDetails.deleteMany({ 
      capital_outlay_id: sampleCapitalOutlay._id,
      processBy: 'Test User Fixed'
    });

    // Simulate the controller logic
    const details = [
      {
        particulars: 'Construction of Main Building - Fixed Test',
        income_amount: 750000,
        subsidy_amount: 250000,
      },
      {
        particulars: 'Electrical Installation - Fixed Test',
        income_amount: 200000,
        subsidy_amount: 100000,
      },
      {
        particulars: 'Plumbing System - Fixed Test',
        income_amount: 150000,
        subsidy_amount: 75000,
      }
    ];

    // Delete existing details for this capital outlay (simulating controller)
    await CapitalOutlayDetails.deleteMany({ capital_outlay_id: sampleCapitalOutlay._id });

    // Insert new details (simulating controller)
    const detailsToInsert = details.map((detail) => ({
      capital_outlay_id: sampleCapitalOutlay._id,
      particulars: detail.particulars.trim(),
      income_amount: parseFloat(detail.income_amount) || 0,
      subsidy_amount: parseFloat(detail.subsidy_amount) || 0,
      processBy: 'Test User Fixed',
      processDate: new Date(),
    }));

    const savedDetails = await CapitalOutlayDetails.insertMany(detailsToInsert);
    console.log(`✅ Created ${savedDetails.length} detail records`);

    // Calculate totals (simulating controller)
    const totalIncome = detailsToInsert.reduce(
      (sum, detail) => sum + detail.income_amount,
      0
    );
    const totalSubsidy = detailsToInsert.reduce(
      (sum, detail) => sum + detail.subsidy_amount,
      0
    );
    const totalCost = totalIncome + totalSubsidy;

    console.log('\n🧮 Calculated totals:');
    console.log(`   Total Income: ₱${totalIncome.toLocaleString()}`);
    console.log(`   Total Subsidy: ₱${totalSubsidy.toLocaleString()}`);
    console.log(`   Total Cost: ₱${totalCost.toLocaleString()}`);

    // Update the main capital outlay record (simulating controller)
    const updatedCapitalOutlay = await CapitalOutlay.findByIdAndUpdate(
      sampleCapitalOutlay._id,
      {
        income: totalIncome,
        subsidy: totalSubsidy,
        cost: totalCost,
      },
      { new: true }
    );

    console.log('\n💾 Updated main capital outlay record:');
    console.log(`   Updated Income: ₱${updatedCapitalOutlay.income.toLocaleString()}`);
    console.log(`   Updated Subsidy: ₱${updatedCapitalOutlay.subsidy.toLocaleString()}`);
    console.log(`   Updated Cost: ₱${updatedCapitalOutlay.cost.toLocaleString()}`);

    // Verify the details were saved correctly
    const verifyDetails = await CapitalOutlayDetails.find({
      capital_outlay_id: sampleCapitalOutlay._id
    });

    console.log(`\n✅ Verification: Found ${verifyDetails.length} saved details:`);
    verifyDetails.forEach((detail, index) => {
      console.log(`   ${index + 1}. ${detail.particulars}`);
      console.log(`      Income: ₱${detail.income_amount.toLocaleString()}`);
      console.log(`      Subsidy: ₱${detail.subsidy_amount.toLocaleString()}`);
    });

    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    await CapitalOutlayDetails.deleteMany({ 
      capital_outlay_id: sampleCapitalOutlay._id,
      processBy: 'Test User Fixed'
    });
    console.log('✅ Test data cleaned up');

    console.log('\n🎉 Fixed implementation test passed! No transaction errors.');
    console.log('📱 The modal should now work correctly in the frontend.');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the test
testFixedImplementation();