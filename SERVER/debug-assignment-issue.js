require('dotenv').config();
const mongoose = require('mongoose');
async function debugAssignmentIssue() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URL);
    // Check what regions and departments are available
    const regions = await mongoose.connection.db.collection('regions').find({}).toArray();
    const departments = await mongoose.connection.db.collection('departments').find({}).toArray();
    const mappings = await mongoose.connection.db.collection('departmentdivisionmappings').find({}).toArray();
    regions.slice(0, 3).forEach(r => );
    departments.slice(0, 3).forEach(d => );
    mappings.forEach(m => {
      const divisionNames = m.divisions.map(div => div.name || div.divisionName || div).join(', ');
      });
    // Check if there are any existing assignments
    const existingAssignments = await mongoose.connection.db.collection('hierarchicalassignments').find({}).toArray();
    } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}
debugAssignmentIssue();