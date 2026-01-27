const DiscountSettings = require("../models/DiscountSettings");
// Get discount settings
exports.getDiscountSettings = async (req, res) => {
  try {
    const { fiscalYear, budgetType, region } = req.query;
    // Use default values if not provided
    const year = fiscalYear || new Date().getFullYear().toString();
    const budget = budgetType || "REGULAR";
    // // Log the full query for debugging
    // // Build the query
    const query = { 
      fiscalYear: year, 
      budgetType: budget,
      name: "ISF_DISCOUNT"
    };
    // Add region to query if provided (case-insensitive match)
    if (region) {
      const trimmedRegion = String(region).trim();
      const escapedRegion = trimmedRegion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.region = new RegExp(`^${escapedRegion}$`, "i");
    }
    // // Find settings for this fiscal year, budget type, and region
    let settings = await DiscountSettings.findOne(query);
    // If no settings exist, create default settings
    if (!settings) {
      // Only create default settings if region is provided
      if (region) {
        const trimmedRegion = String(region).trim();
        settings = await DiscountSettings.create({
          name: "ISF_DISCOUNT",
          discountType: "percentage",
          discountValue: 10,
          applyDiscount: true,
          fiscalYear: year,
          budgetType: budget,
          region: trimmedRegion, // Include normalized region
          processBy: req.user?.username || "system",
          processDate: new Date()
        });
      } else {
        // If no region provided, return empty settings
        return res.status(400).json({ 
          message: "Region is required to create default settings" 
        });
      }
    }
    return res.status(200).json(settings);
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
    if (!fiscalYear || !budgetType || !region) {
      return res.status(400).json({ 
        message: "Fiscal year, budget type, and region are required" 
      });
    }
    // // // Find and update settings, or create if they don't exist
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
    res.status(200).json(settings);
  } catch (error) {
    console.error("Error updating discount settings:", error);
    res.status(500).json({ 
      message: "Failed to update discount settings", 
      error: error.message
    });
  }
};
