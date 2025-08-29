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
    console.log("🌱 Starting regions seeding...");
    
    // Connect to database
    await mongoose.connect(DB_CONNECTION);
    console.log("✅ Connected to MongoDB");

    // Check if regions already exist
    const existingRegionsCount = await Region.countDocuments();
    console.log(`📊 Found ${existingRegionsCount} existing regions in database`);

    if (existingRegionsCount > 0) {
      console.log("⚠️  Regions already exist in database");
      console.log("🔄 Checking for missing regions...");
      
      let addedCount = 0;
      for (const regionData of philippineRegions) {
        const existingRegion = await Region.findOne({ Region: regionData.Region });
        if (!existingRegion) {
          await Region.create(regionData);
          addedCount++;
          console.log(`✅ Added missing region: ${regionData.Region}`);
        }
      }
      
      if (addedCount === 0) {
        console.log("✅ All standard regions already exist in database");
      } else {
        console.log(`✅ Added ${addedCount} missing regions`);
      }
    } else {
      console.log("📝 Seeding regions...");
      
      // Insert all regions
      const result = await Region.insertMany(philippineRegions);
      console.log(`✅ Successfully seeded ${result.length} regions`);
    }

    // Verify the seeding
    const finalCount = await Region.countDocuments();
    console.log(`📈 Total regions in database: ${finalCount}`);
    
    // List all regions
    const allRegions = await Region.find({}).select('Region').lean();
    console.log("📋 Regions in database:");
    allRegions.forEach((region, index) => {
      console.log(`   ${index + 1}. ${region.Region}`);
    });

    console.log("🎉 Regions seeding completed successfully!");

  } catch (error) {
    console.error("❌ Seeding failed:", error);
    throw error;
  } finally {
    // Close database connection
    await mongoose.disconnect();
    console.log("🔌 Database connection closed");
  }
}

// Run the seeding if this file is executed directly
if (require.main === module) {
  seedRegions()
    .then(() => {
      console.log("🏁 Seeding script completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Seeding script failed:", error);
      process.exit(1);
    });
}

module.exports = seedRegions;
