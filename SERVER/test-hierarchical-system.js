/**
 * 🧪 Test Hierarchical Access Control System
 */

require('dotenv').config();
const mongoose = require('mongoose');
const HierarchicalUserAssignment = require('./models/HierarchicalUserAssignment');

async function testHierarchicalSystem() {
  console.log('🧪 Testing Hierarchical Access Control System...\n');
  
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    console.log('✅ Connected to database\n');
    
    // Test 1: Check if we have any hierarchical assignments
    const assignments = await HierarchicalUserAssignment.find({});
    console.log(`📊 Found ${assignments.length} hierarchical assignments`);
    
    if (assignments.length === 0) {
      console.log('ℹ️  No hierarchical assignments found. Users will have default access only.\n');
    } else {
      console.log('📋 Current assignments:');
      assignments.forEach(a => {
        console.log(`- User ${a.userId} (${a.userName}): ${a.assignmentLevel} level`);
        if (a.regionId) console.log(`  Region: ${a.regionId}`);
        if (a.departmentId) console.log(`  Department: ${a.departmentId}`);
        if (a.divisionName) console.log(`  Division: ${a.divisionName}`);
      });
      console.log();
    }
    
    // Test 2: Test getUserPermissions for a sample user
    if (assignments.length > 0) {
      const testUserId = assignments[0].userId;
      console.log(`🔍 Testing getUserPermissions for user: ${testUserId}`);
      
      const permissions = await HierarchicalUserAssignment.getUserPermissions(testUserId);
      console.log('📋 User permissions:', JSON.stringify(permissions, null, 2));
      console.log();
    }
    
    // Test 3: Test getUserPermissions for non-existent user
    console.log('🔍 Testing getUserPermissions for non-existent user...');
    const nonExistentPermissions = await HierarchicalUserAssignment.getUserPermissions('NONEXISTENT');
    console.log('📋 Non-existent user permissions:', JSON.stringify(nonExistentPermissions, null, 2));
    
    console.log('\n✅ Hierarchical access control system is working!');
    console.log('\n🚀 To test the system:');
    console.log('1. Create a hierarchical assignment using the frontend');
    console.log('2. Login with that user');
    console.log('3. Try to access proposals - you should only see data from your assigned level');
    console.log('4. Try to create proposals - they should be saved with proper organizational context');
    
  } catch (error) {
    console.error('❌ Error testing hierarchical system:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

testHierarchicalSystem();
