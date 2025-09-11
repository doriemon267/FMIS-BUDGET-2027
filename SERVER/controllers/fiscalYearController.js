// controllers/fiscalYearController.js
const FiscalYear = require('../models/FiscalYear');
// Function to generate the fiscal year (e.g., FY-2026)
const generateFiscalYear = (startDate) => {
  const year = new Date(startDate).getFullYear();
  return `FY-${year}`;
};
// Create a new Fiscal Year
exports.createFiscalYear = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    const fiscalYear = generateFiscalYear(startDate);
    const newFiscalYear = new FiscalYear({ year: fiscalYear, startDate, endDate });
    await newFiscalYear.save();
    res.status(201).json(newFiscalYear);
  } catch (error) {
    res.status(400).json({ message: 'Error creating fiscal year', error });
  }
};
// Get all Fiscal Years
exports.getFiscalYears = async (req, res) => {
  try {
    const fiscalYears = await FiscalYear.find();
    res.status(200).json(fiscalYears);
  } catch (error) {
    res.status(400).json({ message: 'Error fetching fiscal years', error });
  }
};