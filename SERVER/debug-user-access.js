const mongoose = require('mongoose');

// Connect to MongoDB - use your actual database server  
mongoose.connect('mongodb://172.16.4.98:27017/fmis_budget', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function checkUserAccess() {
  try {
    console.log('🔍 Checking user access assignments...');
    
    // Wait for connection
    await mongoose.connection.once('open', () => {
      console.log('Connected to database');
    });
    
    // Check users collection for CORPORATE PLANNING SERVICES vs MANAGEMENT INFORMATION DIVISION
    const usersCol = mongoose.connection.db.collection('users');
    
    console.log('👥 Searching for users...');
    const corporateUsers = await usersCol.find({ 
      $or: [
        { department: /CORPORATE PLANNING/i },
        { division: /MANAGEMENT INFORMATION/i }
      ]
    }).toArray();
    
    console.log(`\n📊 Found ${corporateUsers.length} users:`);
    corporateUsers.forEach((user, index) => {
      console.log(`\nUser ${index + 1}:`);
      console.log('- Name:', user.fullName || user.name);
      console.log('- Username:', user.username);
      console.log('- Department:', user.department);
      console.log('- Division:', user.division);
      console.log('- Access Level:', user.accessLevel);
      console.log('- Region:', user.region);
    });
    
    // Also check user assignments
    console.log('\n🎯 Checking user assignments...');
    const userAssignments = mongoose.connection.db.collection('userassignments');
    const assignments = await userAssignments.find({}).toArray();
    
    console.log(`\n📋 Found ${assignments.length} assignments:`);
    assignments.forEach((assignment, index) => {
      console.log(`\nAssignment ${index + 1}:`);
      console.log('- User ID:', assignment.userId);
      console.log('- Username:', assignment.username);
      console.log('- Region:', assignment.region);
      console.log('- Department:', assignment.department);
      console.log('- Division:', assignment.division);
      console.log('- Access Level:', assignment.accessLevel);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    mongoose.connection.close();
  }
}

checkUserAccess();
