const { MongoClient } = require('mongodb');

async function run() {
  const client = new MongoClient('mongodb://superadmin:Today%404040@localhost:27017/fmis_budget?authSource=admin');
  try {
    await client.connect();
    const db = client.db('fmis_budget');
    const mappings = await db.collection('departmentdivisionmappings').find({}).toArray();
    
    console.log("Mappings count:", mappings.length);
    console.log("Sample mappings:", JSON.stringify(mappings.slice(0, 3), null, 2));

    const depts = await db.collection('departments').find({}).toArray();
    console.log("\nDepts count:", depts.length);
    console.log("Sample depts:", JSON.stringify(depts.slice(0, 3), null, 2));
    
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

run();
