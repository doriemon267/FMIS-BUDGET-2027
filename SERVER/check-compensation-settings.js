require("dotenv").config();
const mongoose = require("mongoose");
const CompensationSettings = require("./models/CompensationSettings");

// Connect to database
async function checkCompensationSettings() {
  try {
    await mongoose.connect(process.env.MONGODB_BUDGET_URL);
    console.log("Connected to database");

    const count = await CompensationSettings.countDocuments();
    console.log(`Total compensation settings: ${count}`);

    if (count > 0) {
      const settings = await CompensationSettings.find().limit(5);
      console.log("Sample compensation settings:");
      settings.forEach(setting => {
        console.log(`- ${setting.name}: ${setting._id}`);
      });
    } else {
      console.log("No compensation settings found in database");
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error("Error:", error);
  }
}

checkCompensationSettings();