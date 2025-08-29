const mongoose = require('mongoose');
const UserRegionAssignment = require('./models/UserRegionAssignment');

// Load environment variables
require('dotenv').config();

// Connect to MongoDB
require('./config/mongo_db')();

const revertUserIdFix = async () => {
  try {
    console.log('🔧 Reverting user ID back to the correct one (909549)...');
    
    // Find the assignment with the "corrected" user ID
    const wrongAssignment = await UserRegionAssignment.findOne({ userId: "90959" });
    
    if (wrongAssignment) {
      console.log('Found assignment with wrong user ID:', wrongAssignment.userId);
      
      // Update back to the correct user ID
      wrongAssignment.userId = "909549";
      await wrongAssignment.save();
      
      console.log('✅ Reverted user ID from 90959 back to 909549');
    } else {
      console.log('No assignment found with user ID 90959');
    }
    
    // Verify the revert
    const correctAssignment = await UserRegionAssignment.findOne({ userId: "909549" }).populate('regions');
    if (correctAssignment) {
      console.log('✅ Verified: Assignment found for user ID 909549');
      console.log('Assigned regions:', correctAssignment.regions?.map(r => r.Region) || 'No regions populated');
    } else {
      console.log('❌ No assignment found for user ID 909549');
    }
    
  } catch (error) {
    console.error('Error reverting user ID:', error);
  } finally {
    process.exit(0);
  }
};

// Wait for MongoDB connection
mongoose.connection.once('open', () => {
  console.log('📊 Connected to MongoDB');
  revertUserIdFix();
});
