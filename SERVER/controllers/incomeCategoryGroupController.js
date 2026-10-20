const IncomeCategoryGroup = require("../models/IncomeCategoryGroup");
const IncomeCategory = require("../models/IncomeCategory");
const mongoose = require("mongoose");
const { isValidObjectId } = require("mongoose");

// Get all category groups with pagination
exports.getAllGroups = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      orderBy = "createdAt",
      order = "asc",
    } = req.query;

    let query = {};
    if (search) {
      query.$or = [
        { groupName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const sortOrder = order.toLowerCase() === "desc" ? -1 : 1;
    const sortQuery = { [orderBy]: sortOrder };
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const skip = (pageNum - 1) * limitNum;

    const groups = await IncomeCategoryGroup.find(query)
      .populate("fiscalYears", "fiscalYear budgetType")
      .skip(skip)
      .limit(limitNum)
      .sort(sortQuery);

    const totalRecords = await IncomeCategoryGroup.countDocuments(query);

    return res.json({
      groups,
      totalPages: Math.ceil(totalRecords / limitNum),
      currentPage: pageNum,
      totalRecords,
    });
  } catch (error) {
    console.error("Error fetching groups:", error);
    return res.status(500).json({ error: "Failed to fetch income category groups." });
  }
};

// Get group by ID with categories
exports.getGroupById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid group ID" });
    }

    const group = await IncomeCategoryGroup.findById(id).populate(
      "fiscalYears",
      "fiscalYear budgetType"
    );

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Get all categories in this group
    const categories = await IncomeCategory.find({ groupId: id }).populate(
      "fiscalYears",
      "year budgetType"
    );

    res.json({
      group,
      categories,
    });
  } catch (error) {
    console.error("Error fetching group:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Create new category group
exports.createGroup = async (req, res) => {
  try {
    const { groupName, description, fiscalYears } = req.body;

    if (!groupName) {
      return res.status(400).json({ error: "Group name is required" });
    }

    const newGroup = new IncomeCategoryGroup({
      groupName: groupName.trim(),
      description: description || "",
      fiscalYears: fiscalYears || [],
    });

    await newGroup.save();
    await newGroup.populate("fiscalYears", "fiscalYear budgetType");

    return res.status(201).json({
      message: "Category group created successfully.",
      group: newGroup,
    });
  } catch (error) {
    console.error("Error creating group:", error);
    return res.status(500).json({ error: "Failed to create category group." });
  }
};

// Update category group
exports.updateGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const { groupName, description, fiscalYears } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid group ID" });
    }

    if (!groupName) {
      return res.status(400).json({ error: "Group name is required" });
    }

    const updateData = {
      groupName: groupName.trim(),
      description: description || "",
      fiscalYears: fiscalYears || [],
      updatedAt: new Date(),
    };

    const updatedGroup = await IncomeCategoryGroup.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate("fiscalYears", "fiscalYear budgetType");

    if (!updatedGroup) {
      return res.status(404).json({ error: "Group not found" });
    }

    res.status(200).json({
      message: "Category group updated successfully",
      group: updatedGroup,
    });
  } catch (error) {
    console.error("Error updating group:", error);
    res.status(500).json({ error: "Failed to update category group" });
  }
};

// Delete category group
exports.deleteGroup = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid group ID" });
    }

    // Check if group has categories
    const categoriesCount = await IncomeCategory.countDocuments({ groupId: id });
    if (categoriesCount > 0) {
      return res.status(400).json({
        error: `Cannot delete group with ${categoriesCount} category(ies). Remove categories first.`,
      });
    }

    const group = await IncomeCategoryGroup.findByIdAndDelete(id);

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    res.json({ message: "Category group deleted successfully" });
  } catch (error) {
    console.error("Error deleting group:", error);
    res.status(500).json({ error: "Failed to delete category group" });
  }
};

// Get categories by group with pagination
exports.getCategoriesByGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid group ID" });
    }

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const skip = (pageNum - 1) * limitNum;

    // Verify group exists
    const group = await IncomeCategoryGroup.findById(id);
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    const categories = await IncomeCategory.find({ groupId: id })
      .populate("fiscalYears", "year budgetType")
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 });

    const totalRecords = await IncomeCategory.countDocuments({ groupId: id });

    res.json({
      categories,
      totalPages: Math.ceil(totalRecords / limitNum),
      currentPage: pageNum,
      totalRecords,
    });
  } catch (error) {
    console.error("Error fetching categories by group:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
};

// Get grouped categories summary (for page display)
exports.getGroupedCategoriesSummary = async (req, res) => {
  try {
    const groups = await IncomeCategoryGroup.find()
      .populate("fiscalYears", "fiscalYear budgetType")
      .sort({ createdAt: -1 });

    const summary = await Promise.all(
      groups.map(async (group) => {
        const categoriesCount = await IncomeCategory.countDocuments({ groupId: group._id });
        return {
          ...group.toObject(),
          categoriesCount,
        };
      })
    );

    res.json({ groups: summary });
  } catch (error) {
    console.error("Error fetching grouped categories summary:", error);
    res.status(500).json({ error: "Failed to fetch grouped categories" });
  }
};