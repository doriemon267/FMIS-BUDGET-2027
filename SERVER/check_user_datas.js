const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function run() {
  try {
    const mainConnection = await mongoose.createConnection(process.env.MONGODB_URI_MAIN || 'mongodb://localhost:27017/fmis_main').asPromise();
    console.log('Connected to fmis_main');
    
    const UserData = mainConnection.model('user_datas', new mongoose.Schema({}, { strict: false }), 'user_datas');
    const sample = await UserData.findOne().lean();
    console.log(JSON.stringify(sample, null, 2));
    
    await mainConnection.close();
  } catch(e) {
    console.error(e);
  }
}
run();
