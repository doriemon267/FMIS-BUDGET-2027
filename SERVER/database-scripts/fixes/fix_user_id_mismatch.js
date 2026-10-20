const mongoose = require('mongoose');
const UserRegionAssignment = require('../../models/UserRegionAssignment');
// Load environment variables
require('dotenv').config();
// Connect to MongoDB
require('../../config/mongo_db')();
const fixUserIdMismatch = async () => {
  try {
    // Find the assignment with the wrong user ID
    const wrongAssignment = await UserRegionAssignment.findOne({ userId: "909549" });
    if (wrongAssignment) {
      // Update to the correct user ID
      wrongAssignment.userId = "90959";
      await wrongAssignment.save();
      } else {
      }
    // Verify the fix
    const correctAssignment = await UserRegionAssignment.findOne({ userId: "90959" }).populate('regions');
    if (correctAssignment) {
      );
    } else {
      }
  } catch (error) {
    console.error('Error fixing user ID mismatch:', error);
  } finally {
    process.exit(0);
  }
};
// Wait for MongoDB connection
mongoose.connection.once('open', () => {
  fixUserIdMismatch();
});