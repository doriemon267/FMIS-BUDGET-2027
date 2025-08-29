const mongoose = require("mongoose");
const Employee = require("../models/EmployeeList");
const PersonnelServices = require("../models/personnelServices");
const {
  numberFilter,
  dateFilter,
  textFilter,
  booleanFilter,
} = require("../utils/controller_get_process");

exports.getAllEmployees = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      orderBy,
      order = "asc",
      operator,
      Department,
      positionTitle,
      Division,
      Section,
      region, // Changed from Region to region to match client-side parameter
      StatusOfAppointment,
      sg,
      step,
      jg,
      Rate,
      charging,
      employeeID,
      EmployeeFullName,
      DateOfAppointment,
      DateOfBirth,
      Status,
    } = req.query;

    // CRITICAL SECURITY CHECK: Ensure region is provided
    if (!region) {
      // console.log("ERROR: No region specified in request");
      return res.status(400).json({ 
        error: "Region parameter is required", 
        message: "Please specify a region to view employees" 
      });
    }
    
    // console.log(`Request to get employees for region: ${region}`);

    // Start with a strict region filter
    let query = { Region: region };

    // Add search functionality if provided
    if (search) {
      query = {
        ...query,
        $and: [
          { Region: region }, // Keep the region filter as top priority
          {
            $or: [
              { Department: { $regex: search, $options: "i" } },
              { positionTitle: { $regex: search, $options: "i" } },
              { Division: { $regex: search, $options: "i" } },
              { Section: { $regex: search, $options: "i" } },
              { StatusOfAppointment: { $regex: search, $options: "i" } },
              { EmployeeFullName: { $regex: search, $options: "i" } },
              { employeeID: { $regex: search, $options: "i" } },
              { Status: { $regex: search, $options: "i" } },
            ]
          }
        ]
      };
    }

    // Apply other filters but ensure region filter is preserved
    const filterParams = {
      positionTitle,
      StatusOfAppointment,
      jg,
      charging,
      employeeID,
      EmployeeFullName,
      Department,
      Division,
      Section,
      Status,
    };
    
    // Remove undefined values
    Object.keys(filterParams).forEach(key => {
      if (filterParams[key] === undefined) {
        delete filterParams[key];
      }
    });
    
    // Apply text filters if there are any
    if (Object.keys(filterParams).length > 0) {
      if (!query.$and) {
        query.$and = [{ Region: region }];
      }
      
      const textFilterQuery = {};
      textFilter(textFilterQuery, filterParams);
      
      if (Object.keys(textFilterQuery).length > 0) {
        query.$and.push(textFilterQuery);
      }
    }
    
    // Apply number filters
    const numberParams = { sg, step, Rate };
    Object.keys(numberParams).forEach(key => {
      if (numberParams[key] === undefined) {
        delete numberParams[key];
      }
    });
    
    if (Object.keys(numberParams).length > 0) {
      const numberFilterQuery = {};
      numberFilter(numberFilterQuery, numberParams, operator);
      
      if (Object.keys(numberFilterQuery).length > 0) {
        if (!query.$and) {
          query.$and = [{ Region: region }];
        }
        query.$and.push(numberFilterQuery);
      }
    }
    
    // Apply date filters
    const dateParams = { DateOfAppointment, DateOfBirth };
    Object.keys(dateParams).forEach(key => {
      if (dateParams[key] === undefined) {
        delete dateParams[key];
      }
    });
    
    if (Object.keys(dateParams).length > 0) {
      const dateFilterQuery = {};
      dateFilter(dateFilterQuery, dateParams);
      
      if (Object.keys(dateFilterQuery).length > 0) {
        if (!query.$and) {
          query.$and = [{ Region: region }];
        }
        query.$and.push(dateFilterQuery);
      }
    }

    // console.log("Final query:", JSON.stringify(query));

    const sortByField = orderBy || "createdAt";
    const sortOrder = order.toLowerCase() === "desc" ? -1 : 1;
    const sortQuery = { [sortByField]: sortOrder };

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const skip = (pageNum - 1) * limitNum;

    // DIRECT APPROACH: Use the raw MongoDB driver to ensure we're using the correct collection
    const db = mongoose.connection.db;
    const collection = db.collection('employees'); // This is the actual collection name
    
    // Execute the query
    const employees = await collection.find(query)
      .skip(skip)
      .limit(limitNum)
      .sort(sortQuery)
      .toArray();
      
    // console.log(`Found ${employees.length} employees for region ${region}`);
    
    // Double-check that all returned employees belong to the requested region
    const verifiedEmployees = employees.filter(emp => emp.Region === region);
    
    if (employees.length !== verifiedEmployees.length) {
      console.error(`SECURITY WARNING: Found ${employees.length - verifiedEmployees.length} employees with incorrect region`);
    }
    
    // Get total count for pagination
    const totalRecords = await collection.countDocuments(query);

    return res.json({
      employees: verifiedEmployees,
      totalPages: Math.ceil(totalRecords / limitNum),
      currentPage: pageNum,
      totalRecords: totalRecords,
      region
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Something went wrong." });
  }
};

