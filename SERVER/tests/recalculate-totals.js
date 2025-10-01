const mongoose = require('mongoose');
const PersonnelServices = require('../models/PersonnelServices');

// Load environment variables
require('dotenv').config();

// Connect to MongoDB using the same config as the main app
const mongoConfig = require('../config/mongo_db');

async function recalculateTotals() {
  try {
    console.log('Starting total recalculation...');

    // Wait for database connection
    await mongoConfig();

    const personnelRecords = await PersonnelServices.find({});
    console.log(`Found ${personnelRecords.length} personnel records`);

    const numericFields = [
      "annualSalary", "RATA", "PERA", "uniformALLOWANCE", "productivityIncentive",
      "medical", "meal", "cashGift", "midyearBonus", "yearEndBonus",
      "gsisPremium", "philhealthPremium", "pagibigPremium", "employeeCompensation",
      "subsistenceAllowanceMDS", "subsistenceAllowanceST", "overtimePay", "loyaltyAward",
      "earnedLeaves", "retirementBenefits", "terminalLeave", "courtAppearance",
      "hazardPay", "subsistenceAllowance", "honoraria", "childrenAllowance"
    ];

    let updatedCount = 0;
    for (const record of personnelRecords) {
      const oldTotal = record.Total || 0;
      const newTotal = numericFields.reduce(
        (acc, field) => acc + (Number(record[field]) || 0),
        0
      );

      if (Math.abs(oldTotal - newTotal) > 0.01) { // Allow for small floating point differences
        record.Total = newTotal;
        await record.save();
        updatedCount++;
        console.log(`Updated ${record.employeeFullName}: ${oldTotal} -> ${newTotal}`);
      }
    }

    console.log(`Updated ${updatedCount} records`);
    console.log('Total recalculation completed');

  } catch (error) {
    console.error('Error recalculating totals:', error);
  } finally {
    mongoose.disconnect();
  }
}

recalculateTotals();