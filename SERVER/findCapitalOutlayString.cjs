const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_BUDGET_URL).then(async () => {
  const collections = await mongoose.connection.db.listCollections().toArray();

  for (const colInfo of collections) {
    const colName = colInfo.name;
    const col = mongoose.connection.collection(colName);
    const docs = await col.find().toArray();
    
    docs.forEach(d => {
      const json = JSON.stringify(d);
      if (json.includes('400000') || json.includes('686100000') || json.includes('29585619')) {
        console.log(`\nFOUND IN COLLECTION: [ ${colName} ]`);
        console.log('Doc ID:', d._id, 'FY:', d.fiscalYear, 'Region:', d.region, 'Dept:', d.department, 'Title:', d.title || d.name);
        console.log('Sample JSON snippet:', json.substring(0, 300));
      }
    });
  }

  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
