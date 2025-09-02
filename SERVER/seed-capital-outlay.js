// Seed script to create sample Capital Outlay records for testing
const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const CapitalOutlay = require('./models/CapitalOutlay');
const Category = require('./models/Category');

async function seedCapitalOutlay() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/fmis_budget');
    console.log('✅ Connected to MongoDB');

    // Check if categories exist, if not create some
    let category = await Category.findOne({ categoryName: 'Capital Outlay' });
    if (!category) {
      console.log('📁 Creating Capital Outlay category...');
      category = await Category.create({
        categoryName: 'Capital Outlay',
        description: 'Capital expenditures for infrastructure and equipment'
      });
      console.log('✅ Created Capital Outlay category');
    }

    // Sample capital outlay records
    const sampleCapitalOutlays = [
      {
        sublineItem: '5020301001',
        accountingTitle: 'Building & Structures Outlay',
        uacsCode: '5020301001',
        particulars: 'Construction and renovation of government buildings',
        income: 0,
        subsidy: 0,
        cost: 0,
        category: category._id,
        region: 'REGION I',
        fiscalYear: '2024',
        budgetType: 'Regular',
        status: 'Draft',
        processBy: 'System Admin',
        processDate: new Date()
      },
      {
        sublineItem: '5020301002',
        accountingTitle: 'Machinery & Equipment Outlay',
        uacsCode: '5020301002',
        particulars: 'Purchase of office equipment and machinery',
        income: 0,
        subsidy: 0,
        cost: 0,
        category: category._id,
        region: 'REGION I',
        fiscalYear: '2024',
        budgetType: 'Regular',
        status: 'Draft',
        processBy: 'System Admin',
        processDate: new Date()
      },
      {
        sublineItem: '5020301003',
        accountingTitle: 'Transportation Equipment Outlay',
        uacsCode: '5020301003',
        particulars: 'Purchase of vehicles and transportation equipment',
        income: 0,
        subsidy: 0,
        cost: 0,
        category: category._id,
        region: 'REGION I',
        fiscalYear: '2024',
        budgetType: 'Regular',
        status: 'Draft',
        processBy: 'System Admin',
        processDate: new Date()
      },
      {
        sublineItem: '5020301004',
        accountingTitle: 'Furniture & Fixtures Outlay',
        uacsCode: '5020301004',
        particulars: 'Purchase of office furniture and fixtures',
        income: 0,
        subsidy: 0,
        cost: 0,
        category: category._id,
        region: 'REGION I',
        fiscalYear: '2024',
        budgetType: 'Regular',
        status: 'Draft',
        processBy: 'System Admin',
        processDate: new Date()
      }
    ];

    // Clean up existing records first
    await CapitalOutlay.deleteMany({ processBy: 'System Admin' });
    console.log('🧹 Cleaned up existing sample records');

    // Insert sample records
    const createdRecords = await CapitalOutlay.insertMany(sampleCapitalOutlays);
    console.log(`✅ Created ${createdRecords.length} sample capital outlay records:`);
    
    createdRecords.forEach((record, index) => {
      console.log(`   ${index + 1}. ${record.accountingTitle} (ID: ${record._id})`);
    });

    console.log('\n🎉 Sample data created successfully!');
    console.log('You can now test the Capital Outlay Details modal functionality.');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the seed script
seedCapitalOutlay();