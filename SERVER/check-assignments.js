/**
 * Simple check for current user assignments
 */
const mongoose = require('mongoose');
const HierarchicalUserAssignment = require('./models/HierarchicalUserAssignment');

async function main() {
  try {
    await mongoose.connect('mongodb://172.16.4.98:27017/fmis_budget');
    console.log('✅ Connected to MongoDB');
    
    // Get all hierarchical assignments
    const assignments = await HierarchicalUserAssignment.find({})
      .populate('regionId departmentId')
      .lean();
    
    console.log('\n📋 All Hierarchical Assignments:');
    assignments.forEach((assignment, i) => {
      console.log(`${i+1}. User ID: ${assignment.userId}`);
      console.log(`   Assignment Level: ${assignment.assignmentLevel}`);
      console.log(`   Region: ${assignment.regionId?.Region || assignment.regionId?.regionName || 'N/A'}`);
      console.log(`   Department: ${assignment.departmentId?.Department || assignment.departmentId?.departmentName || 'N/A'}`);
      console.log(`   Division: ${assignment.divisionName || 'N/A'}`);
      console.log(`   Roles: ${assignment.rolePermissions?.join(', ') || 'N/A'}`);
      console.log('');
    });
    
    // Based on what we see, we can identify who is Nelson
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

main();