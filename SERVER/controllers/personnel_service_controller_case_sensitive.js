const PersonnelServices = require("../models/PersonnelServices");
const Settings = require("../models/Settings");
const {
  numberFilter,
  dateFilter,
  textFilter,
  booleanFilter,
  searchFilter,
} = require("../utils/controller_get_process");

// GET all personnel services with on-the-fly recalculation of computed fields
const getAllPersonnelServices = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      orderBy,
      order = "asc",
      employeeFullName,
      statusOfAppointment,
    } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const skip = (pageNum - 1) * limitNum;

    // Get active settings to determine fiscal year
    const activeSettings = await Settings.findOne({ isActive: true });
    let query = {};

    if (activeSettings) {
      query.fiscalYear = activeSettings.fiscalYear;
    }

    if (search) {
      searchFilter(query, search, [
        "positionTitle",
        "employeeFullName",
        "department",
      ]);
    }

    textFilter(query, { employeeFullName });

    if (statusOfAppointment) {
      query.statusOfAppointment = statusOfAppointment;
    }

    const sortByField = orderBy || "createdAt";
    const sortOrder = order.toLowerCase() === "desc" ? -1 : 1;
    const sortQuery = { [sortByField]: sortOrder };

    let personnelServices = await PersonnelServices.find(query)
      .skip(skip)
      .limit(limitNum)
      .sort(sortQuery);
    const totalRecords = await PersonnelServices.countDocuments(query);

    // On-the-fly recalculation for dynamic computed fields
    if (activeSettings) {
      personnelServices = personnelServices.map((personnel) => {
        // Simplified calculation logic
        const recalculatedTotal = personnel.monthlySalary * 12;
        
        return {
          ...personnel.toObject(),
          Total: recalculatedTotal,
        };
      });
    }

    return res.json({
      personnelServices,
      totalPages: Math.ceil(totalRecords / limitNum),
      currentPage: pageNum,
      totalRecords,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong." });
  }
};

