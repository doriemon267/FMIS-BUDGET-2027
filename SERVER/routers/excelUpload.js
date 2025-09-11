const express = require("express");
const multer = require("multer");
const xlsx = require("xlsx");
const Employee = require("../models/EmployeeList");
const Settings = require("../models/Settings");
const checkToken = require('../middleware/checkToken');
const router = express.Router();
// Apply authentication to all excel upload routes
router.use(checkToken);
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
    // Check if all records have the same region as the active region
    const invalidRegionRecords = sheetData.filter(record => {
      // Skip records without Region field
      if (!record.Region) return false;
      // Check if the region matches the active region (case insensitive)
      const recordRegion = record.Region.toString().toLowerCase();
      const activeRegionName = activeRegion.toLowerCase();
      return recordRegion !== activeRegionName;
    });
    if (invalidRegionRecords.length > 0) {
      // Return error with details about the mismatched records
      return res.status(400).json({
        error: "Region mismatch",
        message: `${invalidRegionRecords.length} employee(s) have regions that don't match the active region (${activeRegion})`,
        details: invalidRegionRecords.map(r => ({
          employeeId: r.EmployeeID,
          name: r.EmployeeFullName,
          region: r.Region
        })).slice(0, 5) // Only show first 5 mismatched records
      });
    }
    // Process the records if all regions match
    for (let record of sheetData) {
      // Convert Excel date format to JavaScript Date if present
      if (record.DateOfAppointment) {
        // Handle different date formats - if it's an Excel serial number
        if (typeof record.DateOfAppointment === 'number') {
          // Convert Excel date serial number to JavaScript Date
          record.DateOfAppointment = new Date(Math.round((record.DateOfAppointment - 25569) * 86400 * 1000));
        } else if (typeof record.DateOfAppointment === 'string') {
          // Try to parse the date string
          record.DateOfAppointment = new Date(record.DateOfAppointment);
        }
      } else {
        // If DateOfAppointment is not provided, set a default value
        record.DateOfAppointment = new Date();
      }
      // If record doesn't have a Region, set it to the active region
      if (!record.Region) {
        record.Region = activeRegion;
      }
      // Set fiscal year and processBy regardless of what's in the file
      record.fiscalYear = activeSettings.fiscalYear;
      record.processBy = processBy || "ADMIN";
      const existingEmployee = await Employee.findOne({ EmployeeID: record.EmployeeID });
      if (existingEmployee) {
        await Employee.updateOne(
          { EmployeeID: record.EmployeeID }, 
          { 
            $set: {
              ...record,
              fiscalYear: activeSettings.fiscalYear,
              processBy: processBy || "ADMIN"
            } 
          }
        );
      } else {
        await Employee.create(record);
      }
    }
    res.json({ 
      message: "Excel file processed successfully!", 
      count: sheetData.length,
      region: activeRegion,
      fiscalYear: activeSettings.fiscalYear
    });
  } catch (error) {
    console.error("Error processing file:", error);
    res.status(500).json({ error: "Error uploading file", details: error.message });
  }
});
module.exports = router;