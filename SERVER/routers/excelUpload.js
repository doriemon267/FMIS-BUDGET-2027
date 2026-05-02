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
        const regionRegex = new RegExp(`^${String(activeRegion).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
        const fiscalYearVal = activeSettings.fiscalYear;

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

        // For VACANT: each position is a separate record — match by ItemNumber or by position details so we don't overwrite one VACANT for all
        let matchQuery;
        if (isVacant) {
  const itemNo = (rec.itemNumber || rec.ItemNumber || '').toString().trim();
  
  // Regex pattern na tatanggap sa VACANT o TO-BE-FILLED
  const vacantRegex = /^VACANT$|^TO-BE-FILLED$/i;

  if (itemNo) {
    matchQuery = {
      EmployeeFullName: vacantRegex,
      fiscalYear: fiscalYearVal,
      Region: regionRegex,
      itemNumber: itemNo
    };
  } else {
    matchQuery = {
      EmployeeFullName: vacantRegex,
      fiscalYear: fiscalYearVal,
      Region: regionRegex,
      PositionTitle: rec.PositionTitle,
      Department: rec.Department,
      Division: (rec.Division || ''),
      Section: (rec.Section || '')
    };
  }
} else {
          matchQuery = {
            EmployeeFullName: new RegExp(`^${String(rec.EmployeeFullName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
            fiscalYear: fiscalYearVal,
            Region: regionRegex
          };
        }
        const existingEmployee = await Employee.findOne(matchQuery);

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

