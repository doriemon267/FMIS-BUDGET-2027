require('dotenv').config();
const mongoose = require('mongoose');
const PersonnelServices = require('./models/PersonnelServices');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGODB_BUDGET_URL);
    
    console.log('=== FIXING ALL PERSONNEL TO FULL CHARGED-TO-INCOME ===\n');
    
    // Get ALL personnel for this proposal (charged or not)
    const allPersonnel = await PersonnelServices.find({ fiscalYear: '2026', budgetType: 'Initial', region: 'CENTRAL OFFICE' });
    
    console.log('Found ' + allPersonnel.length + ' total personnel');
    
    let totalBefore = 0;
    let totalAfter = 0;
    
    for (const personnel of allPersonnel) {
      const fullAmount = personnel.Total;
      const oldChargedAmount = personnel.chargedToIncomeAmount || 0;
      
      await PersonnelServices.findByIdAndUpdate(personnel._id, {
        $set: {
          chargedToIncomeEligible: true,
          chargedToIncomeAmount: fullAmount,  // SET TO FULL AMOUNT
          chargedToIncomeSubsidyAmount: personnel.subsidyAmount || 0
        }
      });
      
      totalBefore += oldChargedAmount;
      totalAfter += fullAmount;
    }
    
    console.log('✅ Updated ' + allPersonnel.length + ' personnel');
    console.log('\nBefore: ₱' + totalBefore.toFixed(2) + ' charged');
    console.log('After:  ₱' + totalAfter.toFixed(2) + ' charged');
    console.log('Difference: ₱' + (totalAfter - totalBefore).toFixed(2));
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
  }
})();
