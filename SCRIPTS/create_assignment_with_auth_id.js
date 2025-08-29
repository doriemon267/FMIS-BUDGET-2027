const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Define schemas
const userRegionAssignmentSchema = new mongoose.Schema({
  userId: String,
  regions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Region' }]
});

const regionSchema = new mongoose.Schema({
  name: String,
  Region: String
});

const UserRegionAssignment = mongoose.model('UserRegionAssignment', userRegionAssignmentSchema);
const Region = mongoose.model('Region', regionSchema);

async function createAssignmentWithAuthId() {
  try {
    // Get the Central Office region
    const centralOffice = await Region.findOne({ Region: "Central Office" });
    if (!centralOffice) {
      console.log("❌ Central Office region not found");
      return;
    }

    // REPLACE THIS WITH THE ACTUAL USER ID FROM AUTH SYSTEM
    const authUserId = "REPLACE_WITH_ACTUAL_AUTH_USER_ID";
    
    console.log(`🔧 Creating assignment for auth user ID: ${authUserId}`);
    
    // Delete existing assignment if any
    await UserRegionAssignment.findOneAndDelete({ userId: authUserId });
    
    // Create new assignment
    const assignment = new UserRegionAssignment({
      userId: authUserId,
      regions: [centralOffice._id]
    });
    
    await assignment.save();
    
    console.log("✅ Assignment created with auth user ID");
    console.log("User ID:", authUserId);
    console.log("Region:", centralOffice.Region);
    
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    mongoose.connection.close();
  }
}

// Run the script
createAssignmentWithAuthId();

console.log(`
📋 INSTRUCTIONS:
1. Log in to the app and check the console for the actual auth user ID
2. Replace "REPLACE_WITH_ACTUAL_AUTH_USER_ID" with the real ID
3. Run this script: node create_assignment_with_auth_id.js
`);
