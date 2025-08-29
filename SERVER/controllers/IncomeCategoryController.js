const IncomeCat = require("../models/IncomeCategory");
const IncomeCategory = require("../models/IncomeCategory");
const IncomeSubcategory = require("../models/IncomeSubcategory");
const mongoose = require("mongoose");
const { isValidObjectId } = require("mongoose");
const { regionsMatch, getAllRegionInfo } = require("../utils/regionUtils");

exports.getAllCategories1 = async (req, res) => {
  try {
    const categories = await IncomeCat.find().sort({ createdAt: -1 });
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

exports.getAllCategories = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      orderBy = "createdAt",
      order = "asc",
      incomeCategoryName,
      incomeSubcategoryName,
      description,
    } = req.query;

    let query = {};

    if (search) {
      query.$or = [
        { incomeCategoryName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    if (incomeCategoryName) {
      query.incomeCategoryName = { $regex: incomeCategoryName, $options: "i" };
    }
    if (description) {
      query.description = { $regex: description, $options: "i" };
    }

    const sortOrder = order.toLowerCase() === "desc" ? -1 : 1;
    const sortQuery = { [orderBy]: sortOrder };

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const skip = (pageNum - 1) * limitNum;

    const categories = await IncomeCat.find(query)
      .skip(skip)
      .limit(limitNum)
      .sort(sortQuery);

    const populatedCategories = categories.map(category => {
      return category.toObject();
    });

    const totalRecords = await IncomeCat.countDocuments(query);

    return res.json({
      categories: populatedCategories,
      totalPages: Math.ceil(totalRecords / limitNum),
      currentPage: pageNum,
      totalRecords,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to fetch income categories." });
  }
};

exports.getSubcategories = async (req, res) => {
  try {
    const items = await IncomeSubcategory.distinct("name");
    res.status(200).json({incomeSubcategoryName: items});
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

exports.addIncomeCategory = async (req, res) => {
  try {
    console.log("Received request to add income category:", req.body);
    const { 
      name, 
      incomeCategoryName, 
      description, 
      incomeSubcategoryName,
      isGlobal,
      regions
    } = req.body;
    const categoryName = (incomeCategoryName || name)?.trim();

    console.log("Extracted fields:", { categoryName, description, incomeSubcategoryName, isGlobal, regions });

    if (!categoryName) {
      console.log("Validation failed: Income category name is required");
      return res.status(400).json({ error: "Income category name is required." });
    }

    // Check for duplicate category name within the same region scope
    // Allow duplicates if they are assigned to different regions
    const existingCategory = await IncomeCat.findOne({
      incomeCategoryName: categoryName
    });

    if (existingCategory) {
      // If existing category is global, don't allow any duplicates
      if (existingCategory.isGlobal === true) {
        console.log("Validation failed: Global category with this name already exists");
        return res.status(400).json({ error: "A global category with this name already exists." });
      }
      
      // If new category is global, don't allow if any category with same name exists
      if (isGlobal === true) {
        console.log("Validation failed: Cannot create global category - regional category with this name already exists");
        return res.status(400).json({ error: "Cannot create global category - a regional category with this name already exists." });
      }
      
      // For regional categories, check if there's overlap in assigned regions
      const existingRegions = existingCategory.regions || [];
      const newRegions = regions || [];
      
      const hasOverlap = existingRegions.some(region => newRegions.includes(region));
      if (hasOverlap) {
        const overlappingRegions = existingRegions.filter(region => newRegions.includes(region));
        console.log("Validation failed: Category overlap in regions:", overlappingRegions);
        return res.status(400).json({ 
          error: `A category with this name already exists in regions: ${overlappingRegions.join(', ')}` 
        });
      }
      
      console.log("Validation passed: Category name duplicated but assigned to different regions");
    }

    const newIncomeCategory = new IncomeCat({
      incomeCategoryName: categoryName,
      name: categoryName,
      incomeSubcategoryName: incomeSubcategoryName || [],
      description: description || "",
      isGlobal: isGlobal || false,
      regions: regions || []
    });

    console.log("Saving new income category:", newIncomeCategory);
    await newIncomeCategory.save();

    console.log("Income category saved successfully");
    return res.status(201).json({
      message: "Income category created successfully.",
      incomeCategory: newIncomeCategory,
    });
  } catch (error) {
    console.error("Error in addIncomeCategory:", error);
    return res.status(500).json({ error: "Failed to create income category." });
  }
};

exports.editIncomeCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      incomeCategoryName, 
      description, 
      incomeSubcategoryName,
      isGlobal,
      regions
    } = req.body;

    console.log("Edit request for category:", id, req.body); // Debug log

    // Validate ID and required fields
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid category ID" });
    }
    if (!incomeCategoryName) {
      return res.status(400).json({ error: "Category name is required" });
    }

    // Check for duplicate name with region-aware validation
    const duplicate = await IncomeCat.findOne({
      incomeCategoryName,
      _id: { $ne: id }
    });
    
    if (duplicate) {
      // If existing category is global, don't allow any duplicates
      if (duplicate.isGlobal === true) {
        console.log("Validation failed: Global category with this name already exists");
        return res.status(400).json({ error: "A global category with this name already exists." });
      }
      
      // If updating to global, don't allow if any category with same name exists
      if (isGlobal === true) {
        console.log("Validation failed: Cannot update to global category - regional category with this name already exists");
        return res.status(400).json({ error: "Cannot update to global category - a regional category with this name already exists." });
      }
      
      // For regional categories, check if there's overlap in assigned regions
      const existingRegions = duplicate.regions || [];
      const newRegions = regions || [];
      
      const hasOverlap = existingRegions.some(region => newRegions.includes(region));
      if (hasOverlap) {
        const overlappingRegions = existingRegions.filter(region => newRegions.includes(region));
        console.log("Validation failed: Category overlap in regions:", overlappingRegions);
        return res.status(400).json({ 
          error: `A category with this name already exists in regions: ${overlappingRegions.join(', ')}` 
        });
      }
      
      console.log("Validation passed: Category name duplicated but assigned to different regions");
    }

    // Prepare update data
    const updateData = {
      incomeCategoryName,
      name: incomeCategoryName,
      description: description || "",
      incomeSubcategoryName: Array.isArray(incomeSubcategoryName) ? incomeSubcategoryName : [],
      isGlobal: isGlobal !== undefined ? isGlobal : false,
      regions: Array.isArray(regions) ? regions : []
    };

    // Update the category
    const updatedCategory = await IncomeCat.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedCategory) {
      return res.status(404).json({ error: "Category not found" });
    }

    res.status(200).json({
      message: "Income category updated successfully",
      category: updatedCategory
    });
  } catch (error) {
    console.error("Error updating income category:", error);
    res.status(500).json({ error: "Failed to update income category" });
  }
};

exports.deleteIncomeCategory = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid category ID" });
    }
    const category = await IncomeCat.findByIdAndDelete(id);
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }
    res.status(200).json({ message: "Category deleted" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to delete income category." });
  }
};

