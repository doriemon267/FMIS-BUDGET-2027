const IncomeSubcategory = require("../models/IncomeSubcategory");
const { textFilter } = require("../utils/controller_get_process");
const { regionsMatch } = require("../utils/regionUtils");
// Helper function to check if a region has data for specific category
const checkRegionHasDataForCategory = async (region, categoryName) => {
  try {
    // Import Income model to check for existing data
    const Income = require("../models/Income");
    // Check if the region has any income entries for this category
    const count = await Income.countDocuments({
      region: region,
      category: { $regex: new RegExp(categoryName, 'i') }
    });
    return count > 0;
  } catch (error) {
    console.error("Error checking region data:", error);
    return false;
  }
};
// Get all income subcategories from database only
exports.getAllIncomeSubcategories = async (req, res) => {
  try {
    // Get region from query parameter
    const region = req.query.region;
    // Get all subcategories from database
    const allSubcategories = await IncomeSubcategory.find({})
      .sort({ incomeSubcategoryName: 1 });
    // If no region specified, return all subcategories
    if (!region) {
      return res.status(200).json({
        incomeSubcategories: allSubcategories,
        fromDatabase: allSubcategories.length,
        total: allSubcategories.length,
        success: true
      });
    }
    // Filter subcategories based on region
    const filteredSubcategories = allSubcategories.filter(subcat => {
      // Include if it's global
      if (subcat.isGlobal) {
        return true;
      }
      // Include if it has the region in its regions array
      if (subcat.regions && subcat.regions.length > 0) {
        for (const subcatRegion of subcat.regions) {
          if (regionsMatch(region, subcatRegion)) {
            return true;
          }
        }
      }
      // No special regions logic - keep it simple and dynamic
      return false;
    });
    return res.status(200).json({
      incomeSubcategories: filteredSubcategories,
      fromDatabase: filteredSubcategories.length,
      total: filteredSubcategories.length,
      success: true
    });
  } catch (error) {
    console.error("Error in getAllIncomeSubcategories:", error);
    return res.status(500).json({
      error: "Failed to fetch income subcategories",
      success: false
    });
  }
};
// Get subcategories by region (strict filtering)
exports.getSubcategoriesByRegion = async (req, res) => {
  try {
    const { region } = req.query;
    if (!region) {
      return res.status(400).json({
        error: "Region parameter is required",
        success: false
      });
    }
    // Find subcategories that have the specified region in their regions array
    // This is a strict filter that only returns subcategories explicitly assigned to this region
    const filter = { regions: region };
    const subcategories = await IncomeSubcategory.find(filter)
      .sort({ incomeSubcategoryName: 1 });
    return res.status(200).json({
      subcategories,
      total: subcategories.length,
      success: true
    });
  } catch (error) {
    console.error("Error in getSubcategoriesByRegion:", error);
    return res.status(500).json({
      error: "Failed to fetch subcategories by region",
      success: false
    });
  }
};
// Get subcategories for a specific income category and region
exports.getSubcategoriesByCategory = async (req, res) => {
  try {
    const { categoryId, region } = req.query;
    if (!categoryId) {
      return res.status(400).json({ 
        error: "Category ID is required",
        success: false
      });
    }
    // Get the category to find its associated subcategories
    const IncomeCategory = require("../models/IncomeCategory");
    const category = await IncomeCategory.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        error: "Income category not found",
        success: false
      });
    }
    if (!category.incomeSubcategoryName || category.incomeSubcategoryName.length === 0) {
      return res.status(200).json({
        incomeSubcategories: [],
        total: 0,
        success: true,
        source: "no_subcategories"
      });
    }
    // Find subcategories that match the names in the category
    const allSubcategories = await IncomeSubcategory.find({
      $or: [
        { incomeSubcategoryName: { $in: category.incomeSubcategoryName } },
        { name: { $in: category.incomeSubcategoryName } }
      ]
    });
    let subcategories = allSubcategories;
    if (region) {
      // Filter using the same logic as the category controller
      subcategories = allSubcategories.filter(subcat => {
        // Check if global
        if (subcat.isGlobal) {
          return true;
        }
        // Check direct region match
        if (subcat.regions && subcat.regions.includes(region)) {
          return true;
        }
        // Check for region equivalences
        if (subcat.regions) {
          for (const subcatRegion of subcat.regions) {
            if (regionsMatch(region, subcatRegion)) {
              return true;
            }
          }
        }
        // No special regions logic - keep it simple and dynamic
        return false;
      });
    }
    return res.status(200).json({
      incomeSubcategories: subcategories,
      total: subcategories.length,
      success: true,
      source: "subcategory_collection"
    });
  } catch (error) {
    console.error("Error in getSubcategoriesByCategory:", error);
    return res.status(500).json({
      error: "Failed to fetch income subcategories for category",
      success: false
    });
  }
};
// Create a new income subcategory
exports.addIncomeSubcategory = async (req, res) => {
  try {
    const { incomeSubcategoryName, regions, specialRegions, isGlobal } = req.body;
    if (!incomeSubcategoryName) {
      return res.status(400).json({ error: "Income subcategory name is required." });
    }
    // Check if a subcategory with this name already exists
    const existingSubcategory = await IncomeSubcategory.findOne({
      $or: [
        { incomeSubcategoryName: incomeSubcategoryName },
        { name: incomeSubcategoryName }
      ]
    });
    if (existingSubcategory) {
      return res.status(400).json({ error: "A subcategory with this name already exists." });
    }
    // Prepare regions array
    let regionsArray = [];
    if (Array.isArray(regions)) {
      regionsArray = regions;
    } else if (typeof regions === 'string') {
      regionsArray = regions.split(',').map(r => r.trim()).filter(r => r);
    }
    // Prepare special regions array
    let specialRegionsArray = [];
    if (Array.isArray(specialRegions)) {
      specialRegionsArray = specialRegions;
    } else if (typeof specialRegions === 'string') {
      specialRegionsArray = specialRegions.split(',').map(r => r.trim()).filter(r => r);
    }
    // Create new subcategory with region mapping
    const newIncomeSubcategory = new IncomeSubcategory({
      incomeSubcategoryName,
      name: incomeSubcategoryName, // Set both fields to ensure consistency
      regions: regionsArray,
      specialRegions: specialRegionsArray,
      isGlobal: isGlobal === true || isGlobal === 'true'
    });
    await newIncomeSubcategory.save();
    return res.status(201).json({
      message: "Income subcategory created successfully.",
      incomeSubcategory: newIncomeSubcategory,
    });
  } catch (error) {
    console.error("Error in addIncomeSubcategory:", error);
    return res.status(500).json({ error: "Failed to create income subcategory." });
  }
};
// Update an existing income subcategory
exports.editIncomeSubcategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { incomeSubcategoryName, regions, specialRegions, isGlobal } = req.body;
    if (!incomeSubcategoryName) {
      return res.status(400).json({ error: "Income subcategory name is required." });
    }
    // Check if another subcategory with this name already exists
    const existingSubcategory = await IncomeSubcategory.findOne({
      $or: [
        { incomeSubcategoryName: incomeSubcategoryName },
        { name: incomeSubcategoryName }
      ],
      _id: { $ne: id } // Exclude the current subcategory
    });
    if (existingSubcategory) {
      return res.status(400).json({ error: "Another subcategory with this name already exists." });
    }
    // Prepare regions array
    let regionsArray = [];
    if (Array.isArray(regions)) {
      regionsArray = regions;
    } else if (typeof regions === 'string') {
      regionsArray = regions.split(',').map(r => r.trim()).filter(r => r);
    }
    // Prepare special regions array
    let specialRegionsArray = [];
    if (Array.isArray(specialRegions)) {
      specialRegionsArray = specialRegions;
    } else if (typeof specialRegions === 'string') {
      specialRegionsArray = specialRegions.split(',').map(r => r.trim()).filter(r => r);
    }
    // Prepare update data
    const updateData = {
      incomeSubcategoryName,
      name: incomeSubcategoryName, // Update both fields
      regions: regionsArray,
      specialRegions: specialRegionsArray,
      isGlobal: isGlobal === true || isGlobal === 'true'
    };
    const updatedIncomeSubcategory = await IncomeSubcategory.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
    if (!updatedIncomeSubcategory) {
      return res.status(404).json({ error: "Income subcategory not found." });
    }
    return res.json({
      message: "Income subcategory updated successfully.",
      incomeSubcategory: updatedIncomeSubcategory,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to update income subcategory." });
  }
};
// Delete an income subcategory
exports.deleteIncomeSubcategory = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedIncomeSubcategory = await IncomeSubcategory.findByIdAndDelete(id);
    if (!deletedIncomeSubcategory) {
      return res.status(404).json({ error: "Income subcategory not found." });
    }
    return res.json({ message: "Income subcategory deleted successfully." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to delete income subcategory." });
  }
};
// Update region assignments for a subcategory
exports.updateSubcategoryRegions = async (req, res) => {
  try {
    const { id } = req.params;
    const { regions, addRegions, removeRegions } = req.body;
    // Find the subcategory
    const subcategory = await IncomeSubcategory.findById(id);
    if (!subcategory) {
      return res.status(404).json({ 
        error: "Income subcategory not found.",
        success: false
      });
    }
    let updatedRegions = subcategory.regions || [];
    // If regions array is provided, replace the existing regions
    if (regions && Array.isArray(regions)) {
      updatedRegions = regions;
    } else {
      // Add regions if specified
      if (addRegions && Array.isArray(addRegions)) {
        addRegions.forEach(region => {
          if (!updatedRegions.includes(region)) {
            updatedRegions.push(region);
          }
        });
      }
      // Remove regions if specified
      if (removeRegions && Array.isArray(removeRegions)) {
        updatedRegions = updatedRegions.filter(region => !removeRegions.includes(region));
      }
    }
    // Update the subcategory
    const updatedSubcategory = await IncomeSubcategory.findByIdAndUpdate(
      id,
      { regions: updatedRegions },
      { new: true }
    );
    return res.status(200).json({
      message: "Subcategory regions updated successfully",
      subcategory: updatedSubcategory,
      success: true
    });
  } catch (error) {
    console.error("Error in updateSubcategoryRegions:", error);
    return res.status(500).json({
      error: "Failed to update subcategory regions",
      success: false
    });
  }
};
// Assign a subcategory to a specific region
exports.assignSubcategoryToRegion = async (req, res) => {
  try {
    const { subcategoryId, region } = req.body;
    if (!subcategoryId || !region) {
      return res.status(400).json({
        error: "Subcategory ID and region are required",
        success: false
      });
    }
    // Find the subcategory
    const subcategory = await IncomeSubcategory.findById(subcategoryId);
    if (!subcategory) {
      return res.status(404).json({
        error: "Income subcategory not found",
        success: false
      });
    }
    // Add the region if it's not already in the regions array
    const regions = subcategory.regions || [];
    if (!regions.includes(region)) {
      regions.push(region);
      // Update the subcategory
      await IncomeSubcategory.findByIdAndUpdate(
        subcategoryId,
        { regions },
        { new: true }
      );
    }
    return res.status(200).json({
      message: "Subcategory \"" + subcategory.name + "\" assigned to region " + region,
      success: true
    });
  } catch (error) {
    console.error("Error in assignSubcategoryToRegion:", error);
    return res.status(500).json({
      error: "Failed to assign subcategory to region",
      success: false
    });
  }
};