const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_BUDGET_URL).then(async () => {
  const Proposal = mongoose.connection.collection('proposals');
  const proposals = await Proposal.find().toArray();
  console.log('Proposals count:', proposals.length);

  proposals.forEach(p => {
    console.log(`\nProposal: ${p.title} | FY: ${p.fiscalYear} | Region: ${p.region} | Dept: ${p.department}`);
    console.log('  PCI:', p.projectedCorporateIncome, '| Subsidy:', p.projectedSubsidy, '| Budget:', p.proposedBudget);
    console.log('  TotalExp:', p.totalExpenses, '| TotalInc:', p.totalIncome);
    console.log('  CategoryBreakdown:', JSON.stringify(p.categoryBreakdown));
  });

  const CODetails = mongoose.connection.collection('capitaloutlaydetails');
  const codCount = await CODetails.countDocuments();
  console.log('\nCapitalOutlayDetails count:', codCount);
  if (codCount > 0) {
    const cods = await CODetails.find().toArray();
    cods.forEach(c => {
      console.log('COD doc:', c);
    });
  }

  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
