require('dotenv').config();
const mongoose = require('mongoose');
const PersonnelServices = require('./models/PersonnelServices');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGODB_BUDGET_URL);
    
    console.log('=== UPDATING ALL PERMANENT PERSONNEL TO FULL CHARGED-TO-INCOME ===\n');
    
    // Get ALL PERMANENT personnel
    const permanentPersonnel = await PersonnelServices.find({ 
      fiscalYear: '2026', 
      budgetType: 'Initial', 
      region: 'CENTRAL OFFICE',
      statusOfAppointment: 'PERMANENT'
    });
    
    console.log('Found ' + permanentPersonnel.length + ' permanent personnel\n');
    
    let successCount = 0;
    let failCount = 0;
    let totalBefore = 0;
    let totalAfter = 0;
    
    for (const personnel of permanentPersonnel) {
      const fullAmount = personnel.Total;
      const oldChargedAmount = personnel.chargedToIncomeAmount || 0;
      
      totalBefore += oldChargedAmount;
      totalAfter += fullAmount;
      
      try {
        const result = await PersonnelServices.updateOne(
          { _id: personnel._id },
          {
            $set: {
              chargedToIncomeEligible: true,
              chargedToIncomeAmount: fullAmount,
              chargedToIncomeSubsidyAmount: personnel.subsidyAmount || 0,
              chargedToIncomeTaggedBy: 'SYSTEM',
              chargedToIncomeTaggedAt: new Date()
            }
          }
        );
        
        if (result.modifiedCount > 0) {
          console.log(`✅ ${personnel.employeeFullName || 'Unknown'}: ₱${oldChargedAmount.toFixed(2)} → ₱${fullAmount.toFixed(2)}`);
          successCount++;
        } else {
          console.log(`⚠️  ${personnel.employeeFullName || 'Unknown'}: No change (matched=${result.matchedCount})`);
          failCount++;
        }
      } catch (e) {
        console.log(`❌ ${personnel.employeeFullName || 'Unknown'}: ${e.message}`);
        failCount++;
      }
    }
    
    console.log('\n=== SUMMARY ===');
    console.log('Successfully updated: ' + successCount);
    console.log('Failed: ' + failCount);
    console.log('Total before: ₱' + totalBefore.toFixed(2));
    console.log('Total after: ₱' + totalAfter.toFixed(2));
    console.log('Difference: ₱' + (totalAfter - totalBefore).toFixed(2));
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
