// Script to update due date to allow deletions
const mongoose = require('mongoose');
const Settings = require('./models/Settings');

const DB_URL = 'mongodb://172.16.4.98:27017/fmis_budget';

async function updateDueDate() {
  try {
    await mongoose.connect(DB_URL);
    // console.log('Connected to database');

    // Set new due date to 30 days from now
    const newDueDate = new Date();
    newDueDate.setDate(newDueDate.getDate() + 30);

    const result = await Settings.updateOne(
      { isActive: true },
      { dueDate: newDueDate }
    );

    if (result.modifiedCount > 0) {
      // console.log('✅ Due date updated successfully!');
      // console.log(`   New due date: ${newDueDate.toLocaleDateString('en-PH')}`);
      // console.log('   You can now delete capital outlay items.');
    } else {
      // console.log('❌ No active settings found to update');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.disconnect();
  }
}

updateDueDate();