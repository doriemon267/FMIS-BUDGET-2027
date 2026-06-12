require('dotenv').config();
const mongoose = require('mongoose');

async function fixDB() {
  try {
    const mongoUrl = process.env.MONGODB_BUDGET_URL || 'mongodb://superadmin:Today%404040@localhost:27017/fmis_budget?authSource=admin';
    await mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log("Connected to MongoDB!");
    
    const db = mongoose.connection.db;
    const col = db.collection("newproposalworkflows");
    
    const docs = await col.find({ region: { $type: "string" } }).toArray();
    console.log(`Found ${docs.length} docs with string region`);
    
    if (docs.length > 0) {
      console.log("First doc region:", docs[0].region);
      const regionCol = db.collection("regions");
      let fixedCount = 0;
      
      for (const d of docs) {
          const r = await regionCol.findOne({ Region: d.region });
          if (r) {
              await col.updateOne({ _id: d._id }, { $set: { region: r._id } });
              fixedCount++;
          } else {
              console.log("Could not find region in DB for:", d.region);
          }
      }
      console.log("Fixed", fixedCount, "docs.");
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected.");
    process.exit(0);
  }
}

fixDB();
