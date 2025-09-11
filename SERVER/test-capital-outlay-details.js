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
    // Test 1: Check if CapitalOutlayDetails model works
    // Find a sample capital outlay to use for testing
    const sampleCapitalOutlay = await CapitalOutlay.findOne();
    if (!sampleCapitalOutlay) {
      return;
    }
    // Test 2: Create sample details
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
    // Test 3: Query details
    const queriedDetails = await CapitalOutlayDetails.find({
      capital_outlay_id: sampleCapitalOutlay._id
    });
    queriedDetails.forEach((detail, index) => {
      }`);
      }`);
    });
    // Test 4: Calculate totals
    const totalIncome = queriedDetails.reduce((sum, detail) => sum + detail.income_amount, 0);
    const totalSubsidy = queriedDetails.reduce((sum, detail) => sum + detail.subsidy_amount, 0);
    const totalCost = totalIncome + totalSubsidy;
    }`);
    }`);
    }`);
    // Test 5: Update main capital outlay with totals
    await CapitalOutlay.findByIdAndUpdate(sampleCapitalOutlay._id, {
      income: totalIncome,
      subsidy: totalSubsidy,
      cost: totalCost
    });
    // Test 6: Verify update
    const updatedCapitalOutlay = await CapitalOutlay.findById(sampleCapitalOutlay._id);
    }`);
    }`);
    }`);
    // Clean up test data
    await CapitalOutlayDetails.deleteMany({ 
      capital_outlay_id: sampleCapitalOutlay._id,
      processBy: 'Test User'
    });
    } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    }
}
// Run the test
testCapitalOutlayDetails();