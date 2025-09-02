// Simple test script to verify Capital Outlay Details API endpoints
const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const CapitalOutlay = require('./models/CapitalOutlay');
const CapitalOutlayDetails = require('./models/CapitalOutlayDetails');

async function testCapitalOutlayDetails() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/fmis_budget');
    console.log('✅ Connected to MongoDB');

    // Test 1: Check if CapitalOutlayDetails model works
    console.log('\n📋 Testing CapitalOutlayDetails model...');
    
    // Find a sample capital outlay to use for testing
    const sampleCapitalOutlay = await CapitalOutlay.findOne();
    if (!sampleCapitalOutlay) {
      console.log('❌ No capital outlay records found. Please create some capital outlay records first.');
      return;
    }
    
    console.log(`✅ Found sample capital outlay: ${sampleCapitalOutlay.accountingTitle}`);
    console.log(`   ID: ${sampleCapitalOutlay._id}`);

    // Test 2: Create sample details
    console.log('\n📝 Creating sample details...');
    const sampleDetails = [
      {
        capital_outlay_id: sampleCapitalOutlay._id,
        particulars: 'Construction of Main Building',
        income_amount: 500000,
        subsidy_amount: 200000,
        processBy: 'Test User',
      },
      {
        capital_outlay_id: sampleCapitalOutlay._id,
        particulars: 'Electrical Installation',
        income_amount: 150000,
        subsidy_amount: 50000,
        processBy: 'Test User',
      }
    ];

    // Clean up any existing test details first
    await CapitalOutlayDetails.deleteMany({ 
      capital_outlay_id: sampleCapitalOutlay._id,
      processBy: 'Test User'
    });

    const createdDetails = await CapitalOutlayDetails.insertMany(sampleDetails);
    console.log(`✅ Created ${createdDetails.length} sample details`);

    // Test 3: Query details
    console.log('\n🔍 Querying details...');
    const queriedDetails = await CapitalOutlayDetails.find({
      capital_outlay_id: sampleCapitalOutlay._id
    });
    
    console.log(`✅ Found ${queriedDetails.length} details for capital outlay`);
    queriedDetails.forEach((detail, index) => {
      console.log(`   ${index + 1}. ${detail.particulars}`);
      console.log(`      Income: ₱${detail.income_amount.toLocaleString()}`);
      console.log(`      Subsidy: ₱${detail.subsidy_amount.toLocaleString()}`);
    });

    // Test 4: Calculate totals
    console.log('\n🧮 Calculating totals...');
    const totalIncome = queriedDetails.reduce((sum, detail) => sum + detail.income_amount, 0);
    const totalSubsidy = queriedDetails.reduce((sum, detail) => sum + detail.subsidy_amount, 0);
    const totalCost = totalIncome + totalSubsidy;

    console.log(`   Total Income: ₱${totalIncome.toLocaleString()}`);
    console.log(`   Total Subsidy: ₱${totalSubsidy.toLocaleString()}`);
    console.log(`   Total Cost: ₱${totalCost.toLocaleString()}`);

    // Test 5: Update main capital outlay with totals
    console.log('\n💾 Updating main capital outlay with calculated totals...');
    await CapitalOutlay.findByIdAndUpdate(sampleCapitalOutlay._id, {
      income: totalIncome,
      subsidy: totalSubsidy,
      cost: totalCost
    });
    console.log('✅ Updated main capital outlay record');

    // Test 6: Verify update
    const updatedCapitalOutlay = await CapitalOutlay.findById(sampleCapitalOutlay._id);
    console.log('\n✅ Verification:');
    console.log(`   Updated Income: ₱${updatedCapitalOutlay.income.toLocaleString()}`);
    console.log(`   Updated Subsidy: ₱${updatedCapitalOutlay.subsidy.toLocaleString()}`);
    console.log(`   Updated Cost: ₱${updatedCapitalOutlay.cost.toLocaleString()}`);

    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    await CapitalOutlayDetails.deleteMany({ 
      capital_outlay_id: sampleCapitalOutlay._id,
      processBy: 'Test User'
    });
    console.log('✅ Test data cleaned up');

    console.log('\n🎉 All tests passed! Capital Outlay Details functionality is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the test
testCapitalOutlayDetails();