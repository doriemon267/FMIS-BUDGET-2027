const PersonnelServices = require("../models/PersonnelServices");
const EmployeeMaster = require("../models/EmployeeList");
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

    // Kunin ang active settings para makuha ang fiscalYear at bagong mga rates
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

    // On-the-fly recalculation para sa dynamic computed fields
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

// Get all personnel services
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
    
    // Add region filter if provided
    if (region) {
      query.region = region;
      console.log(`Filtering personnel by region: ${region}`);
    }
    
    console.log(`Fetching personnel with filters: ${JSON.stringify(query)}`);
    
    // Try to get from PersonnelServices collection first
    let personnelServices = await PersonnelServices.find(query);
    console.log(`Found ${personnelServices.length} personnel records in PersonnelServices for region: ${region || 'All'}, fiscal year: ${targetFiscalYear}`);
    
    // If no results or very few results, try the Employee collection
    if (personnelServices.length === 0) {
      console.log("No results in PersonnelServices, trying Employee collection");
      
      // Build query for Employee collection
      const employeeQuery = {
        employeeStatus: "Active"
      };
      
      // Add region filter if provided (note the capital R in Region for Employee collection)
      if (region) {
        // Use exact match for region
        employeeQuery.Region = region;
        console.log(`Filtering employees by Region (exact match): ${region}`);
      }
      
      console.log("Employee query:", JSON.stringify(employeeQuery));
      const employees = await EmployeeMaster.find(employeeQuery);
      console.log(`Found ${employees.length} employees in Employee collection${region ? ` for region ${region}` : ''}`);
      
      // Map Employee fields to PersonnelServices fields
      personnelServices = employees.map(emp => ({
        employeeNumber: emp.EmployeeID,
        employeeFullName: emp.EmployeeFullName,
        positionTitle: emp.PositionTitle,
        department: emp.Department,
        division: emp.Division,
        region: emp.Region,
        DateOfAppointment: emp.DateOfAppointment,
        DateOfBirth: emp.DateOfBirth,
        employeeStatus: emp.employeeStatus,
        statusOfAppointment: emp.StatusOfAppointment,
        monthlySalary: emp.Rate
      }));
    }
    
    // Debug: Log a sample record if available
    if (personnelServices.length > 0) {
      console.log(`Sample personnel record:`, {
        name: personnelServices[0].employeeFullName || personnelServices[0].EmployeeFullName,
        region: personnelServices[0].region || personnelServices[0].Region,
        fiscalYear: personnelServices[0].fiscalYear
      });
      
      // Log the first few records for debugging
      console.log("Sample records:");
      personnelServices.slice(0, 2).forEach((p, i) => {
        console.log(`Record ${i+1}: ${p.employeeFullName || p.EmployeeFullName}, Region: ${p.region || p.Region}`);
      });
    } else if (region) {
      console.log(`No personnel data found for region: ${region}`);
    }
    
    res.status(200).json(personnelServices);
  } catch (error) {
    console.error("Error fetching personnel services:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get personnel by parameters
const getPersonnelByParams = async (req, res) => {
  try {
    const { fiscalYear, budgetType, processBy, region, status } = req.query;
    
    console.log("Fetching personnel with params:", { fiscalYear, budgetType, processBy, region, status });
    
    const query = {};
    if (fiscalYear) query.fiscalYear = fiscalYear;
    if (budgetType) query.budgetType = budgetType;
    if (processBy) query.processBy = processBy;
    if (region) query.region = region;
    if (status) query.status = status;
    
    const personnel = await PersonnelServices.find(query).lean();
    
    console.log(`Found ${personnel.length} personnel records`);
    res.status(200).json(personnel);
  } catch (error) {
    console.error("Error fetching personnel by params:", error);
    res.status(500).json({ message: "Failed to fetch personnel data" });
  }
};

// getpersonnel hired before June 1988
const getPersonnelHiredBeforeJune1988 = async (req, res) => {
  try {
    const { region } = req.query;
    
    console.log(`Request to get personnel hired before June 1988 with region filter: ${region || 'None'}`);
    
    // First try to get from PersonnelServices collection
    let query = {
      DateOfAppointment: { $lt: new Date("1988-06-01") },
    };
    
    // Add region filter if provided
    if (region) {
      query.region = region;
      console.log(`Filtering personnel hired before June 1988 by region: ${region}`);
    }
    
    let personnel = await PersonnelServices.find(query);
    
    // If no results, try the Employee collection
    if (personnel.length === 0) {
      console.log("No results in PersonnelServices, trying Employee collection");
      
      // Build query for Employee collection
      const employeeQuery = {
        DateOfAppointment: { $lt: new Date("1988-06-01") },
        employeeStatus: "Active"
      };
      
      // Add region filter if provided (note the capital R in Region for Employee collection)
      if (region) {
        // Use exact match for region
        employeeQuery.Region = region;
        console.log(`Filtering employees by Region (exact match): ${region}`);
      }
      
      console.log("Employee query:", JSON.stringify(employeeQuery));
      const employees = await EmployeeMaster.find(employeeQuery);
      console.log(`Found ${employees.length} employees in Employee collection${region ? ` for region ${region}` : ''}`);
      
      // Map Employee fields to PersonnelServices fields
      personnel = employees.map(emp => ({
        employeeNumber: emp.EmployeeID,
        employeeFullName: emp.EmployeeFullName,
        positionTitle: emp.PositionTitle,
        department: emp.Department,
        division: emp.Division,
        region: emp.Region,
        DateOfAppointment: emp.DateOfAppointment,
        DateOfBirth: emp.DateOfBirth,
        employeeStatus: emp.employeeStatus,
        statusOfAppointment: emp.StatusOfAppointment,
        monthlySalary: emp.Rate
      }));
    }
    
    console.log(`Returning ${personnel.length} personnel hired before June 1988${region ? ` in region ${region}` : ''}`);
    
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