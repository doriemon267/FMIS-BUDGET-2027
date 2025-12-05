require('dotenv').config();
const mongoose = require('mongoose');
const PersonnelServices = require('./models/PersonnelServices');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGODB_BUDGET_URL);
    
    const charged = await PersonnelServices.find({ chargedToIncomeEligible: true })
      .select('Total chargedToIncomeAmount')
      .lean();
    
    if (charged.length > 0) {
      console.log('Sample charged-to-income records:');
      charged.slice(0, 5).forEach((r, i) => {
        console.log('[' + i + '] Total: ' + r.Total + ', Charged: ' + r.chargedToIncomeAmount);
      });
      
      const allChargedSum = charged.reduce((sum, r) => sum + (r.chargedToIncomeAmount || 0), 0);
      const allTotalSum = charged.reduce((sum, r) => sum + (r.Total || 0), 0);
      
      console.log('\nTotal records: ' + charged.length);
      console.log('Sum of all chargedToIncomeAmount: ' + allChargedSum.toFixed(2));
      console.log('Sum of all Total: ' + allTotalSum.toFixed(2));
      console.log('Difference (should be in totalExpenses): ' + (allTotalSum - allChargedSum).toFixed(2));
    }
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
  }
})();
