// Script to update due date to allow deletions
const mongoose = require('mongoose');
const Settings = require('../../models/Settings');
const DB_URL = 'mongodb://172.16.4.98:27017/fmis_budget';
async function updateDueDate() {
  try {
    await mongoose.connect(DB_URL);
    // // Set new due date to 30 days from now
    const newDueDate = new Date();
    newDueDate.setDate(newDueDate.getDate() + 30);
    const result = await Settings.updateOne(
      { isActive: true },
      { dueDate: newDueDate }
    );
    if (result.modifiedCount > 0) {
      // // }`);
      // } else {
      // }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.disconnect();
  }
}
updateDueDate();