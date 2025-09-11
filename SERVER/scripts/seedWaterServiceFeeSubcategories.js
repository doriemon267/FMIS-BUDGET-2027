require('dotenv').config();
const mongoose = require('mongoose');
const IncomeSubcategory = require('../models/IncomeSubcategory');
// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URL)
  .then(() => )
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
// Water Service Fee subcategories with proper region mapping
const waterServiceFeeSubcategories = [
  {
    name: "Aya PSP",
    regions: ["Region 2", "UPRIIS"],
    isGlobal: false
  },
  {
    name: "NPC Energy Delivery",
    regions: ["Region 3", "Region 4A", "UPRIIS"],
    isGlobal: false
  },
  {
    name: "Sun Asia Floating Solar",
    regions: ["Region 4A", "Central Office", "UPRIIS"],
    isGlobal: false
  },
  {
    name: "MARIIS Water Service",
    regions: ["Region 1", "Region 2", "Region 3", "MARIIS"],
    specialRegions: ["MARIIS"],
    isGlobal: false
  },
  {
    name: "UPRIIS Water Service",
    regions: ["Region 1", "Region 2", "Region 3", "UPRIIS"],
    specialRegions: ["UPRIIS"],
    isGlobal: false
  }
];
async function seedWaterServiceFeeSubcategories() {
  try {
    for (const subcatData of waterServiceFeeSubcategories) {
      try {
        // Check if this subcategory already exists
        const existingSubcat = await IncomeSubcategory.findOne({
          $or: [
            { incomeSubcategoryName: subcatData.name },
            { name: subcatData.name }
          ]
        });
        if (existingSubcat) {
          // Update the existing subcategory
          await IncomeSubcategory.findByIdAndUpdate(
            existingSubcat._id,
            {
              regions: subcatData.regions || [],
              specialRegions: subcatData.specialRegions || [],
              isGlobal: subcatData.isGlobal || false
            }
          );
        } else {
          // Create a new subcategory
          const newSubcat = new IncomeSubcategory({
            incomeSubcategoryName: subcatData.name,
            name: subcatData.name,
            regions: subcatData.regions || [],
            specialRegions: subcatData.specialRegions || [],
            isGlobal: subcatData.isGlobal || false
          });
          await newSubcat.save();
        }
      } catch (error) {
        console.error(`Error processing subcategory "${subcatData.name}":`, error);
      }
    }
    process.exit(0);
  } catch (error) {
    console.error('Error seeding Water Service Fee subcategories:', error);
    process.exit(1);
  }
}
// Run the seed function
seedWaterServiceFeeSubcategories();