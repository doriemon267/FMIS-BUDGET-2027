const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_BUDGET_URL).then(async () => {
  const collections = await mongoose.connection.db.listCollections().toArray();
  const targetAmounts = [400000, 29585619.90, 2810000, 686100000, 4300800, 18645200, 33980768];

  console.log('Searching for Capital Outlay target amounts in all DB collections...');

  for (const colInfo of collections) {
    const colName = colInfo.name;
    const col = mongoose.connection.collection(colName);
    
    // Find documents containing any of the target amounts
    const docs = await col.find({
      $or: [
        { total: { $in: targetAmounts } },
        { amount: { $in: targetAmounts } },
        { Total: { $in: targetAmounts } },
        { proposedBudget: { $in: targetAmounts } },
        { tier1: { $in: targetAmounts } },
        { tier2: { $in: targetAmounts } },
        { 'items.total': { $in: targetAmounts } },
        { 'items.amount': { $in: targetAmounts } },
      ]
    }).toArray();

    if (docs.length > 0) {
      console.log(`\nFOUND ${docs.length} matching docs in collection: [ ${colName} ]`);
      docs.forEach(d => {
        console.log({
          _id: d._id,
          fiscalYear: d.fiscalYear,
          region: d.region,
          department: d.department,
          division: d.division,
          title: d.title || d.sublineItem || d.category || d.name,
          amount: d.amount || d.total || d.Total || d.proposedBudget,
          keys: Object.keys(d)
        });
      });
    }
  }

  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