exports.getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid category ID" });
    }
    const category = await IncomeCat.findById(id);
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }
    res.status(200).json(category);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

exports.createCategory = async (req, res) => {
  try {
    console.log("Request body:", req.body);
    const { 
      name, 
      incomeCategoryName, 
      description, 
      incomeSubcategoryName, 
      isGlobal, 
      regions 
    } = req.body;
    const categoryName = incomeCategoryName || name;

    console.log("Extracted fields:", categoryName, incomeSubcategoryName, description, isGlobal, regions);

    if (!categoryName) {
      console.log("Validation failed: Name is required");
      return res.status(400).json({ error: "Name is required" });
    }

    // Check for duplicate category name within the same region scope
    console.log("Checking for existing categories with name:", categoryName);
    
    let existingCategory;
    try {
      existingCategory = await IncomeCat.findOne({
        incomeCategoryName: categoryName
      });
      console.log("Existing category search result:", existingCategory);
    } catch (dbError) {
      console.error("Database error during category lookup:", dbError);
      return res.status(500).json({ 
        error: "Database error during validation", 
        details: dbError.message 
      });
    }

    if (existingCategory) {
      console.log("Found existing category:", existingCategory);
      console.log("Existing category isGlobal:", existingCategory.isGlobal, typeof existingCategory.isGlobal);
      console.log("Existing category regions:", existingCategory.regions);
      console.log("New category isGlobal:", isGlobal, typeof isGlobal);
      console.log("New category regions:", regions);
      
      // If existing category is global, don't allow any duplicates
      if (existingCategory.isGlobal === true) {
        console.log("Validation failed: Global category with this name already exists");
        return res.status(400).json({ error: "A global category with this name already exists." });
      }
      
      // If new category is global, don't allow if any category with same name exists
      if (isGlobal === true) {
        console.log("Validation failed: Cannot create global category - regional category with this name already exists");
        return res.status(400).json({ error: "Cannot create global category - a regional category with this name already exists." });
      }
      
      // For regional categories, check if there's overlap in assigned regions
      const existingRegions = existingCategory.regions || [];
      const newRegions = regions || [];
      
      const hasOverlap = existingRegions.some(region => newRegions.includes(region));
      if (hasOverlap) {
        const overlappingRegions = existingRegions.filter(region => newRegions.includes(region));
        console.log("Validation failed: Category overlap in regions:", overlappingRegions);
        return res.status(400).json({ 
          error: `A category with this name already exists in regions: ${overlappingRegions.join(', ')}` 
        });
      }
      
      console.log("Validation passed: Category name duplicated but assigned to different regions");
    }

    const newCategory = new IncomeCat({
      incomeCategoryName: categoryName,
      name: categoryName, // Add this line to set the name field
      incomeSubcategoryName: incomeSubcategoryName || [],
      description: description || "",
      isGlobal: isGlobal || false,
      regions: regions || []
    });

    console.log("New category object:", newCategory);
    
    // Save with detailed error handling
    try {
      await newCategory.save();
      console.log("Category saved successfully");
    } catch (saveError) {
      console.error("Error saving category to database:", saveError);
      console.error("Save error details:", saveError.message);
      console.error("Save error code:", saveError.code);
      return res.status(400).json({ 
        error: "Failed to save category", 
        details: saveError.message 
      });
    }

    console.log("Category saved successfully");
    return res.status(201).json({
      message: "Category created successfully.",
      category: newCategory,
    });
  } catch (error) {
    console.error("Error in createCategory:", error);
    console.error("Error details:", error.message);
    console.error("Error stack:", error.stack);
    return res.status(500).json({ 
      error: "Failed to create category.", 
      details: error.message 
    });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      incomeCategoryName, 
      description, 
      incomeSubcategoryName, 
      isGlobal, 
      regions 
    } = req.body;
    
    const categoryName = incomeCategoryName || name;
    
    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid category ID" });
    }
    if (!categoryName) {
      return res.status(400).json({ error: "Category name is required" });
    }

    const updateData = {
      incomeCategoryName: categoryName,
      name: categoryName,
      description: description || "",
      incomeSubcategoryName: Array.isArray(incomeSubcategoryName) ? incomeSubcategoryName : [],
      isGlobal: isGlobal !== undefined ? isGlobal : false,
      regions: Array.isArray(regions) ? regions : []
    };

    const category = await IncomeCat.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }
    
    res.status(200).json(category);
  } catch (error) {
    console.error("Error in updateCategory:", error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid category ID" });
    }
    const category = await IncomeCat.findByIdAndDelete(id);
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }
    res.status(200).json({ message: "Category deleted" });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

