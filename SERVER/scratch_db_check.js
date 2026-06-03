require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  try {
    console.log("Connecting to:", process.env.MONGODB_BUDGET_URL);
    await mongoose.connect(process.env.MONGODB_BUDGET_URL);
    console.log("Connected successfully!");
    
    const db = mongoose.connection.db;
    
    // Find all assignments
    const assignments = await db.collection('hierarchicaluserassignments').find({}).toArray();
    console.log("Assignments Count:", assignments.length);
    if (assignments.length > 0) {
      const specific = assignments.find(a => String(a.userId) === '100017');
      if (specific) {
        console.log("Assignment for 100017:", JSON.stringify(specific, null, 2));
      } else {
        console.log("Sample Assignment (first one):", JSON.stringify(assignments[0], null, 2));
        console.log("List of assignment userIds:", assignments.map(a => a.userId));
      }
    }
    
    // Find region sample
    const region = await db.collection('regions').findOne({});
    console.log("Sample Region:", JSON.stringify(region, null, 2));
    
    // Find department sample
    const department = await db.collection('departments').findOne({});
    console.log("Sample Department:", JSON.stringify(department, null, 2));
    
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.connection.close();
  }
}

main();
