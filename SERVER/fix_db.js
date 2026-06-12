const mongoose = require('mongoose');

async function fixDb() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/fmis_budget');
    console.log('Connected to DB');
    
    // Drop the unique email index
    try {
      await mongoose.connection.collection('users').dropIndex('email_1');
      console.log('Successfully dropped email_1 index');
    } catch (e) {
      console.log('Index email_1 might not exist or error dropping it:', e.message);
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

fixDb();
