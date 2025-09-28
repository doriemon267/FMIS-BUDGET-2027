/**
 * Deep debug of getUserPermissions method to understand why it returns NONE
 */
const mongoose = require('mongoose');
const HierarchicalUserAssignment = require('./models/HierarchicalUserAssignment');

async function deepDebugGetUserPermissions() {
  try {
    await mongoose.connect('mongodb://172.16.4.98:27017/fmis_budget');
    console.log('✅ Connected to MongoDB\n');
    
    const userId = 416461;
    
    console.log(`🔍 Deep debugging getUserPermissions for userId: ${userId}`);
    
    // Step 1: Try the first query
    console.log('\n1️⃣ Testing first query with populate...');
    const doc1 = await HierarchicalUserAssignment.findOne({ userId, isActive: true })
      .populate('regionId', 'regionName Region RegionName')
      .populate('departmentId', 'Department departmentName DepartmentName');
    
    console.log(`First query result: ${doc1 ? 'FOUND' : 'NOT FOUND'}`);
    if (doc1) {
      console.log('   Assignment Level:', doc1.assignmentLevel);
      console.log('   Region ID:', doc1.regionId);
      console.log('   Department ID:', doc1.departmentId);
      console.log('   Division Name:', doc1.divisionName);
    }
    
    // Step 2: Try raw database query (fallback logic)
    console.log('\n2️⃣ Testing raw database query...');
    const candidates = [userId, Number(userId), String(userId)];
    console.log('   Candidates:', candidates);
    
    const raw = await mongoose.connection.db
      .collection('hierarchicaluserassignments')
      .findOne({ isActive: true, userId: { $in: candidates } });
    
    console.log(`Raw query result: ${raw ? 'FOUND' : 'NOT FOUND'}`);
    if (raw) {
      console.log('   Raw _id:', raw._id);
      console.log('   Raw assignmentLevel:', raw.assignmentLevel);
      console.log('   Raw userId:', raw.userId);
      console.log('   Raw userId type:', typeof raw.userId);
    }
    
    // Step 3: If raw found, try to populate it
    if (raw?._id) {
      console.log('\n3️⃣ Testing populated query from raw ID...');
      const doc2 = await HierarchicalUserAssignment.findById(raw._id)
        .populate('regionId', 'regionName Region RegionName')
        .populate('departmentId', 'Department departmentName DepartmentName');
      
      console.log(`Populated query result: ${doc2 ? 'FOUND' : 'NOT FOUND'}`);
      if (doc2) {
        console.log('   Assignment Level:', doc2.assignmentLevel);
        console.log('   Region ID:', doc2.regionId);
      }
    }
    
    // Step 4: Call the actual getUserPermissions method
    console.log('\n4️⃣ Testing actual getUserPermissions method...');
    const result = await HierarchicalUserAssignment.getUserPermissions(userId);
    
    console.log('getUserPermissions result:');
    console.log('   Assignment Level:', result.assignmentLevel);
    console.log('   User ID:', result.userId);
    console.log('   Access Scope:', result.accessScope);
    console.log('   Regions:', result.regions);
    console.log('   Departments:', result.departments);
    
    // Step 5: Let's also check if there are multiple records
    console.log('\n5️⃣ Checking for multiple records...');
    const all = await HierarchicalUserAssignment.find({ userId: { $in: candidates } });
    console.log(`Total records for user: ${all.length}`);
    all.forEach((doc, i) => {
      console.log(`   Record ${i+1}: Level=${doc.assignmentLevel}, Active=${doc.isActive}, ID=${doc._id}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

deepDebugGetUserPermissions();