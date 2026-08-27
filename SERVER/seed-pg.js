require('dotenv').config();
const mongoose = require('mongoose');
const PositionTitle = require('./models/PositionTitle'); // Palitan ng tamang path sa model mo

// Mapping table mula sa 2nd at 3rd image (Salary Grade -> CPCS 2 PG)
const sgToPgMap = {
  1: "1",   2: "2",   3: "3",   4: "4",   5: "5",
  6: "6",   7: "7",   8: "8",   9: "9",   10: "10",
  11: "11", 12: "12", 13: "13", 14: "14", 15: "15",
  16: "16", 17: "17", 18: "18", 19: "19", 20: "20",
  21: "20", 22: "21", 23: "21", 24: "22", 25: "23",
  26: "24", 27: "25", 28: "26", 29: "27", 30: "28"
};

async function updatePGBySG() {
  try {
    const mongoUri =
      process.env.MONGODB_BUDGET_URL ||
      process.env.MONGODB_URI ||
      process.env.MONGODB_URL;

    if (!mongoUri) {
      throw new Error(
        'MongoDB connection string is required. Set MONGODB_BUDGET_URL, MONGODB_URI, or MONGODB_URL.',
      );
    }

    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB...');

    // I-build ang bulk updates batay sa mapping table
    const bulkOperations = Object.keys(sgToPgMap).map((sg) => ({
      updateMany: {
        filter: { SG: Number(sg) },                       // Hanapin lahat ng record na may ganitong SG
        update: { $set: { PG: sgToPgMap[sg] } }            // I-set ang tamang PG value
      }
    }));

    const result = await PositionTitle.bulkWrite(bulkOperations);
    console.log('Update process completed:', result);

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  } catch (error) {
    console.error('Error updating PG values:', error);
  }
}

updatePGBySG();
