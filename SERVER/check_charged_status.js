require('dotenv').config();
const mongoose = require('mongoose');
const PersonnelServices = require('./models/PersonnelServices');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGODB_BUDGET_URL);
    
    console.log('=== CHECKING PERSONNEL CHARGED-TO-INCOME STATUS ===\n');
    
    // Get ALL personnel for this proposal
    const allPersonnel = await PersonnelServices.find({ 
      fiscalYear: '2026', 
      budgetType: 'Initial', 
      region: 'CENTRAL OFFICE' 
    });
    
    console.log('Total Personnel Records: ' + allPersonnel.length + '\n');
    
    // Group by status
    const byStatus = {};
    let totalFull = 0;
    let totalPartial = 0;
    let totalNotCharged = 0;
    let totalAmount = 0;
    let totalChargedAmount = 0;
    
    allPersonnel.forEach(p => {
      const status = p.statusOfAppointment || 'Unknown';
      if (!byStatus[status]) byStatus[status] = { total: 0, charged: 0, notCharged: 0, partial: 0 };
      
      byStatus[status].total++;
      totalAmount += p.Total;
      
      const isFullyCharged = p.chargedToIncomeAmount === p.Total;
      const isPartialCharged = p.chargedToIncomeAmount > 0 && p.chargedToIncomeAmount < p.Total;
      const notCharged = p.chargedToIncomeAmount === 0 || !p.chargedToIncomeAmount;
      
      if (isFullyCharged) {
        byStatus[status].charged++;
        totalFull++;
        totalChargedAmount += p.chargedToIncomeAmount;
      } else if (isPartialCharged) {
        byStatus[status].partial++;
        totalPartial++;
        totalChargedAmount += p.chargedToIncomeAmount;
      } else if (notCharged) {
        byStatus[status].notCharged++;
        totalNotCharged++;
      }
    });
    
    console.log('=== BREAKDOWN BY STATUS ===\n');
    Object.entries(byStatus).forEach(([status, counts]) => {
      console.log(`${status}:`);
      console.log(`  Total: ${counts.total}`);
      console.log(`  Fully Charged: ${counts.charged}`);
      console.log(`  Partially Charged: ${counts.partial}`);
      console.log(`  Not Charged: ${counts.notCharged}`);
      console.log('');
    });
    
    console.log('=== TOTALS ===');
    console.log('Fully Charged: ' + totalFull);
    console.log('Partially Charged: ' + totalPartial);
    console.log('Not Charged: ' + totalNotCharged);
    console.log('\nTotal Personnel Amount: ₱' + totalAmount.toFixed(2));
    console.log('Total Charged Amount: ₱' + totalChargedAmount.toFixed(2));
    console.log('Remaining (Not Charged): ₱' + (totalAmount - totalChargedAmount).toFixed(2));
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
  }
})();
