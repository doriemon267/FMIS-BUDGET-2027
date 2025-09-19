const COSPersonnel = require("../models/COSPersonnel");
const EmployeeMaster = require("../models/EmployeeList");
const Settings = require("../models/Settings");
const { searchFilter, textFilter } = require("../utils/controller_get_process");
exports.bulkAddCOSPersonnel = async (req, res) => {
  try {
    const { statusOfAppointment, region } = req.body;

    // Get hierarchical filters from middleware (support both hierarchical and submission workflow)
    const hierarchicalFilters = req.hierarchicalFilters || req.submissionWorkflowFilters || {};

    // Get user's assignment level to determine access restrictions
    const assignment = req.userHierarchicalAssignment || {};
    const userLevel = assignment.assignmentLevel || 'NONE';

    // Map hierarchical filters to database field names
    const mapFiltersToDb = (filters) => {
      const mapped = {};

      // Handle $and conditions from middleware
      if (filters.$and && Array.isArray(filters.$and)) {
        mapped.$and = filters.$and.map(condition => {
          const conditionMapped = {};
          if (condition.region) conditionMapped.Region = condition.region;
          if (condition.department) conditionMapped.Department = condition.department;
          if (condition.division) conditionMapped.Division = condition.division;
          return conditionMapped;
        });
        return mapped;
      }

      // Handle simple key-value filters
      if (filters.region) mapped.Region = filters.region;
      if (filters.department) mapped.Department = filters.department;
      if (filters.division) mapped.Division = filters.division;
      return mapped;
    };

    const dbHierarchicalFilters = mapFiltersToDb(hierarchicalFilters);

    // CRITICAL SECURITY CHECK: Ensure region is provided
    if (!region) {
      return res.status(400).json({
        error: "Region parameter is required",
        message: "Please specify a region to add COS personnel"
      });
    }
    if (!statusOfAppointment || statusOfAppointment !== "COS") {
      return res.status(400).json({ message: "Missing or invalid required field: statusOfAppointment" });
    }
    const activeSettings = await Settings.findOne({ isActive: true });
    if (!activeSettings) {
      return res.status(400).json({ message: "Active settings not found" });
    }
    const fiscalYear = activeSettings.fiscalYear;
    const budgetType = activeSettings.budgetType;

    // Build employee query with hierarchical filters
    let employeeQuery = {
      StatusOfAppointment: statusOfAppointment,
      Region: region
    };

    // Apply hierarchical filters to employee query
    if (Object.keys(dbHierarchicalFilters).length > 0) {
      if (dbHierarchicalFilters.$and) {
        employeeQuery = {
          $and: [
            employeeQuery,
            ...dbHierarchicalFilters.$and
          ]
        };
      } else {
        employeeQuery = {
          ...employeeQuery,
          ...dbHierarchicalFilters
        };
      }
    }

    // Log what employees the user can process for transparency
    console.log(`User ${req.user.id} (${assignment?.assignmentLevel || 'UNKNOWN'}) attempting to process COS employees with filters:`, JSON.stringify(dbHierarchicalFilters, null, 2));

    // Only get employees within user's hierarchical scope
    const employees = await EmployeeMaster.find(employeeQuery);
    console.log(`Found ${employees.length} COS employees within user's hierarchical scope`);

    if (employees.length === 0) {
      return res.status(200).json({
        message: `No COS employees found within your access scope (Region: ${region}).`,
        accessLevel: assignment?.assignmentLevel || 'UNKNOWN',
        hierarchicalScope: dbHierarchicalFilters
      });
    }
    const checks = await Promise.all(
      employees.map(async (employee) => {
        // Double-check that employee belongs to the specified region
        if (employee.Region !== region) {
          console.error(`SECURITY WARNING: Employee ${employee.EmployeeFullName} has region ${employee.Region} but requested region is ${region}`);
          return null;
        }

        // Additional validation: Check if Division user is processing employee from their division
        if (assignment?.assignmentLevel === 'DIVISION' && employee.Division !== assignment.divisions?.[0]) {
          console.warn(`WORKFLOW WARNING: Division user ${req.user.id} processing employee ${employee.EmployeeFullName} from division ${employee.Division} (user's division: ${assignment.divisions?.[0]})`);
        }

        const existingRecord = await COSPersonnel.findOne({
          employeeNumber: employee.EmployeeID,
          fiscalYear: fiscalYear,
        });
        
        // Additional check for VACANT positions using ItemNumber or position details
        const isVacant = employee.EmployeeFullName && 
                        employee.EmployeeFullName.toString().toUpperCase() === 'VACANT';
        
        let existingVacantRecord = null;
        if (isVacant && !existingRecord) {
          const duplicateConditions = [];
          
          // Check by ItemNumber if available (most reliable)
          if (employee.ItemNumber && employee.ItemNumber.trim() !== '') {
            duplicateConditions.push({ itemNumber: employee.ItemNumber });
          }
          
          // Always include position details as fallback
          duplicateConditions.push({
            positionTitle: employee.PositionTitle,
            department: employee.Department,
            division: employee.Division || null,
            section: employee.Section || null,
            gradelevel_SG: employee.SG?.toString() || "",
            fiscalYear: fiscalYear,
            region: employee.Region,
            employeeFullName: "VACANT"
          });
          
          existingVacantRecord = await COSPersonnel.findOne({
            $or: duplicateConditions
          });
        }
        
        if (existingRecord || existingVacantRecord) {
          console.log(`Skipping ${isVacant ? 'VACANT position' : 'employee'} ${employee.EmployeeFullName} - already exists`);
          return null;
        }
        
        // Check if essential required fields are present (SG and Rate are still required)
        if (!employee.SG || !employee.Rate) {
          // Skip employees with missing essential required fields
          return null;
        }
        
        const monthlySalary = employee.Rate;
        const annualSalary = monthlySalary * 12;
        return {
          department: employee.Department,
          region: employee.Region,
          budgetType: budgetType,
          processBy: req.body.processBy,
          processDate: new Date(),
          fiscalYear: fiscalYear,
          positionTitle: employee.PositionTitle,
          itemNumber: employee.ItemNumber || "",
          gradelevel_SG: employee.SG.toString(),
          step: employee.Step || null,
          gradelevel_JG: employee.JG ? employee.JG.toString() : "",
          employeeFullName: employee.EmployeeFullName,
          employeeNumber: employee.EmployeeID,
          division: employee.Division,
          statusOfAppointment: employee.StatusOfAppointment,
          monthlySalary: monthlySalary,
          annualSalary: annualSalary,
          Total: annualSalary,
        };
      })
    );
    const cosPersonnelData = checks.filter((record) => record !== null);
    if (cosPersonnelData.length > 0) {
      const addedRecords = await COSPersonnel.insertMany(cosPersonnelData);
      return res.status(200).json({
        addedRecords,
        region,
        count: addedRecords.length,
        processedBy: {
          userId: req.user.id,
          userLevel: assignment?.assignmentLevel || 'UNKNOWN',
          accessScope: dbHierarchicalFilters,
          timestamp: new Date()
        },
        message: `${addedRecords.length} COS personnel records added successfully by ${assignment?.assignmentLevel || 'Unknown'} level user`
      });
    } else {
      return res.status(200).json({
        message: "No new COS personnel to add.",
        region,
        accessLevel: assignment?.assignmentLevel || 'UNKNOWN',
        hierarchicalScope: dbHierarchicalFilters
      });
    }
  } catch (error) {
    console.error("Error in bulkAddCOSPersonnel:", error);
    return res.status(500).json({ message: error.message });
  }
};
exports.getAllCOSPersonnel = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      orderBy,
      order = "asc",
      employeeFullName,
      statusOfAppointment,
      region, // Add region parameter
    } = req.query;

    // Get hierarchical filters from middleware (support both hierarchical and submission workflow)
    const hierarchicalFilters = req.hierarchicalFilters || req.submissionWorkflowFilters || {};

    // Map hierarchical filters to database field names
    const mapFiltersToDb = (filters) => {
      const mapped = {};

      // Handle $and conditions from middleware
      if (filters.$and && Array.isArray(filters.$and)) {
        mapped.$and = filters.$and.map(condition => {
          const conditionMapped = {};
          if (condition.region) conditionMapped.region = condition.region;
          if (condition.department) conditionMapped.department = condition.department;
          if (condition.division) conditionMapped.division = condition.division;
          return conditionMapped;
        });
        return mapped;
      }

      // Handle simple key-value filters
      if (filters.region) mapped.region = filters.region;
      if (filters.department) mapped.department = filters.department;
      if (filters.division) mapped.division = filters.division;
      return mapped;
    };

    const dbHierarchicalFilters = mapFiltersToDb(hierarchicalFilters);
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const skip = (pageNum - 1) * limitNum;
    const activeSettings = await Settings.findOne({ isActive: true });
    let query = {};

    // Apply hierarchical filters as base
    if (Object.keys(dbHierarchicalFilters).length > 0) {
      query = { ...dbHierarchicalFilters };
    }

    // CRITICAL SECURITY CHECK: Ensure region is provided
    if (!region) {
      return res.status(400).json({
        error: "Region parameter is required",
        message: "Please specify a region to view COS personnel"
      });
    }

    // Add region filter to hierarchical filters
    if (query.$and) {
      query.$and.push({ region: region });
    } else if (Object.keys(query).length > 0) {
      query = {
        $and: [query, { region: region }]
      };
    } else {
      query.region = region;
    }

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
    const cosPersonnels = await COSPersonnel.find(query)
      .skip(skip)
      .limit(limitNum)
      .sort(sortQuery);
    // Double-check that all returned personnel belong to the specified region
    const verifiedPersonnel = cosPersonnels.filter(person => {
      if (person.region !== region) {
        console.error(`SECURITY WARNING: COS personnel ${person.employeeFullName} has region ${person.region} but requested region is ${region}`);
        return false;
      }
      return true;
    });
    const totalRecords = await COSPersonnel.countDocuments(query);
    return res.json({
      cosPersonnels: verifiedPersonnel,
      totalPages: Math.ceil(totalRecords / limitNum),
      currentPage: pageNum,
      totalRecords,
      region,
    });
  } catch (error) {
    console.error("Error in getAllCOSPersonnel:", error);
    return res.status(500).json({ error: "Something went wrong." });
  }
};
exports.updateCOSPersonnel = async (req, res) => {
  try {
    const { id } = req.params;
    const updateFields = req.body;

    // Get hierarchical filters from middleware (support both hierarchical and submission workflow)
    const hierarchicalFilters = req.hierarchicalFilters || req.submissionWorkflowFilters || {};

    // Map hierarchical filters to database field names
    const mapFiltersToDb = (filters) => {
      const mapped = {};

      // Handle $and conditions from middleware
      if (filters.$and && Array.isArray(filters.$and)) {
        mapped.$and = filters.$and.map(condition => {
          const conditionMapped = {};
          if (condition.region) conditionMapped.region = condition.region;
          if (condition.department) conditionMapped.department = condition.department;
          if (condition.division) conditionMapped.division = condition.division;
          return conditionMapped;
        });
        return mapped;
      }

      // Handle simple key-value filters
      if (filters.region) mapped.region = filters.region;
      if (filters.department) mapped.department = filters.department;
      if (filters.division) mapped.division = filters.division;
      return mapped;
    };

    const dbHierarchicalFilters = mapFiltersToDb(hierarchicalFilters);

    // First, find the COS personnel record to check access
    const cosPersonnel = await COSPersonnel.findById(id);
    if (!cosPersonnel) {
      return res.status(404).json({ message: "COS personnel not found" });
    }

    // Check if user has access to this record based on hierarchical filters
    let hasAccess = true;
    if (Object.keys(dbHierarchicalFilters).length > 0) {
      if (dbHierarchicalFilters.$and) {
        hasAccess = dbHierarchicalFilters.$and.every(condition => {
          return Object.entries(condition).every(([key, value]) => {
            return cosPersonnel[key] === value;
          });
        });
      } else {
        hasAccess = Object.entries(dbHierarchicalFilters).every(([key, value]) => {
          return cosPersonnel[key] === value;
        });
      }
    }

    if (!hasAccess) {
      return res.status(403).json({
        error: "Access denied",
        message: "You don't have permission to update this COS personnel record"
      });
    }

    const allowedFields = [
      "employeeFullName",
      "monthlySalary",
      "annualSalary",
      "statusOfAppointment",
      "Total",
    ];
    const filteredUpdateFields = Object.keys(updateFields)
      .filter((key) => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = updateFields[key];
        return obj;
      }, {});
    const updatedCOSPersonnel = await COSPersonnel.findByIdAndUpdate(
      id,
      { $set: filteredUpdateFields },
      { new: true }
    );
    if (!updatedCOSPersonnel) {
      return res.status(404).json({ message: "COS personnel not found" });
    }
    res.status(200).json(updatedCOSPersonnel);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
exports.deleteCOSPersonnel = async (req, res) => {
  try {
    const { id } = req.params;

    // Get hierarchical filters from middleware (support both hierarchical and submission workflow)
    const hierarchicalFilters = req.hierarchicalFilters || req.submissionWorkflowFilters || {};

    // Map hierarchical filters to database field names
    const mapFiltersToDb = (filters) => {
      const mapped = {};

      // Handle $and conditions from middleware
      if (filters.$and && Array.isArray(filters.$and)) {
        mapped.$and = filters.$and.map(condition => {
          const conditionMapped = {};
          if (condition.region) conditionMapped.region = condition.region;
          if (condition.department) conditionMapped.department = condition.department;
          if (condition.division) conditionMapped.division = condition.division;
          return conditionMapped;
        });
        return mapped;
      }

      // Handle simple key-value filters
      if (filters.region) mapped.region = filters.region;
      if (filters.department) mapped.department = filters.department;
      if (filters.division) mapped.division = filters.division;
      return mapped;
    };

    const dbHierarchicalFilters = mapFiltersToDb(hierarchicalFilters);

    // First, find the COS personnel record to check access
    const cosPersonnel = await COSPersonnel.findById(id);
    if (!cosPersonnel) {
      return res.status(404).json({ message: "COS personnel not found" });
    }

    // Check if user has access to this record based on hierarchical filters
    let hasAccess = true;
    if (Object.keys(dbHierarchicalFilters).length > 0) {
      if (dbHierarchicalFilters.$and) {
        hasAccess = dbHierarchicalFilters.$and.every(condition => {
          return Object.entries(condition).every(([key, value]) => {
            return cosPersonnel[key] === value;
          });
        });
      } else {
        hasAccess = Object.entries(dbHierarchicalFilters).every(([key, value]) => {
          return cosPersonnel[key] === value;
        });
      }
    }

    if (!hasAccess) {
      return res.status(403).json({
        error: "Access denied",
        message: "You don't have permission to delete this COS personnel record"
      });
    }

    const deletedCOSPersonnel = await COSPersonnel.findByIdAndDelete(id);
    if (!deletedCOSPersonnel) {
      return res.status(404).json({ message: "COS personnel not found" });
    }
    res.status(200).json({ message: "COS personnel deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
//GET GRAND TOTAL OF THE COS PERSONNEL - COS statusOfAppointment(FOR TOTAL COLUMN)\
exports.getGrandTotalCOS = async (req, res) => {
  try {
    const { region } = req.query;

    // Get hierarchical filters from middleware (support both hierarchical and submission workflow)
    const hierarchicalFilters = req.hierarchicalFilters || req.submissionWorkflowFilters || {};

    // Map hierarchical filters to database field names
    const mapFiltersToDb = (filters) => {
      const mapped = {};

      // Handle $and conditions from middleware
      if (filters.$and && Array.isArray(filters.$and)) {
        mapped.$and = filters.$and.map(condition => {
          const conditionMapped = {};
          if (condition.region) conditionMapped.region = condition.region;
          if (condition.department) conditionMapped.department = condition.department;
          if (condition.division) conditionMapped.division = condition.division;
          return conditionMapped;
        });
        return mapped;
      }

      // Handle simple key-value filters
      if (filters.region) mapped.region = filters.region;
      if (filters.department) mapped.department = filters.department;
      if (filters.division) mapped.division = filters.division;
      return mapped;
    };

    const dbHierarchicalFilters = mapFiltersToDb(hierarchicalFilters);

    // CRITICAL SECURITY CHECK: Ensure region is provided
    if (!region) {
      return res.status(400).json({
        error: "Region parameter is required",
        message: "Please specify a region to view COS personnel totals"
      });
    }
    // 1. Try to grab the explicitly active settings
    let activeSettings = await Settings.findOne({ isActive: true }).lean();
    // 2. Fallback: if none is marked active, pick the one with the highest fiscalYear
    if (!activeSettings) {
      activeSettings = await Settings
        .findOne({})
        .sort({ fiscalYear: -1 })   // assumes fiscalYear is numeric or lexically comparable
        .lean();
    }
    // 3. If we still don't have a fiscalYear, error out
    if (!activeSettings || activeSettings.fiscalYear == null) {
      return res.status(400).json({
        message: "Active settings with a fiscalYear not found."
      });
    }
    const { fiscalYear } = activeSettings;

    // Build query with hierarchical filters
    let query = {
      statusOfAppointment: "COS",
      fiscalYear,
      region
    };

    // Apply hierarchical filters
    if (Object.keys(dbHierarchicalFilters).length > 0) {
      if (dbHierarchicalFilters.$and) {
        query = {
          $and: [
            query,
            ...dbHierarchicalFilters.$and
          ]
        };
      } else {
        query = {
          ...query,
          ...dbHierarchicalFilters
        };
      }
    }

    // 4. Fetch only COS personnel for that fiscal year AND region with hierarchical access
    const cosPersonnels = await COSPersonnel.find(query).lean();
    // 5. Define exactly which fields to include in the total for COS
    const fieldsToSum = [
      "annualSalary",
    ];
    // 6. Sum only those fields for each record, then grand‐total them
    const grandTotal = cosPersonnels.reduce((acc, curr) => {
      const subtotal = fieldsToSum.reduce(
        (sum, field) => sum + (Number(curr[field]) || 0),
        0
      );
      return acc + subtotal;
    }, 0);
    // 7. Return fiscalYear + grandTotal + region
    return res.json({ fiscalYear, grandTotal, region });
  } catch (error) {
    console.error("Error in getGrandTotalCOS:", error);
    return res
      .status(500)
      .json({ message: "Server error", error });
  }
};
