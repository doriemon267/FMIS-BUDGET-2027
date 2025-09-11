const mongoose = require('mongoose');
const UserRegionAssignment = require('./models/UserRegionAssignment');
// Load environment variables
require('dotenv').config();
// Connect to MongoDB
require('./config/mongo_db')();
const revertUserIdFix = async () => {
  try {
    ...');
    // Find the assignment with the "corrected" user ID
    const wrongAssignment = await UserRegionAssignment.findOne({ userId: "90959" });
    if (wrongAssignment) {
      // Update back to the correct user ID
      wrongAssignment.userId = "909549";
      await wrongAssignment.save();
      } else {
      }
    // Verify the revert
    const correctAssignment = await UserRegionAssignment.findOne({ userId: "909549" }).populate('regions');
    if (correctAssignment) {
      || 'No regions populated');
    } else {
      }
  } catch (error) {
    console.error('Error reverting user ID:', error);
  } finally {
    process.exit(0);
  }
};
// Wait for MongoDB connection
mongoose.connection.once('open', () => {
  revertUserIdFix();
});