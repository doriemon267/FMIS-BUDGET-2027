const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_BUDGET_URL).then(async () => {
  const CO = mongoose.connection.collection('capitaloutlays');
  const COD = mongoose.connection.collection('capitaloutlaydetails');

  const coDocs = await CO.find().toArray();
  const codDocs = await COD.find().toArray();

  console.log('--- ALL CAPITAL OUTLAY DOCUMENTS ---');
  coDocs.forEach(c => {
    console.log({
      _id: c._id,
      fiscalYear: c.fiscalYear,
      region: c.region,
      department: c.department,
      division: c.division,
      sublineItem: c.sublineItem,
      category: c.category,
      uacsCode: c.uacsCode,
      amount: c.amount,
      total: c.total
    });
  });

  console.log('\n--- ALL CAPITAL OUTLAY DETAILS ---');
  codDocs.forEach(d => {
    console.log({
      _id: d._id,
      capital_outlay_id: d.capital_outlay_id,
      particulars: d.particulars,
      subsidy_amount: d.subsidy_amount,
      income_amount: d.income_amount
    });
  });

  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
