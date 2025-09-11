const xlsx = require("xlsx");
const MooeProposal = require("../models/mooeProposals"); // Use correct model
const Settings = require("../models/Settings");
// Process Excel file for bulk MOOE upload (tabular: income/subsidy per region)
exports.uploadMooe = async (req, res) => {
  try {
    // Get active settings for fiscalYear and budgetType
    const activeSettings = await Settings.findOne({ isActive: true });
    if (!activeSettings) {
      return res.status(404).json({ 
        error: "No active settings found",
        message: "Please set active fiscal year and budget type before uploading" 
      });
    }
    // Read the Excel file
    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const sheetData = xlsx.utils.sheet_to_json(worksheet, { defval: null });
    if (sheetData.length === 0) {
      return res.status(400).json({ error: "Empty file", message: "The uploaded Excel file contains no data" });
    }
    // Detect region columns (e.g., Region I Income, Region I Subsidy, ...)
    const headers = Object.keys(sheetData[0]);
    const regionNames = [];
    headers.forEach(h => {
      const match = h.match(/(Region [^ ]+)( Income| Subsidy)/);
      if (match && !regionNames.includes(match[1])) regionNames.push(match[1]);
    });
    let success = 0, failed = 0, errors = [];
    for (const row of sheetData) {
      for (const region of regionNames) {
        const income = parseFloat(row[`${region} Income`] || 0) || 0;
        const subsidy = parseFloat(row[`${region} Subsidy`] || 0) || 0;
        if (income === 0 && subsidy === 0) continue; // skip empty
        try {
          await MooeProposal.create({
            sublineItem: row["Subline Item"] || '',
            accountingTitle: row["Accounting Title"] || '',
            region,
            income,
            subsidy,
            amount: income + subsidy,
            fiscalYear: activeSettings.fiscalYear,
            budgetType: activeSettings.budgetType
          });
          success++;
        } catch (error) {
          failed++;
          errors.push({ row, region, error: error.message });
        }
      }
    }
    return res.json({ message: "File processed successfully", success, failed, errors });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error", message: error.message });
  }
};
// Generate sample template for MOOE upload in tabular format with Subline Item and Accounting Title
exports.getSampleMooeTemplate = async (req, res) => {
  try {
    // Tabular format: Subline Item and Accounting Title as columns, regions as columns
    const sampleData = [
      { 
        "Subline Item": "Office Supplies", 
        "Accounting Title": "Supplies Expenses", 
        "Region I Income": 10000, "Region I Subsidy": 5000, 
        "Region II Income": 12000, "Region II Subsidy": 6000, 
        "Region III Income": 11000, "Region III Subsidy": 5500 
      },
      { 
        "Subline Item": "Travel Expenses", 
        "Accounting Title": "Traveling Expenses", 
        "Region I Income": 20000, "Region I Subsidy": 8000, 
        "Region II Income": 18000, "Region II Subsidy": 7000, 
        "Region III Income": 21000, "Region III Subsidy": 9000 
      }
    ];
    const worksheet = xlsx.utils.json_to_sheet(sampleData);
    const wscols = [ { wch: 25 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 } ];
    worksheet['!cols'] = wscols;
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, worksheet, 'MOOE');
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=mooe_template.xlsx');
    res.send(buf);
  } catch (error) {
    res.status(500).json({ error: "Internal server error", message: error.message });
  }
};