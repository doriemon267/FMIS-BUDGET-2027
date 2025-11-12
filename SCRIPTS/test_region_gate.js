// Test script to remove/add user region assignments for testing the gate system
const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fmis-budget', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Define UserRegionAssignment schema
const UserRegionAssignmentSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  userName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  regions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Region',
    required: true
  }]
}, {
  timestamps: true
});

const UserRegionAssignment = mongoose.model('UserRegionAssignment', UserRegionAssignmentSchema);

async function testRegionGate() {
  try {
    const userId = '909549'; // Test user ID
    
    console.log('🔍 Current assignments for user:', userId);
    const currentAssignment = await UserRegionAssignment.findOne({ userId }).populate('regions');
    console.log('Current assignment:', currentAssignment);
    
    if (currentAssignment) {
      console.log('\n🗑️ Removing region assignment to test gate...');
      await UserRegionAssignment.deleteOne({ userId });
      console.log('✅ Region assignment removed');
      console.log('🔒 User should now see the pending assignment page');
      console.log('📋 To restore access, use the User Region Assignment page with admin account');
    } else {
      console.log('\n❌ No region assignment found for user');
      console.log('🔒 User should already see the pending assignment page');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    mongoose.connection.close();
  }
}

async function restoreRegionAccess() {
  try {
    const userId = '909549'; // Test user ID
    const Region = mongoose.model('Region', new mongoose.Schema({
      Region: String
    }));
    
    // Find Central Office region
    const centralOfficeRegion = await Region.findOne({ Region: 'Central Office' });
    if (!centralOfficeRegion) {
      console.log('❌ Central Office region not found');
      return;
    }
    
    console.log('🔍 Checking current assignments for user:', userId);
    const existingAssignment = await UserRegionAssignment.findOne({ userId });
    
    if (existingAssignment) {
      console.log('✅ User already has region assignment');
      return;
    }
    
    console.log('\n🔄 Restoring region assignment...');
    await UserRegionAssignment.create({
      userId: userId,
      userName: 'Test Super Admin',
      email: '909549@example.com',
      regions: [centralOfficeRegion._id]
    });
    
    console.log('✅ Region assignment restored');
    console.log('🔓 User should now have access to the system');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Check command line arguments
const action = process.argv[2];

if (action === 'remove') {
  testRegionGate();
} else if (action === 'restore') {
  restoreRegionAccess();
} else {
  console.log('Usage:');
  console.log('  node test_region_gate.js remove   - Remove region assignment to test gate');
  console.log('  node test_region_gate.js restore  - Restore region assignment');
  process.exit(1);
}
