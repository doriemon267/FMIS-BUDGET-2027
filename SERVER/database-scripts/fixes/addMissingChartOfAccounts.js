const mongoose = require('mongoose');
require('dotenv').config();

const ChartOfAccounts = require('./models/chartOfAccounts');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URL || 'mongodb://localhost:27017/budget-fmis')
  .then(() => {
    console.log('Connected to MongoDB');
    addMissingChartOfAccounts();
  })
  .catch(err => {
    console.error('Error connecting to MongoDB:', err);
    process.exit(1);
  });

async function addMissingChartOfAccounts() {
  try {
    console.log('Adding missing chart of accounts entries...\n');

    // Additional chart of accounts entries for missing subline items
    const missingEntries = [
      // Buildings and Other Structures (alternative naming)
      { sublineItem: "Buildings and Other Structures", accountingTitle: "Buildings", uacsCode: "5-01-02-010" },
      { sublineItem: "Buildings and Other Structures", accountingTitle: "School Buildings", uacsCode: "5-01-02-020" },
      { sublineItem: "Buildings and Other Structures", accountingTitle: "Hospitals and Health Centers", uacsCode: "5-01-02-030" },
      { sublineItem: "Buildings and Other Structures", accountingTitle: "Markets", uacsCode: "5-01-02-040" },
      { sublineItem: "Buildings and Other Structures", accountingTitle: "Slaughterhouses", uacsCode: "5-01-02-050" },
      { sublineItem: "Buildings and Other Structures", accountingTitle: "Hostels and Dormitories", uacsCode: "5-01-02-060" },
      { sublineItem: "Buildings and Other Structures", accountingTitle: "Other Structures", uacsCode: "5-01-02-990" },
      
      // Repairs and Maintenance
      { sublineItem: "Repairs and Maintenance", accountingTitle: "Repairs and Maintenance - Buildings and Other Structures", uacsCode: "5-02-13-010" },
      { sublineItem: "Repairs and Maintenance", accountingTitle: "Repairs and Maintenance - Machinery and Equipment", uacsCode: "5-02-13-020" },
      { sublineItem: "Repairs and Maintenance", accountingTitle: "Repairs and Maintenance - Transportation Equipment", uacsCode: "5-02-13-030" },
      { sublineItem: "Repairs and Maintenance", accountingTitle: "Repairs and Maintenance - Other Property, Plant and Equipment", uacsCode: "5-02-13-990" },
      
      // Machinery and Equipment (alternative naming)
      { sublineItem: "Machinery and Equipment", accountingTitle: "Office Equipment", uacsCode: "5-01-03-010" },
      { sublineItem: "Machinery and Equipment", accountingTitle: "Information and Communications Technology Equipment", uacsCode: "5-01-03-020" },
      { sublineItem: "Machinery and Equipment", accountingTitle: "Agricultural and Forestry Equipment", uacsCode: "5-01-03-030" },
      { sublineItem: "Machinery and Equipment", accountingTitle: "Military, Police and Security Equipment", uacsCode: "5-01-03-040" },
      { sublineItem: "Machinery and Equipment", accountingTitle: "Medical Equipment", uacsCode: "5-01-03-050" },
      { sublineItem: "Machinery and Equipment", accountingTitle: "Printing Equipment", uacsCode: "5-01-03-060" },
      { sublineItem: "Machinery and Equipment", accountingTitle: "Sports Equipment", uacsCode: "5-01-03-070" },
      { sublineItem: "Machinery and Equipment", accountingTitle: "Technical and Scientific Equipment", uacsCode: "5-01-03-080" },
      { sublineItem: "Machinery and Equipment", accountingTitle: "Other Machinery and Equipment", uacsCode: "5-01-03-990" },
      
      // Furniture Fixture and Books (alternative naming)
      { sublineItem: "Furniture Fixture and Books", accountingTitle: "Furniture and Fixtures", uacsCode: "5-01-05-010" },
      { sublineItem: "Furniture Fixture and Books", accountingTitle: "Books", uacsCode: "5-01-05-020" },
      
      // Land
      { sublineItem: "Land", accountingTitle: "Land", uacsCode: "5-01-06-010" },
      { sublineItem: "Land", accountingTitle: "Land Rights", uacsCode: "5-01-06-020" },
      
      // Land Improvements
      { sublineItem: "Land Improvements", accountingTitle: "Land Improvements", uacsCode: "5-01-07-010" },
      { sublineItem: "Land Improvements", accountingTitle: "Site Development", uacsCode: "5-01-07-020" },
      { sublineItem: "Land Improvements", accountingTitle: "Landscaping", uacsCode: "5-01-07-030" }
    ];

    let addedCount = 0;
    let skippedCount = 0;

    for (const entry of missingEntries) {
      // Check if this exact entry already exists
      const existing = await ChartOfAccounts.findOne({
        sublineItem: entry.sublineItem,
        accountingTitle: entry.accountingTitle,
        uacsCode: entry.uacsCode
      });

      if (existing) {
        console.log(`⏭️  Skipped: ${entry.sublineItem} - ${entry.accountingTitle} (already exists)`);
        skippedCount++;
      } else {
        await ChartOfAccounts.create(entry);
        console.log(`✅ Added: ${entry.sublineItem} - ${entry.accountingTitle} (${entry.uacsCode})`);
        addedCount++;
      }
    }

    console.log(`\n=== SUMMARY ===`);
    console.log(`Added: ${addedCount} new entries`);
    console.log(`Skipped: ${skippedCount} existing entries`);

    // Verify the results
    console.log('\n=== VERIFICATION ===');
    const testSublineItems = [
      "Land",
      "Land Improvements", 
      "Machinery and Equipment",
      "Buildings and Other Structures",
      "Repairs and Maintenance",
      "Furniture Fixture and Books"
    ];

    for (const sublineItem of testSublineItems) {
      const count = await ChartOfAccounts.countDocuments({ sublineItem });
      console.log(`${sublineItem}: ${count} accounting titles`);
    }

    mongoose.disconnect();
    console.log('\n✅ Missing chart of accounts entries have been added!');
  } catch (error) {
    console.error('❌ Error adding missing chart of accounts:', error);
    mongoose.disconnect();
    process.exit(1);
  }
}
