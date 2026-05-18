const mongoose = require('mongoose');
const Income = require('./SERVER/models/Income');

async function debug() {
  try {
    await mongoose.connect('mongodb://superadmin:Today%404040@localhost:27017/fmis_budget?authSource=admin');
    
    const divisions = await Income.distinct('division', { fiscalYear: '2027' });
    const regions = await Income.distinct('region', { fiscalYear: '2027' });
    
    console.log('Distinct Divisions (2027):', divisions);
    console.log('Distinct Regions (2027):', regions);

    const counts = await Income.aggregate([
      { $match: { fiscalYear: '2027' } },
      { $group: { _id: { division: "$division", region: "$region" }, count: { $sum: 1 }, total: { $sum: "$amount" } } }
    ]);
    console.log('Counts and Totals by Div/Reg:', JSON.stringify(counts, null, 2));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

debug();
