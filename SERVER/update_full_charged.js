require('dotenv').config();
const mongoose = require('mongoose');
const PersonnelServices = require('./models/PersonnelServices');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGODB_BUDGET_URL);
    
    console.log('=== UPDATING ALL PERSONNEL TO FULL CHARGED-TO-INCOME ===\n');
    
    // Get all charged-to-income personnel
    const allChargedPersonnel = await PersonnelServices.find({ chargedToIncomeEligible: true });
    
    console.log('Found ' + allChargedPersonnel.length + ' personnel marked as charged-to-income');
    
    let totalUpdated = 0;
    let totalAmount = 0;
    
    for (const personnel of allChargedPersonnel) {
      // Update chargedToIncomeAmount to equal the full Total
      const fullAmount = personnel.Total;
      await PersonnelServices.findByIdAndUpdate(personnel._id, {
        $set: {
          chargedToIncomeAmount: fullAmount,
          chargedToIncomeSubsidyAmount: personnel.subsidyAmount || 0
        }
      });
      
      totalUpdated++;
      totalAmount += fullAmount;
      
      if (totalUpdated <= 3) {
        console.log('[' + totalUpdated + '] Updated: Total=' + fullAmount + ' -> chargedToIncomeAmount=' + fullAmount);
      }
    }
    
    console.log('\n✅ Updated ' + totalUpdated + ' personnel');
    console.log('Total amount now marked as charged-to-income: ₱' + totalAmount.toFixed(2));
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
  }
})();
