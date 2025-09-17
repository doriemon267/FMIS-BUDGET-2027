const express = require("express");
const multer = require("multer");
const xlsx = require("xlsx");
const Employee = require("../models/EmployeeList");
const Settings = require("../models/Settings");
const checkToken = require('../middleware/checkToken');
const { generateEmployeeTemplate, getEmployeeFields } = require('../utils/employeeTemplateGenerator');
const { validateAndProcessEmployeeRecord } = require('../utils/employeeImportProcessor');
const router = express.Router();
// Apply authentication to all excel upload routes
router.use(checkToken);

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
    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

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
      return res.status(400).json({
        error: "Validation failed",
        message: `${errorRecords.length} record(s) have validation errors`,
        details: errorRecords.slice(0, 10).map(r => ({
          row: r.row,
          employeeId: r.record.EmployeeID,
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
          employeeId: result.record.EmployeeID,
          employeeName: result.record.EmployeeFullName,
          warnings: result.warnings
        });
      }

      try {
        const existingEmployee = await Employee.findOne({ EmployeeID: result.record.EmployeeID });

        if (existingEmployee) {
          await Employee.updateOne(
            { EmployeeID: result.record.EmployeeID },
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
        console.error(`Error saving record ${result.record.EmployeeID}:`, dbError);
        return res.status(500).json({
          error: "Database error",
          message: `Error saving record for EmployeeID: ${result.record.EmployeeID}`,
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
