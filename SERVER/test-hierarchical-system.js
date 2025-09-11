/**
 * 🧪 Test Hierarchical Access Control System
 */
require('dotenv').config();
const mongoose = require('mongoose');
const HierarchicalUserAssignment = require('./models/HierarchicalUserAssignment');
async function testHierarchicalSystem() {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    // Test 1: Check if we have any hierarchical assignments
    const assignments = await HierarchicalUserAssignment.find({});
    if (assignments.length === 0) {
      } else {
      assignments.forEach(a => {
        : ${a.assignmentLevel} level`);
        if (a.regionId) if (a.departmentId) if (a.divisionName) });
      }
    // Test 2: Test getUserPermissions for a sample user
    if (assignments.length > 0) {
      const testUserId = assignments[0].userId;
      const permissions = await HierarchicalUserAssignment.getUserPermissions(testUserId);
      );
      }
    // Test 3: Test getUserPermissions for non-existent user
    const nonExistentPermissions = await HierarchicalUserAssignment.getUserPermissions('NONEXISTENT');
    );
    } catch (error) {
    console.error('❌ Error testing hierarchical system:', error);
  } finally {
    await mongoose.disconnect();
    }
}
testHierarchicalSystem();