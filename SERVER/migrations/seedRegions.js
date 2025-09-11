/**
 * Migration script to seed the regions collection with Philippine regions
 * Run this script to populate the database with standard Philippine regions
 */
const mongoose = require("mongoose");
const Region = require("../models/Region");
// Database connection string - update this to match your environment
const DB_CONNECTION = process.env.MONGODB_URL || "mongodb://localhost:27017/fmis_budget";
// Standard Philippine regions data
const philippineRegions = [
  { Region: "Central Office" },
  { Region: "Region 1" },
  { Region: "Region 2" },
  { Region: "Region 3" },
  { Region: "Region 4A" },
  { Region: "Region 4B" },
  { Region: "Region 5" },
  { Region: "Region 6" },
  { Region: "Region 7" },
  { Region: "Region 8" },
  { Region: "Region 9" },
  { Region: "Region 10" },
  { Region: "Region 11" },
  { Region: "Region 12" },
  { Region: "Region 13" },
  { Region: "NCR" },
  { Region: "CAR" },
  { Region: "BARMM" }
];
async function seedRegions() {
  try {
    // Connect to database
    await mongoose.connect(DB_CONNECTION);
    // Check if regions already exist
    const existingRegionsCount = await Region.countDocuments();
    if (existingRegionsCount > 0) {
      let addedCount = 0;
      for (const regionData of philippineRegions) {
        const existingRegion = await Region.findOne({ Region: regionData.Region });
        if (!existingRegion) {
          await Region.create(regionData);
          addedCount++;
          }
      }
      if (addedCount === 0) {
        } else {
        }
    } else {
      // Insert all regions
      const result = await Region.insertMany(philippineRegions);
      }
    // Verify the seeding
    const finalCount = await Region.countDocuments();
    // List all regions
    const allRegions = await Region.find({}).select('Region').lean();
    allRegions.forEach((region, index) => {
      });
    } catch (error) {
    console.error("❌ Seeding failed:", error);
    throw error;
  } finally {
    // Close database connection
    await mongoose.disconnect();
    }
}
// Run the seeding if this file is executed directly
if (require.main === module) {
  seedRegions()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Seeding script failed:", error);
      process.exit(1);
    });
}
module.exports = seedRegions;