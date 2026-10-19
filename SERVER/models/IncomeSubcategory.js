const mongoose = require("mongoose");
const incomeSubcategorySchema = new mongoose.Schema(
  {
    incomeSubcategoryName: { 
      type: String, 
      required: true
    },
    name: {
      type: String,
      unique: true
    },
    // Add regions field to map subcategories to specific regions
    regions: {
      type: [String],
      default: [],
      description: "List of regions where this subcategory is applicable"
    },
    // For special cases like MARIIS, UPRIIS, etc.
    specialRegions: {
      type: [String],
      default: [],
      description: "Special region designations like MARIIS, UPRIIS, etc."
    },
    // Flag to indicate if this subcategory is available to all regions
    isGlobal: {
      type: Boolean,
      default: false,
      description: "If true, this subcategory is available to all regions"
    }
  },
  { timestamps: true }
);
// Pre-save middleware to ensure name field is set
incomeSubcategorySchema.pre('save', function() {
  // Set the name field to match incomeSubcategoryName
  if (this.incomeSubcategoryName) {
    this.name = this.incomeSubcategoryName;
  }
  // If no regions are specified but the subcategory name contains a region identifier,
  // automatically add that region to the regions array
  if (this.regions.length === 0 && this.incomeSubcategoryName) {
    const regionMatches = this.incomeSubcategoryName.match(/\b(REGION \d+[A-Z]?|CAR|CARAGA|BARMM|NCR|Central Office|MARIIS|UPRIIS)\b/g);
    if (regionMatches) {
      regionMatches.forEach(region => {
        // Handle special cases
        if (region === 'MARIIS' || region === 'UPRIIS') {
          if (!this.specialRegions.includes(region)) {
            this.specialRegions.push(region);
          }
        } else {
          if (!this.regions.includes(region)) {
            this.regions.push(region);
          }
        }
      });
    }
  }
});
module.exports = mongoose.models.IncomeSubcategory || 
  mongoose.model("IncomeSubcategory", incomeSubcategorySchema);