// Get all income categories
exports.getAllIncomeCategories = async (req, res) => {
  try {
    const incomeCategories = await IncomeCat.find()
      .sort({ incomeCategoryName: 1 });
    
    return res.status(200).json({
      categories: incomeCategories,
      success: true
    });
  } catch (error) {
    console.error("Error in getAllIncomeCategories:", error);
    return res.status(500).json({ 
      error: "Failed to fetch income categories",
      success: false
    });
  }
};

// Get income categories filtered by region-specific subcategories
exports.getAllCategoriesFiltered = async (req, res) => {
  try {
    const { region } = req.query;
    
    console.log(`Fetching income categories filtered by region: ${region || 'All'}`);
    
    // Get all categories
    const allCategories = await IncomeCat.find().sort({ incomeCategoryName: 1 });
    
    if (!region) {
      // If no region specified, return all categories
      return res.status(200).json({
        categories: allCategories,
        success: true
      });
    }
    
    // Filter categories based on available subcategories for the region
    const filteredCategories = [];
    
    for (const category of allCategories) {
      // Get all subcategories for this category first
      const categorySubcategories = await IncomeSubcategory.find({
        $or: [
          { incomeSubcategoryName: { $in: category.incomeSubcategoryName || [] } },
          { name: { $in: category.incomeSubcategoryName || [] } }
        ]
      });
      
      // Filter subcategories based on region availability
      const availableSubcategories = categorySubcategories.filter(subcat => {
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
      
      // No special handling needed - the regular subcategory filtering handles all cases
      
      // If there are available subcategories for this region, include the category
      if (availableSubcategories.length > 0) {
        filteredCategories.push(category);
      } else {
        console.log(`Excluding category ${category.incomeCategoryName} - no subcategories available for region: ${region}`);
      }
    }
    
    console.log(`Returning ${filteredCategories.length} categories out of ${allCategories.length} total categories for region: ${region}`);
    
    return res.status(200).json({
      categories: filteredCategories,
      totalCategories: allCategories.length,
      filteredCategories: filteredCategories.length,
      region: region,
      success: true
    });
  } catch (error) {
    console.error("Error in getAllCategoriesFiltered:", error);
    return res.status(500).json({ 
      error: "Failed to fetch filtered income categories",
      success: false
    });
  }
};