exports.addEmployee = async (req, res) => {
  try {
    // If fiscal year is not provided in the request, get it from active settings
    if (!req.body.fiscalYear) {
      const Settings = require("../models/Settings");
      const activeSettings = await Settings.findOne({ isActive: true }).lean();
      
      if (!activeSettings?.fiscalYear) {
        return res.status(400).json({ 
          error: "No active fiscal year found",
          message: "Please set up the fiscal year in settings first"
        });
      }
      
      req.body.fiscalYear = activeSettings.fiscalYear;
    }

    // Validate Region field
    if (!req.body.Region) {
      return res.status(400).json({
        error: "Region is required",
        message: "Please specify a region for the employee"
      });
    }

    const newEmployee = new Employee(req.body);
    await newEmployee.save();

    // console.log(`Created new employee ${newEmployee.EmployeeFullName} in region ${newEmployee.Region} for fiscal year ${newEmployee.fiscalYear}`);

    return res.status(201).json({
      message: "Employee created successfully.",
      employee: newEmployee,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to create employee." });
  }
};

exports.editEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedEmployee = await Employee.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updatedEmployee) {
      return res.status(404).json({ error: "Employee not found." });
    }

    return res.json({
      message: "Employee updated successfully.",
      employee: updatedEmployee,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to update employee." });
  }
};

exports.deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedEmployee = await Employee.findByIdAndDelete(id);
    if (!deletedEmployee) {
      return res.status(404).json({ error: "Employee not found." });
    }

    return res.json({ message: "Employee deleted successfully." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to delete employee." });
  }
};

exports.getPersonnels = async (req, res) => {
  try {
    const { search } = req.query;

    let query = {};

    if (search) {
      query.$or = [
        { EmployeeFullName: { $regex: search, $options: "i" } },
        { employeeFullName: { $regex: search, $options: "i" } },
        { employeeID: { $regex: search, $options: "i" } },
        { employeeNumber: { $regex: search, $options: "i" } },
        { Department: { $regex: search, $options: "i" } },
        { department: { $regex: search, $options: "i" } },
        { positionTitle: { $regex: search, $options: "i" } },
        { PositionTitle: { $regex: search, $options: "i" } },
        { Status: { $regex: search, $options: "i" } },
      ];
    }

    const employees = await PersonnelServices.find(query).limit(20);

    const formattedEmployees = employees.map((emp) => ({
      _id: emp._id,
      employeeNumber: emp.employeeNumber,
      employeeFullName: emp.EmployeeFullName || emp.employeeFullName || "",
      positionTitle: emp.PositionTitle || emp.positionTitle || "",
      department: emp.Department || emp.department || "",
      status: emp.Status || "Active",
    }));

    return res.json(formattedEmployees);
  } catch (error) {
    console.error("Error in getPersonnels:", error);
    return res.status(500).json({ error: "Failed to fetch personnel data" });
  }
};

// Get employees eligible for loyalty pay based on years of service
exports.getEligibleForLoyaltyPay = async (req, res) => {
  try {
    // console.log("Getting eligible employees for loyalty pay");
    
    // Get the region and fiscal year from the query parameters
    const { region, fiscalYear: requestedFiscalYear } = req.query;
    
    if (!region) {
      return res.status(400).json({ 
        error: "Region parameter is required", 
        message: "Please specify a region to view eligible employees" 
      });
    }
    
    // console.log(`Filtering eligible employees for region: ${region}`);

    // Get active settings to determine the fiscal year
    const Settings = require("../models/Settings");
    const {
      calculateLoyaltyPayYearsOfService,
      getEligibleLoyaltyPayYear
    } = require("../utils/loyaltyPayUtils");

    // If a specific fiscal year was requested, find those settings
    // Otherwise use the active settings
    let settings;
    if (requestedFiscalYear) {
      settings = await Settings.findOne({ fiscalYear: requestedFiscalYear }).lean();
      if (!settings) {
        return res.status(404).json({
          error: "Fiscal year settings not found",
          message: `No settings found for fiscal year ${requestedFiscalYear}`
        });
      }
    } else {
      settings = await Settings.findOne({ isActive: true }).lean();
    }

    if (!settings) {
      return res.status(404).json({
        error: "Settings not found",
        message: "No active settings found in the system"
      });
    }

    // Use fiscal year from settings
    const fiscalYear = parseInt(settings.fiscalYear);
    
    // console.log(`Using fiscal year: ${fiscalYear}`);

    // Get cutoff date from settings
    const cutoffDate = settings?.loyaltyPay?.cutoffDate || "06-22";
    // console.log(`Using loyalty pay cutoff date: ${cutoffDate}`);

    // First try to get data from PersonnelServices model, filtered by region
    const personnelServices = await PersonnelServices.find({
      employeeStatus: "Active",
      DateOfAppointment: { $exists: true, $ne: null },
      region: region // Filter by the specified region
    }).lean();

    // console.log(`Found ${personnelServices.length} active personnel services records with DateOfAppointment in region ${region}`);

    // Filter employees based on years of service with June 22 cutoff
    const eligibleEmployees = [];

    for (const employee of personnelServices) {
      if (!employee.DateOfAppointment) continue;

      // Calculate years of service with June 22 cutoff
      const yearsOfService = calculateLoyaltyPayYearsOfService(
        employee.DateOfAppointment,
        fiscalYear.toString(),
        cutoffDate
      );

      // Get the eligible loyalty pay year (milestone) - must be exact match
      const eligibleYear = getEligibleLoyaltyPayYear(yearsOfService);

      // console.log(`Employee: ${employee.employeeFullName}, Years of Service: ${yearsOfService}, Eligible Year: ${eligibleYear ? eligibleYear : 'Not eligible - not an exact milestone year'}`);

      // Only include employees who have reached a milestone year
      if (eligibleYear !== null) {
        // Check if this employee already received loyalty pay for this milestone in this fiscal year
        const LoyaltyPay = require("../models/loyaltyPay");
        const existingRecord = await LoyaltyPay.findOne({
          employeeNumber: employee.employeeNumber,
          yearsInService: eligibleYear,
          fiscalYear: fiscalYear.toString()
        }).lean();

        if (!existingRecord) {
          eligibleEmployees.push({
            ...employee,
            yearsInService: eligibleYear,
            actualYearsOfService: yearsOfService // Include actual years for reference
          });
        } else {
          // console.log(`Employee ${employee.employeeFullName} already received loyalty pay for ${eligibleYear} years in fiscal year ${fiscalYear}`);
        }
      }
    }
    
    // console.log(`Found ${eligibleEmployees.length} eligible employees in region ${region} for fiscal year ${fiscalYear}`);
    
    // Format the response
    const formattedEmployees = eligibleEmployees.map(emp => ({
      _id: emp._id,
      employeeNumber: emp.employeeNumber,
      employeeFullName: emp.employeeFullName,
      positionTitle: emp.positionTitle,
      department: emp.department,
      division: emp.division,
      region: emp.region,
      dateOfAppointment: emp.DateOfAppointment,
      yearsInService: emp.yearsInService,
      actualYearsOfService: emp.actualYearsOfService,
      cutoffDate: cutoffDate, // Include cutoff date for reference
      fiscalYear: fiscalYear.toString() // Include fiscal year for reference
    }));
    
    return res.status(200).json(formattedEmployees);
  } catch (err) {
    console.error("Error getting eligible employees for loyalty pay:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get employees eligible for retirement
// Get employee statistics
exports.getEmployeeStats = async (req, res) => {
  try {
    const { region } = req.query;
    
    // CRITICAL SECURITY CHECK: Ensure region is provided
    if (!region) {
      // console.log("ERROR: No region specified in stats request");
      return res.status(400).json({ 
        error: "Region parameter is required", 
        message: "Please specify a region to view employee statistics" 
      });
    }
    
    // console.log(`Request to get stats for region: ${region}`);
    
    // DIRECT APPROACH: Use the raw MongoDB driver to ensure we're using the correct collection
    const db = mongoose.connection.db;
    const collection = db.collection('employees'); // This is the actual collection name
    
    // Count total employees for the region with exact match
    const total = await collection.countDocuments({ Region: region });
    
    // Count active employees for the region
    const active = await collection.countDocuments({ 
      Region: region,
      employeeStatus: "Active"
    });
    
    // Count inactive employees for the region
    const inactive = await collection.countDocuments({ 
      Region: region,
      employeeStatus: "Inactive"
    });
    
    // Log for debugging
    // console.log(`Stats for region ${region}: Total=${total}, Active=${active}, Inactive=${inactive}`);
    
    // Get all unique regions for debugging
    const uniqueRegions = await collection.distinct('Region');
    // console.log("All regions in database:", uniqueRegions);
    
    // Get counts by region for debugging
    // console.log("COUNTS BY REGION:");
    for (const r of uniqueRegions) {
      if (r) {
        const count = await collection.countDocuments({ Region: r });
        // console.log(`- ${r}: ${count} employees`);
      }
    }
    
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

exports.getEligibleForRetirement = async (req, res) => {
  try {
    console.log("Getting eligible employees for retirement");
    
    // Get active settings to determine the fiscal year
    const Settings = require("../models/Settings");
    const activeSettings = await Settings.findOne({ isActive: true }).lean();
    
    // Use fiscal year from settings, or fallback to current year
    const fiscalYear = activeSettings?.fiscalYear 
      ? parseInt(activeSettings.fiscalYear) 
      : new Date().getFullYear();
    
    console.log(`Using fiscal year: ${fiscalYear}`);
    const currentDate = new Date();
    
    // First try to get data from PersonnelServices model
    const personnelServices = await PersonnelServices.find({
      employeeStatus: "Active",
      DateOfAppointment: { $exists: true, $ne: null },
      DateOfBirth: { $exists: true, $ne: null }
    }).lean();

    console.log(`Found ${personnelServices.length} active personnel services records with DateOfAppointment and DateOfBirth`);
    
    // Filter employees based on age and years of service
    const eligibleEmployees = [];
    
    for (const employee of personnelServices) {
      if (!employee.DateOfAppointment || !employee.DateOfBirth) continue;

      // Calculate age more accurately
      const birthDate = new Date(employee.DateOfBirth);
      let age = currentDate.getFullYear() - birthDate.getFullYear();
      const monthDiff = currentDate.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && currentDate.getDate() < birthDate.getDate())) {
        age--;
      }

      // Calculate years of service more accurately
      const appointmentDate = new Date(employee.DateOfAppointment);
      let yearsOfService = currentDate.getFullYear() - appointmentDate.getFullYear();
      const serviceMonthDiff = currentDate.getMonth() - appointmentDate.getMonth();
      if (serviceMonthDiff < 0 || (serviceMonthDiff === 0 && currentDate.getDate() < appointmentDate.getDate())) {
        yearsOfService--;
      }

      // Check if employee is eligible for compulsory retirement (65 years old)
      const isEligibleForCompulsory = age >= 65;

      // Check if employee is eligible for optional retirement (60-64 years old with at least 15 years of service)
      const isEligibleForOptional = (age >= 60 && age < 65) && yearsOfService >= 15;

      // console.log(`Employee: ${employee.employeeFullName}, Age: ${age}, Years of Service: ${yearsOfService}, Birth: ${birthDate.toDateString()}, Appointment: ${appointmentDate.toDateString()}`);

      // Include employees who are eligible for either type of retirement
      if (isEligibleForCompulsory || isEligibleForOptional) {
        eligibleEmployees.push({
          ...employee,
          age,
          yearsOfService,
          retirementType: isEligibleForCompulsory ? "Compulsory" : "Optional",
          earnedLeaves: employee.earnedLeaves || 0 // Include earned leaves for terminal leave calculation
        });
      }
    }
    
    console.log(`Found ${eligibleEmployees.length} eligible employees for retirement from PersonnelServices`);

    // We now use ONLY PersonnelServices (no EmployeeList fallback)
    
    // Format the response with proper employee number format
    const formattedEmployees = eligibleEmployees.map(emp => {
      // Get the correct employee number
      let employeeNum = "";
      
      // Try to get the employee number from various possible fields
      if (emp.employeeNumber) {
        employeeNum = emp.employeeNumber;
      } else if (emp.EmployeeID) {
        employeeNum = emp.EmployeeID;
      } else if (emp.employeeID) {
        employeeNum = emp.employeeID;
      }
      
      // console.log(`Employee ${emp.employeeFullName || emp.EmployeeFullName}: employee number = ${employeeNum}`);
      
      return {
        _id: emp._id,
        employeeNumber: employeeNum, // This should be a string like "336155"
        employeeFullName: emp.employeeFullName || emp.EmployeeFullName || "",
        positionTitle: emp.positionTitle || emp.PositionTitle || "",
        department: emp.department || emp.Department || "",
        division: emp.division || emp.Division || "",
        region: emp.region || emp.Region || "",
        age: emp.age,
        yearsOfService: emp.yearsOfService,
        retirementType: emp.retirementType,
        earnedLeaves: emp.earnedLeaves || 0 // Include earned leaves for terminal leave calculation
      };
    });

    // Log the formatted employees to verify the employee number format
    // console.log("Employees with formatted numbers:", formattedEmployees.map(e => ({
    //   name: e.employeeFullName,
    //   employeeNumber: e.employeeNumber // Should be like "336155"
    // })));

    return res.status(200).json(formattedEmployees);
  } catch (err) {
    console.error("Error getting eligible employees for retirement:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};
