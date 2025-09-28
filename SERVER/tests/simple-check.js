/**
 * Simple check without populate
 */
const mongoose = require('mongoose');
const HierarchicalUserAssignment = require('./models/HierarchicalUserAssignment');

async function main() {
  try {
    await mongoose.connect('mongodb://172.16.4.98:27017/fmis_budget');
    console.log('✅ Connected to MongoDB');
    
    // Get all hierarchical assignments without populate
    const assignments = await HierarchicalUserAssignment.find({}).lean();
    
    console.log('\n📋 All Hierarchical Assignments:');
    assignments.forEach((assignment, i) => {
      console.log(`${i+1}. User ID: ${assignment.userId}`);
      console.log(`   Assignment Level: ${assignment.assignmentLevel}`);
      console.log(`   Region ID: ${assignment.regionId}`);
      console.log(`   Department ID: ${assignment.departmentId}`);
      console.log(`   Division Name: ${assignment.divisionName || 'N/A'}`);
      console.log(`   Roles: ${assignment.rolePermissions?.join(', ') || 'N/A'}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

main();