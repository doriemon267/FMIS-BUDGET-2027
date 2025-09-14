/**
 * Test the submission workflow middleware directly for delete operations
 */
const { submissionWorkflowControl } = require('./middleware/submissionWorkflowControl');
const HierarchicalUserAssignment = require('./models/HierarchicalUserAssignment');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

async function testMiddlewareDirectly() {
  try {
    await mongoose.connect('mongodb://172.16.4.98:27017/fmis_budget');
    console.log('✅ Connected to MongoDB\n');
    
    // Create mock request object
    const regionUserData = {
      id: 416461,
      FirstName: "Nelson",
      LastName: "Eloso",
      Roles: ["EMPLOYEE"]
    };
    
    const token = jwt.sign(regionUserData, 'fmis_budget_secret_2024', { expiresIn: '1h' });
    
    const req = {
      user: regionUserData,
      headers: {
        authorization: `Bearer ${token}`
      },
      params: { id: '68c6283a9a22214a59261c2d' },
      body: {} // DELETE requests typically don't have body, but middleware expects it
    };
    
    const res = {
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(obj) {
        this.responseData = obj;
        return this;
      }
    };
    
    console.log('🧪 Testing middleware directly...');
    console.log('User:', regionUserData.FirstName + ' ' + regionUserData.LastName);
    console.log('User ID:', regionUserData.id);
    console.log('Operation: delete\n');
    
    // Test getUserPermissions directly first
    console.log('1️⃣ Testing getUserPermissions directly...');
    const assignment = await HierarchicalUserAssignment.getUserPermissions(416461);
    console.log('Assignment result:');
    console.log('   Level:', assignment.assignmentLevel);
    console.log('   Access Scope:', assignment.accessScope);
    console.log('   Regions:', assignment.regions.length);
    
    // Create the middleware function
    const middleware = submissionWorkflowControl('delete', { enforceSubmissionWorkflow: true });
    
    let middlewareCompleted = false;
    let nextCalled = false;
    
    const next = () => {
      nextCalled = true;
      console.log('✅ Middleware called next() - delete allowed');
      middlewareCompleted = true;
    };
    
    console.log('\n2️⃣ Running middleware...');
    
    // Run the middleware
    await middleware(req, res, next);
    
    // Wait a bit for async operations
    setTimeout(() => {
      if (!middlewareCompleted) {
        if (res.statusCode) {
          console.log('❌ Middleware blocked request');
          console.log('Status Code:', res.statusCode);
          console.log('Response:', res.responseData);
        } else {
          console.log('⏳ Middleware still processing...');
        }
        middlewareCompleted = true;
      }
    }, 1000);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    setTimeout(() => {
      mongoose.connection.close();
      console.log('\n🔌 Database connection closed');
    }, 2000);
  }
}

testMiddlewareDirectly();