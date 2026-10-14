const Category = require("../models/Category");
const ChartOfAccounts = require("../models/chartOfAccounts");
// Get all categories
exports.getAllCategories = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      orderBy,
      order = "asc",
      operator,
      categoryName,
      sublineItems,
      createdAt,
    } = req.query;
    let query = {};
    // **Global Search (Excluding Date)**
    if (search && search.split("-").length !== 3) {
      query.$or = [
        { categoryName: { $regex: search, $options: "i" } },
        { sublineItems: { $regex: search, $options: "i" } },
      ];
    }
    // **Specific Field Search (Applied via Table Filters)**
    if (categoryName) {
      query.categoryName = { $regex: categoryName, $options: "i" };
    }
    if (sublineItems) {
      query.sublineItems = { $regex: sublineItems, $options: "i" };
    }
    if (createdAt) {
      query.createdAt = { $gte: new Date(createdAt) };
    }
    // **Sorting**
    const sortByField = orderBy || "createdAt";
    const sortOrder = order.toLowerCase() === "desc" ? -1 : 1;
    const sortQuery = { [sortByField]: sortOrder };
    // **Pagination**
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const skip = (pageNum - 1) * limitNum;
    // **Fetch filtered, paginated, and sorted data**
    const categories = await Category.find(query)
      .skip(skip)
      .limit(limitNum)
      .sort(sortQuery);
    const totalRecords = await Category.countDocuments(query);
    return res.json({
      categories,
      totalPages: Math.ceil(totalRecords / limitNum),
      currentPage: pageNum,
      totalRecords,
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return res.status(500).json({ error: "Failed to retrieve categories." });
  }
};
// ✅ Fetch all available subline items (comprehensive list for Capital Outlay)
exports.getSublineItems = async (req, res) => {
  try {
    // Get distinct subline items from ChartOfAccounts
    const dbItems = await ChartOfAccounts.distinct("sublineItem");
    // Comprehensive list of Capital Outlay subline items based on government standards
    const CapitalOutlaySublineItems = [
      // Infrastructure Outlay
      "Infrastructure Outlay",
      // Building and Other Structures
      "Building and Other Structures",
      "Buildings",
      "School Buildings",
      "Hospitals and Health Centers",
      "Markets",
      "Slaughterhouses",
      "Other Structures",
      // Machinery and Equipment
      "Machinery and Equipment",
      "Machinery and Equipment Outlay",
      "Office Equipment",
      "Information and Communications Technology Equipment",
      "Technical and Scientific Equipment",
      "Machinery",
      "Medical Equipment",
      "Agricultural and Forestry Equipment",
      "Communications Equipment",
      "Disaster Response and Rescue Equipment",
      "Military, Police and Security Equipment",
      "Sports Equipment",
      // Transportation Equipment
      "Transportation Equipment",
      "Transportation Equipment Outlay",
      "Motor Vehicles",
      "Trains",
      "Aircraft and Aircrafts Ground Equipment",
      "Watercrafts",
      // Furniture, Fixtures and Books
      "Furniture, Fixtures and Books",
      "Furniture, Fixtures and Books Outlay",
      "Furniture Fixture and Books",
      "Furniture and Fixtures",
      "Books",
      "Printed Materials",
      // Land
      "Land",
      "Land Rights",
      // Land Improvements
      "Land Improvements",
      "Site Development",
      "Landscaping",
      // Other Capital Outlay Items
      "Intangible Assets",
      "Computer Software",
      "Patents and Copyrights",
      "Construction in Progress",
      "Construction in Progress- Construction Contracts",
      "Repairs and Maintenance",
      // Specific Infrastructure Types
      "Roads and Bridges",
      "Flood Control Systems",
      "Water Supply Systems",
      "Irrigation Systems",
      "Sewerage Systems",
      "Power Systems",
      "Telecommunications Infrastructure",
      // Specialized Equipment
      "Laboratory Equipment",
      "Workshop Equipment",
      "Kitchen Equipment",
      "Laundry Equipment",
      "Cleaning Equipment",
      "Security Equipment",
      "Fire Safety Equipment"
    ];
    // Combine database items with comprehensive list and remove duplicates
    const allItems = [...new Set([...dbItems, ...CapitalOutlaySublineItems])];
    // Sort alphabetically
    const sortedItems = allItems.filter(item => item && item.trim()).sort();
    res.status(200).json({
      sublineItems: sortedItems,
      fromDatabase: dbItems.length,
      total: sortedItems.length
    });
  } catch (error) {
    console.error("Error fetching subline items:", error);
    res.status(500).json({ error: "Failed to fetch subline items." });
  }
};
// ✅ Add a new category (with optional sublineItems)
exports.addCategory = async (req, res) => {
  try {
    const { categoryName, sublineItems } = req.body;
    if (!categoryName) {
      return res.status(400).json({ error: "Category name is required." });
    }
    const newCategory = new Category({
      categoryName,
      sublineItems: sublineItems || [],
    });
    await newCategory.save();
    res.status(201).json({
      message: "Category added successfully",
      category: newCategory,
    });
  } catch (error) {
    console.error("Error adding category:", error);
    res.status(500).json({ error: "Failed to add category." });
  }
};
// ✅ Edit an existing category (including sublineItems)
exports.editCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { categoryName, sublineItems } = req.body;
    if (!categoryName) {
      return res.status(400).json({ error: "Category name is required." });
    }
    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      {
        categoryName,
        sublineItems: sublineItems || [],
      },
      { new: true, runValidators: true }
    );
    if (!updatedCategory) {
      return res.status(404).json({ error: "Category not found." });
    }
    res.status(200).json({
      message: "Category updated successfully",
      category: updatedCategory,
    });
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({ error: "Failed to update category." });
  }
};
// ✅ Delete a category
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedCategory = await Category.findByIdAndDelete(id);
    if (!deletedCategory) {
      return res.status(404).json({ error: "Category not found." });
    }
    res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({ error: "Failed to delete category." });
  }
};
