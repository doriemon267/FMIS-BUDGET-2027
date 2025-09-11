const COSPersonnel = require("../models/COSPersonnel");
const EmployeeMaster = require("../models/EmployeeList");
const Settings = require("../models/Settings");
const { searchFilter, textFilter } = require("../utils/controller_get_process");
exports.bulkAddCOSPersonnel = async (req, res) => {
  try {
    const { statusOfAppointment, region } = req.body;
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
    // Only get employees from the specified region
    const employees = await EmployeeMaster.find({ 
      StatusOfAppointment: statusOfAppointment,
      Region: region // Add region filter
    });
    if (employees.length === 0) {
      return res.status(200).json({ 
        message: `No COS employees found in region ${region}.` 
      });
    }
    const checks = await Promise.all(
      employees.map(async (employee) => {
        // Double-check that employee belongs to the specified region
        if (employee.Region !== region) {
          console.error(`SECURITY WARNING: Employee ${employee.EmployeeFullName} has region ${employee.Region} but requested region is ${region}`);
          return null;
        }
        const existingRecord = await COSPersonnel.findOne({
          employeeNumber: employee.EmployeeID,
          fiscalYear: fiscalYear,
        });
        if (!existingRecord) {
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
            gradelevel_SG: employee.SG.toString(),
            step: employee.Step || null, // Allow null/undefined values
            gradelevel_JG: employee.JG ? employee.JG.toString() : "", // Allow empty string for missing JG
            employeeFullName: employee.EmployeeFullName,
            employeeNumber: employee.EmployeeID,
            division: employee.Division,
            statusOfAppointment: employee.StatusOfAppointment,
            monthlySalary: monthlySalary,
            annualSalary: annualSalary,
            Total: annualSalary,
          };
        }
        return null;
      })
    );
    const cosPersonnelData = checks.filter((record) => record !== null);
    if (cosPersonnelData.length > 0) {
      const addedRecords = await COSPersonnel.insertMany(cosPersonnelData);
      return res.status(200).json({
        addedRecords,
        region,
        count: addedRecords.length
      });
    } else {
      return res.status(200).json({ 
        message: "No new COS personnel to add.",
        region
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
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const skip = (pageNum - 1) * limitNum;
    const activeSettings = await Settings.findOne({ isActive: true });
    let query = {};
    // CRITICAL SECURITY CHECK: Ensure region is provided
    if (!region) {
      return res.status(400).json({ 
        error: "Region parameter is required", 
        message: "Please specify a region to view COS personnel" 
      });
    }
    // Add region to query with exact matching
    query.region = region;
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
    // 4. Fetch only COS personnel for that fiscal year AND region
    const cosPersonnels = await COSPersonnel.find({
      statusOfAppointment: "COS",
      fiscalYear,
      region, // Add region filter
    }).lean();
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