// Get all personnel services - ONLY from PersonnelServices collection
const getAllPerServices = async (req, res) => {
  try {
    const { fiscalYear, region } = req.query;
    
    console.log(`Request to get all personnel with region filter: ${region || 'None'}`);
    
    // Get active settings to determine fiscal year if not provided
    const activeSettings = await Settings.findOne({ isActive: true });
    if (!activeSettings) {
      return res.status(400).json({ 
        message: "Active settings not found", 
        details: "No active settings available" 
      });
    }
    
    // Build query based on parameters
    const query = {};
    
    // Use provided fiscal year or default to active settings fiscal year
    const targetFiscalYear = fiscalYear || activeSettings.fiscalYear;
    if (targetFiscalYear) {
      query.fiscalYear = targetFiscalYear;
    }
    
    // CRITICAL: Add region filter if provided - this is the key filter
    if (region) {
      // Use regex for case-insensitive matching but with exact string
      // The ^ and $ ensure it matches the entire string, not a substring
      query.region = { $regex: new RegExp(`^${region}$`, 'i') };
      console.log(`Filtering personnel by region (case-insensitive exact match): ${region}`);
      
      // Log all available regions for debugging
      const allRegions = await PersonnelServices.distinct('region');
      console.log(`Available regions in database: ${JSON.stringify(allRegions)}`);
      
      // Check if any matching regions exist
      const matchingRegionsCount = await PersonnelServices.countDocuments({ 
        region: { $regex: new RegExp(`^${region}$`, 'i') } 
      });
      console.log(`Found ${matchingRegionsCount} records matching region "${region}" (case-insensitive)`);
      
      // If no matching regions, return empty array
      if (matchingRegionsCount === 0) {
        console.log(`No records found for region "${region}", returning empty array`);
        return res.status(200).json([]);
      }
    } else {
      // If no region is provided, return an empty array
      console.log('No region filter provided, returning empty array');
      return res.status(200).json([]);
    }
    
    console.log(`Fetching personnel with filters: ${JSON.stringify(query)}`);
    
    // Get from PersonnelServices collection ONLY
    const personnelServices = await PersonnelServices.find(query);
    console.log(`Found ${personnelServices.length} personnel records for region: ${region}, fiscal year: ${targetFiscalYear}`);
    
    // Debug: Log a sample record if available
    if (personnelServices.length > 0) {
      console.log(`Sample personnel record:`, {
        name: personnelServices[0].employeeFullName,
        region: personnelServices[0].region,
        fiscalYear: personnelServices[0].fiscalYear
      });
      
      // Log the first few records for debugging
      console.log("Sample records:");
      personnelServices.slice(0, 2).forEach((p, i) => {
        console.log(`Record ${i+1}: ${p.employeeFullName}, Region: ${p.region}`);
      });
    } else {
      console.log(`No personnel data found for region: ${region}`);
    }
    
    res.status(200).json(personnelServices);
  } catch (error) {
    console.error("Error fetching personnel services:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get personnel by parameters - ONLY from PersonnelServices collection
const getPersonnelByParams = async (req, res) => {
  try {
    const { fiscalYear, budgetType, processBy, region, status } = req.query;
    
    console.log("Fetching personnel with params:", { fiscalYear, budgetType, processBy, region, status });
    
    const query = {};
    if (fiscalYear) query.fiscalYear = fiscalYear;
    if (budgetType) query.budgetType = budgetType;
    if (processBy) query.processBy = processBy;
    
    // CRITICAL: Add region filter if provided - this is the key filter
    if (region) {
      // Use regex for case-insensitive matching but with exact string
      query.region = { $regex: new RegExp(`^${region}$`, 'i') };
      console.log(`Filtering personnel by region (case-insensitive exact match): ${region}`);
    } else {
      // If no region is provided, return an empty array
      console.log('No region filter provided, returning empty array');
      return res.status(200).json([]);
    }
    
    if (status) query.status = status;
    
    console.log(`Personnel query: ${JSON.stringify(query)}`);
    const personnel = await PersonnelServices.find(query).lean();
    
    console.log(`Found ${personnel.length} personnel records`);
    res.status(200).json(personnel);
  } catch (error) {
    console.error("Error fetching personnel by params:", error);
    res.status(500).json({ message: "Failed to fetch personnel data" });
  }
};

// Get personnel hired before June 1988 - ONLY from PersonnelServices collection
const getPersonnelHiredBeforeJune1988 = async (req, res) => {
  try {
    const { region } = req.query;
    
    console.log(`Request to get personnel hired before June 1988 with region filter: ${region || 'None'}`);
    
    // Build query for PersonnelServices collection
    const query = {
      DateOfAppointment: { $lt: new Date("1988-06-01") },
    };
    
    // CRITICAL: Add region filter if provided - this is the key filter
    if (region) {
      // Use regex for case-insensitive matching but with exact string
      query.region = { $regex: new RegExp(`^${region}$`, 'i') };
      console.log(`Filtering personnel hired before June 1988 by region (case-insensitive exact match): ${region}`);
    } else {
      // If no region is provided, return an empty array
      console.log('No region filter provided, returning empty array');
      return res.status(200).json([]);
    }
    
    console.log(`Personnel query: ${JSON.stringify(query)}`);
    const personnel = await PersonnelServices.find(query);
    
    console.log(`Returning ${personnel.length} personnel hired before June 1988 in region ${region}`);
    
    // Log the first few records for debugging
    if (personnel.length > 0) {
      console.log("Sample records:");
      personnel.slice(0, 2).forEach((p, i) => {
        console.log(`Record ${i+1}: ${p.employeeFullName}, Region: ${p.region}`);
      });
    }
    
    res.status(200).json(personnel);
  } catch (error) {
    console.error("Error fetching personnel:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = {
  getAllPersonnelServices,
  getAllPerServices,
  getPersonnelByParams,
  PersonnelServices,  
  getPersonnelHiredBeforeJune1988,
};