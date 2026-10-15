const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function run() {
  try {
    await mongoose.connect('mongodb://172.16.4.98:27017/fmis_budget');
    console.log('Connected to MongoDB');

    const CapitalOutlay = require('./models/capitalOutlay');

    // Find duplicates based on the index that failed:
    // proposalId, uacsCode, region, department, fiscalYear, sublineItem, category
    
    const duplicates = await CapitalOutlay.aggregate([
      {
        $match: {
          proposalId: { $exists: true, $ne: null },
          uacsCode: { $exists: true, $ne: null },
          region: { $exists: true, $ne: null },
          department: { $exists: true, $ne: null },
          fiscalYear: { $exists: true, $ne: null },
          sublineItem: { $exists: true, $ne: null },
          category: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: {
            proposalId: "$proposalId",
            uacsCode: "$uacsCode",
            region: "$region",
            department: "$department",
            fiscalYear: "$fiscalYear",
            sublineItem: "$sublineItem",
            category: "$category"
          },
          count: { $sum: 1 },
          docs: { $push: "$_id" }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]);

    console.log(`Found ${duplicates.length} duplicate groups.`);

    let totalDeleted = 0;

    for (const group of duplicates) {
      console.log(`Duplicate group found for uacsCode: ${group._id.uacsCode}, sublineItem: ${group._id.sublineItem}. Total records: ${group.count}`);
      
      // We keep the last updated one just in case, so we sort them first
      const records = await CapitalOutlay.find({ _id: { $in: group.docs } }).sort({ updatedAt: -1 });
      
      const docsToDelete = records.slice(1).map(r => r._id); // Keep the first element (most recently updated), delete the rest
      
      const res = await CapitalOutlay.deleteMany({ _id: { $in: docsToDelete } });
      totalDeleted += res.deletedCount;
      console.log(`Deleted ${res.deletedCount} duplicate records.`);
    }

    console.log(`Done. Total deleted records: ${totalDeleted}`);
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
