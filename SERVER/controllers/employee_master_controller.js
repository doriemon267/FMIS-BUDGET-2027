const mongoose = require("mongoose");
const EmployeeMaster = require("../models/EmployeeMaster");
// Create a new employee
const createEmployee = async (req, res) => {
  try {
    const employee = new EmployeeMaster(req.body);
    await employee.save();
    res.status(201).json(employee);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
// Get all employees with pagination, search, and filtering
const getAllEmployees = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", sortField, sortDirection, region, ...filters } = req.query;
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;
    // CRITICAL SECURITY CHECK: Ensure region is provided
    if (!region) {
      return res.status(400).json({
        error: "Region parameter is required",
        message: "Please specify a region to view employees"
      });
    }
    // // DIRECT APPROACH: Use a raw MongoDB query for exact matching
    // This bypasses any potential Mongoose issues
    const db = mongoose.connection.db;
    const collection = db.collection('EmployeeMasters');
    // Build the base query with strict region matching
    let mongoQuery = { Region: region };
    // Add search if provided
    if (search) {
      mongoQuery.$or = [
        { EmployeeFullName: { $regex: search, $options: "i" } },
        { Department: { $regex: search, $options: "i" } },
        { PositionTitle: { $regex: search, $options: "i" } }
      ];
      // If search looks like an ID, add it to the search
      if (/^\w+\d+$/.test(search)) {
        mongoQuery.$or.push({ EmployeeID: { $regex: search, $options: "i" } });
      }
    }
    // Add other filters
    Object.keys(filters).forEach(key => {
      if (filters[key] && key !== 'select' && key !== 'action') {
        mongoQuery[key] = { $regex: filters[key], $options: "i" };
      }
    });
    // );
    // Execute the query directly with MongoDB driver
    const totalRecords = await collection.countDocuments(mongoQuery);
    // Build sort options
    let sortOptions = {};
    if (sortField && sortDirection) {
      sortOptions[sortField] = sortDirection === 'desc' ? -1 : 1;
    } else {
      sortOptions = { EmployeeFullName: 1 };
    }
    // Execute the query with pagination
    const employeesRaw = await collection.find(mongoQuery)
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNumber)
      .toArray();
    // // Convert MongoDB documents to plain objects
    const employees = employeesRaw.map(emp => {
      // Verify the region one more time
      if (emp.Region !== region) {
        // console.error(`SECURITY ERROR: Employee ${emp.EmployeeFullName} has region ${emp.Region} but requested region is ${region}`);
        return null;
      }
      return emp;
    }).filter(Boolean); // Remove any null entries
    // Return the response
    res.status(200).json({
      employees,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limitNumber),
      currentPage: pageNumber,
      region
    });
  } catch (error) {
    console.error("Error in getAllEmployees:", error);
    res.status(500).json({ error: error.message });
  }
};
// Get employee statistics
const getEmployeeStats = async (req, res) => {
  try {
    const { region } = req.query;
    // CRITICAL SECURITY CHECK: Ensure region is provided
    if (!region) {
      return res.status(400).json({
        error: "Region parameter is required",
        message: "Please specify a region to view employee statistics"
      });
    }
    // // Import the correct Employee model
    const Employee = require("../models/EmployeeList");
    // Count total employees for the region with exact match
    const total = await Employee.countDocuments({ Region: region });
    // Count active employees for the region
    const active = await Employee.countDocuments({ 
      Region: region,
      employeeStatus: "Active"
    });
    // Count inactive employees for the region
    const inactive = await Employee.countDocuments({ 
      Region: region,
      employeeStatus: "Inactive"
    });
    // Log for debugging
    // // Get all unique regions for debugging
    const uniqueRegions = await Employee.distinct('Region');
    // res.status(200).json({
    //   total,
    //   active,
    //   inactive,
    //   region
    // });
    res.status(200).json({
      total,
      active,
      inactive,
      region
    });
  } catch (error) {
    console.error("Error in getEmployeeStats:", error);
    res.status(500).json({ error: error.message });
  }
};
// Get employee by ID
const getEmployeeById = async (req, res) => {
  try {
    const employee = await EmployeeMaster.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }
    res.status(200).json(employee);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// Update employee
const updateEmployee = async (req, res) => {
  try {
    const employee = await EmployeeMaster.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }
    res.status(200).json(employee);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
// Delete employee
const deleteEmployee = async (req, res) => {
  try {
    const employee = await EmployeeMaster.findByIdAndDelete(req.params.id);
    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }
    res.status(200).json({ message: "Employee deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// Utility endpoint to check employee regions
const checkEmployeeRegions = async (req, res) => {
  try {
    const { region } = req.query;
    if (!region) {
      return res.status(400).json({ error: "Region parameter is required" });
    }
    // Get a list of all unique regions in the database
    const uniqueRegions = await EmployeeMaster.distinct('Region');
    // // Count employees by region
    const regionCounts = [];
    for (const r of uniqueRegions) {
      if (r) {  // Skip null/undefined regions
        const count = await EmployeeMaster.countDocuments({ Region: r });
        regionCounts.push({ region: r, count });
      }
    }
    // Find employees without a Region field
    const employeesWithoutRegion = await EmployeeMaster.find({ Region: { $exists: false } });
    // // Find employees with empty Region field
    const employeesWithEmptyRegion = await EmployeeMaster.find({ Region: "" });
    // // Find employees with null Region field
    const employeesWithNullRegion = await EmployeeMaster.find({ Region: null });
    // // Find employees with the specified region
    const employeesWithRegion = await EmployeeMaster.find({ Region: region });
    // // Find all employees
    const totalEmployees = await EmployeeMaster.countDocuments();
    // // Find employees with incorrect region format (case sensitivity issues)
    const employeesWithSimilarRegion = await EmployeeMaster.find({ 
      Region: { $regex: new RegExp(region, 'i') },
      Region: { $ne: region }
    });
    // Return the results
    res.status(200).json({
      totalEmployees,
      employeesWithoutRegion: employeesWithoutRegion.length,
      employeesWithEmptyRegion: employeesWithEmptyRegion.length,
      employeesWithNullRegion: employeesWithNullRegion.length,
      employeesWithRegion: employeesWithRegion.length,
      employeesWithSimilarRegion: employeesWithSimilarRegion.length,
      uniqueRegions,
      regionCounts,
      region
    });
  } catch (error) {
    console.error("Error in checkEmployeeRegions:", error);
    res.status(500).json({ error: error.message });
  }
};
// Utility endpoint to fix employee regions
const fixEmployeeRegions = async (req, res) => {
  try {
    const { region, sourceRegion } = req.body;
    if (!region) {
      return res.status(400).json({ error: "Region parameter is required in request body" });
    }
    let results = {};
    // If sourceRegion is provided, update all employees from that region
    if (sourceRegion) {
      const updateFromSourceRegion = await EmployeeMaster.updateMany(
        { Region: sourceRegion },
        { $set: { Region: region } }
      );
      results.updatedFromSourceRegion = updateFromSourceRegion.modifiedCount;
    }
    // Update employees without a Region field
    const updateWithoutRegion = await EmployeeMaster.updateMany(
      { Region: { $exists: false } },
      { $set: { Region: region } }
    );
    results.updatedWithoutRegion = updateWithoutRegion.modifiedCount;
    // Update employees with empty Region field
    const updateEmptyRegion = await EmployeeMaster.updateMany(
      { Region: "" },
      { $set: { Region: region } }
    );
    results.updatedEmptyRegion = updateEmptyRegion.modifiedCount;
    // Update employees with null Region field
    const updateNullRegion = await EmployeeMaster.updateMany(
      { Region: null },
      { $set: { Region: region } }
    );
    results.updatedNullRegion = updateNullRegion.modifiedCount;
    // Fix case sensitivity issues
    const updateCaseSensitivity = await EmployeeMaster.updateMany(
      { 
        Region: { $regex: new RegExp('^' + region + '$', 'i') },
        Region: { $ne: region }
      },
      { $set: { Region: region } }
    );
    results.updatedCaseSensitivity = updateCaseSensitivity.modifiedCount;
    // Return the results
    res.status(200).json({
      message: "Employee regions updated successfully",
      ...results,
      region
    });
  } catch (error) {
    console.error("Error in fixEmployeeRegions:", error);
    res.status(500).json({ error: error.message });
  }
};
module.exports = {
  createEmployee,
  getAllEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
  getEmployeeStats,
  checkEmployeeRegions,
  fixEmployeeRegions
};