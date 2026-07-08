const mongoose = require('mongoose');

async function testQuery() {
  const MONGO_URI_MAIN = process.env.MONGO_URI_MAIN || 'mongodb://localhost:27017/fmis_main';
  
  try {
    console.log('Connecting to', MONGO_URI_MAIN);
    const mainConnection = await mongoose.createConnection(MONGO_URI_MAIN, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }).asPromise();
    
    console.log('Connected!');
    
    const UserData = mainConnection.model('user_datas', new mongoose.Schema({}, { strict: false }), 'user_datas');
    
    // Find any document to see its structure
    const doc = await UserData.findOne().lean();
    console.log('Sample document:', JSON.stringify(doc, null, 2));
    
    // Test our specific query
    const allIds = ['416461', 416461, '345220', 345220];
    const targetDoc = await UserData.findOne({
      $or: [
        { particularID: { $in: allIds } }
      ]
    }).lean();
    
    console.log('Target document:', JSON.stringify(targetDoc, null, 2));
    
    await mainConnection.close();
  } catch (error) {
    console.error('Error:', error);
  }
}

testQuery();
