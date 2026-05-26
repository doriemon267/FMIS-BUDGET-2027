const express = require("express");
const multer = require("multer");
const xlsx = require("xlsx");
const Employee = require("../models/EmployeeList");
const Settings = require("../models/Settings");
const isAuth = require('../middleware/is_auth');

const { generateEmployeeTemplate, getEmployeeFields } = require('../utils/employeeTemplateGenerator');
const { validateAndProcessEmployeeRecord } = require('../utils/employeeImportProcessor');
const { getNextVacantEmployeeNumber, getNextRegularEmployeeNumber } = require('../utils/generateVacantEmployeeNumber');
const router = express.Router();
// Apply authentication to all excel upload routes
router.use(isAuth);

// 📌 Get Employee Import Fields Information
router.get("/fields", (req, res) => {
  try {
    const fields = getEmployeeFields();
    res.json({
      success: true,
      fields
    });
  } catch (error) {
    console.error("Error getting fields:", error);
    res.status(500).json({
      error: "Error retrieving field information",
      details: error.message
    });
  }
});

// Configure Multer (Store file in memory)
const storage = multer.memoryStorage();
const upload = multer({ storage });
// 📌 Upload and Process Excel File
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    // Get the active region from the request
    const { activeRegion, processBy } = req.body;
    if (!activeRegion) {
      return res.status(400).json({ 
        error: "No active region provided", 
        message: "Please select a region before uploading employees" 
      });
    }

    // Get user access information
    const userAccess = {
      scope: req.user?.hierarchicalAccess?.scope || 'REGION',
      accessibleDepartments: req.user?.hierarchicalAccess?.accessibleDepartments || [],
      accessibleDivisions: req.user?.hierarchicalAccess?.accessibleDivisions || [],
      accessibleSections: req.user?.hierarchicalAccess?.accessibleSections || []
    };

    console.log('User access for validation:', userAccess);
    // Get active fiscal year from settings
    const activeSettings = await Settings.findOne({ isActive: true });
    if (!activeSettings || !activeSettings.fiscalYear) {
      return res.status(400).json({
        error: "No active fiscal year",
        message: "Please set an active fiscal year in settings before uploading employees"
      });
    }
    const workbook = xlsx.read(req.file.buffer, { type: "buffer", cellDates: true, cellNF: false, cellText: false });
    const sheetName = workbook.SheetNames[0];
    const sheetDataRaw = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { 
      raw: false, 
      dateNF: 'mm/dd/yyyy',
      defval: null
    });

    // Normalize column names: template uses "Field*" but processor expects "Field"
    const normalizeRecord = (row) => {
      const out = {};
      for (const [key, val] of Object.entries(row)) {
        const cleanKey = (key || '').replace(/\*+$/, '').trim();
        if (cleanKey) out[cleanKey] = val;
      }
      return out;
    };
    const sheetData = sheetDataRaw.map(normalizeRecord);

    // Validate all records first
    const validationResults = [];
    for (let i = 0; i < sheetData.length; i++) {
      const record = sheetData[i];
      const result = await validateAndProcessEmployeeRecord(
        record,
        activeRegion,
        activeSettings.fiscalYear,
        processBy,
        userAccess
      );
      validationResults.push({
        row: i + 2, // +2 because Excel is 1-indexed and we skip header
        ...result
      });
    }

    // Check for validation errors
    const errorRecords = validationResults.filter(r => !r.isValid);
    if (errorRecords.length > 0) {
      console.log('Validation errors found:', errorRecords.length);
      errorRecords.slice(0, 3).forEach((record, index) => {
        console.log(`Record ${index + 1} (Row ${record.row}):`, {
          employeeName: record.record.EmployeeFullName,
          errors: record.errors
        });
      });

      return res.status(400).json({
        error: "Validation failed",
        message: `${errorRecords.length} record(s) have validation errors`,
        details: errorRecords.slice(0, 10).map(r => ({
          row: r.row,
          employeeName: r.record.EmployeeFullName,
          errors: r.errors
        }))
      });
    }

    // Process valid records
    const processedRecords = [];
    const warningRecords = [];

    // Fetch all existing employees for this region and fiscal year to use for matching/consumption
    // This allows multiple vacant slots of the same type while preventing duplicates on re-upload
    const regionRegex = new RegExp(`^${String(activeRegion).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    const fiscalYearVal = activeSettings.fiscalYear;
    const escapeRegex = (str) => String(str || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&").trim();
    
    let existingEmployees = await Employee.find({
      Region: regionRegex,
      fiscalYear: fiscalYearVal
    }).lean();

    for (const result of validationResults) {
      if (result.warnings.length > 0) {
        warningRecords.push({
          row: result.row,
          employeeName: result.record.EmployeeFullName,
          warnings: result.warnings
        });
      }

      try {
        const rec = result.record;
        const isVacant = rec.EmployeeFullName && 
                 ['VACANT', 'TO-BE-FILLED'].includes(String(rec.EmployeeFullName).toUpperCase().trim());

        // Auto-generate Employee Number when missing: VACANT → V00001, regular → E00001
        const hasEmployeeNo = rec.EmployeeID && String(rec.EmployeeID).trim() !== '' || rec.Employee_No && String(rec.Employee_No).trim() !== '';
        if (!hasEmployeeNo) {
          if (isVacant) {
            rec.EmployeeID = await getNextVacantEmployeeNumber(Employee, fiscalYearVal, activeRegion);
          } else {
            rec.EmployeeID = await getNextRegularEmployeeNumber(Employee, fiscalYearVal, activeRegion);
          }
        } else if (rec.Employee_No != null && String(rec.Employee_No).trim() !== '') {
          rec.EmployeeID = rec.EmployeeID || String(rec.Employee_No).trim();
        }

        // Try to find a match from existingEmployees list (consumption logic)
        let existingEmployee = null;
        const vacantRegex = /^VACANT$|^TO-BE-FILLED$/i;

        let matchIndex = -1;
        if (isVacant) {
          const itemNo = (rec.itemNumber || rec.ItemNumber || "").toString().trim();
          if (itemNo) {
            matchIndex = existingEmployees.findIndex(
              (emp) => vacantRegex.test(emp.EmployeeFullName) && emp.itemNumber === itemNo
            );
          } else {
            // Match by position details if no item number
            matchIndex = existingEmployees.findIndex((emp) => {
              const posMatch = new RegExp(`^${escapeRegex(rec.PositionTitle)}$`, "i").test(emp.PositionTitle);
              const deptMatch = new RegExp(`^${escapeRegex(rec.Department)}$`, "i").test(emp.Department);
              const divMatch =
                rec.Division && String(rec.Division).trim()
                  ? new RegExp(`^${escapeRegex(rec.Division)}$`, "i").test(emp.Division)
                  : !emp.Division || String(emp.Division).trim() === "";
              const sectMatch =
                rec.Section && String(rec.Section).trim()
                  ? new RegExp(`^${escapeRegex(rec.Section)}$`, "i").test(emp.Section)
                  : !emp.Section || String(emp.Section).trim() === "";

              return vacantRegex.test(emp.EmployeeFullName) && posMatch && deptMatch && divMatch && sectMatch;
            });
          }
        } else {
          const fullNameRegex = new RegExp(`^${String(rec.EmployeeFullName).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
          matchIndex = existingEmployees.findIndex((emp) => fullNameRegex.test(emp.EmployeeFullName));
        }

        if (matchIndex !== -1) {
          // Found a match, consume it so it's not used by another row in this batch
          existingEmployee = existingEmployees.splice(matchIndex, 1)[0];
        }

        if (existingEmployee) {
          await Employee.updateOne(
            { _id: existingEmployee._id },
            {
              $set: {
                ...result.record,
                fiscalYear: activeSettings.fiscalYear,
                processBy: processBy || "ADMIN"
              }
            }
          );
          processedRecords.push({
            ...result.record,
            action: 'updated'
          });
        } else {
          await Employee.create({
            ...result.record,
            fiscalYear: activeSettings.fiscalYear,
            processBy: processBy || "ADMIN"
          });
          processedRecords.push({
            ...result.record,
            action: 'created'
          });
        }
      } catch (dbError) {
        console.error(`Error saving record ${result.record.EmployeeFullName}:`, dbError);
        return res.status(500).json({
          error: "Database error",
          message: `Error saving record for ${result.record.EmployeeFullName}`,
          details: dbError.message
        });
      }
    }

    // Prepare response
    const response = {
      message: "Excel file processed successfully!",
      count: processedRecords.length,
      region: activeRegion,
      fiscalYear: activeSettings.fiscalYear,
      summary: {
        created: processedRecords.filter(r => r.action === 'created').length,
        updated: processedRecords.filter(r => r.action === 'updated').length
      }
    };

    // Include warnings if any
    if (warningRecords.length > 0) {
      response.warnings = warningRecords.slice(0, 5); // Show first 5 warnings
      response.totalWarnings = warningRecords.length;
    }

    res.json(response);
  } catch (error) {
    console.error("Error processing file:", error);
    res.status(500).json({ error: "Error uploading file", details: error.message });
  }
});
module.exports = router;

