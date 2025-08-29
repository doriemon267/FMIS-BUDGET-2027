const mongoose = require('mongoose');
const UserRegionAssignment = require('./models/UserRegionAssignment');

// Load environment variables
require('dotenv').config();

// Connect to MongoDB
require('./config/mongo_db')();

const fixUserIdMismatch = async () => {
  try {
    console.log('🔧 Fixing user ID mismatch in region assignments...');
    
    // Find the assignment with the wrong user ID
    const wrongAssignment = await UserRegionAssignment.findOne({ userId: "909549" });
    
    if (wrongAssignment) {
      console.log('Found assignment with wrong user ID:', wrongAssignment.userId);
      
      // Update to the correct user ID
      wrongAssignment.userId = "90959";
      await wrongAssignment.save();
      
      console.log('✅ Updated user ID from 909549 to 90959');
    } else {
      console.log('No assignment found with user ID 909549');
    }
    
    // Verify the fix
    const correctAssignment = await UserRegionAssignment.findOne({ userId: "90959" }).populate('regions');
    if (correctAssignment) {
      console.log('✅ Verified: Assignment found for user ID 90959');
      console.log('Assigned regions:', correctAssignment.regions.map(r => r.Region));
    } else {
      console.log('❌ No assignment found for user ID 90959');
    }
    
  } catch (error) {
    console.error('Error fixing user ID mismatch:', error);
  } finally {
    process.exit(0);
  }
};

// Wait for MongoDB connection
mongoose.connection.once('open', () => {
  console.log('📊 Connected to MongoDB');
  fixUserIdMismatch();
});
