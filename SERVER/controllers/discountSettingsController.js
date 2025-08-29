const DiscountSettings = require("../models/DiscountSettings");

// Get discount settings
exports.getDiscountSettings = async (req, res) => {
  try {
    const { fiscalYear, budgetType, region } = req.query;
    
    // Use default values if not provided
    const year = fiscalYear || new Date().getFullYear().toString();
    const budget = budgetType || "REGULAR";
    
    // console.log(`Fetching discount settings for FY: ${year}, Budget: ${budget}, Region: ${region || 'All'}`);
    
    // Log the full query for debugging
    // console.log("Full query parameters:", req.query);
    
    // Build the query
    const query = { 
      fiscalYear: year, 
      budgetType: budget,
      name: "ISF_DISCOUNT"
    };
    
    // Add region to query if provided
    if (region) {
      query.region = region;
    }
    
    // console.log("Database query:", query);
    
    // Find settings for this fiscal year, budget type, and region
    let settings = await DiscountSettings.findOne(query);
    
    // If no settings exist, create default settings
    if (!settings) {
      console.log("No settings found, creating defaults");
      // Only create default settings if region is provided
      if (region) {
        console.log(`Creating default settings for region: ${region}`);
        settings = await DiscountSettings.create({
          name: "ISF_DISCOUNT",
          discountType: "percentage",
          discountValue: 10,
          applyDiscount: true,
          fiscalYear: year,
          budgetType: budget,
          region: region, // Include the region
          processBy: req.user?.username || "system",
          processDate: new Date()
        });
      } else {
        // If no region provided, return empty settings
        console.log("No region provided, returning empty settings");
        return res.status(400).json({ 
          message: "Region is required to create default settings" 
        });
      }
    }
    
    // console.log("Returning settings:", settings);
    res.status(200).json(settings);
  } catch (error) {
    console.error("Error getting discount settings:", error);
    res.status(500).json({ 
      message: "Failed to get discount settings", 
      error: error.message
    });
  }
};

// Update discount settings
exports.updateDiscountSettings = async (req, res) => {
  try {
    const { fiscalYear, budgetType, region, discountType, discountValue, applyDiscount } = req.body;
    
    // Log the full request body for debugging
    console.log("Update request body:", req.body);
    
    if (!fiscalYear || !budgetType || !region) {
      return res.status(400).json({ 
        message: "Fiscal year, budget type, and region are required" 
      });
    }
    
    // console.log(`Updating discount settings for FY: ${fiscalYear}, Budget: ${budgetType}, Region: ${region}`);
    // console.log("New values:", { discountType, discountValue, applyDiscount, region });
    
    // Find and update settings, or create if they don't exist
    const settings = await DiscountSettings.findOneAndUpdate(
      { 
        fiscalYear, 
        budgetType,
        region, // Include region in the query
        name: "ISF_DISCOUNT"
      },
      {
        $set: {
          discountType,
          discountValue,
          applyDiscount,
          processBy: req.user?.username || "system",
          processDate: new Date()
        }
      },
      { 
        new: true, 
        upsert: true 
      }
    );
    
    console.log("Updated settings:", settings);
    res.status(200).json(settings);
  } catch (error) {
    console.error("Error updating discount settings:", error);
    res.status(500).json({ 
      message: "Failed to update discount settings", 
      error: error.message
    });
  }
};

