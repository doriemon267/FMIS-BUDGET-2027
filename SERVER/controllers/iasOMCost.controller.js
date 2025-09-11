const IAsOMCost = require("../models/IAsOMCost");
const Settings = require("../models/Settings");
/**
 * Get IAs O&M Cost data
 */
const getIAsOMCost = async (req, res) => {
  try {
    // Determine fiscal year
    let fiscalYear;
    if (req.query.fiscalYear) {
      fiscalYear = req.query.fiscalYear;
    } else {
      const activeSetting = await Settings.findOne({ isActive: true });
      if (!activeSetting) {
        return res.status(404).json({ error: "No active settings found." });
      }
      fiscalYear = activeSetting.fiscalYear;
    }
    // Get budget type from query or default to "INITIAL"
    const budgetType = (req.query.budgetType || "INITIAL").toUpperCase();
    // Get region from query or user, but apply hierarchical filters
    let region;
    if (req.hierarchicalFilters && req.hierarchicalFilters.region) {
      region = req.hierarchicalFilters.region;
    } else {
      region = req.query.region || req.user?.Region || "Central Office";
    }    // Log the search parameters
    // // Find existing data
    const existingData = await IAsOMCost.findOne({
      fiscalYear,
      budgetType,
      region
    });    if (existingData) {
      // Calculate totals for the response
      const totals = {
        totalNIS: (existingData.nis || 0) + (existingData.nisSubsidy || 0),
        totalCIS: (existingData.cis || 0) + (existingData.cisSubsidy || 0)
      };
      return res.json({
        nis: existingData.nis || 0,
        cis: existingData.cis || 0,
        nisSubsidy: existingData.nisSubsidy || 0,
        cisSubsidy: existingData.cisSubsidy || 0,
        totalNIS: totals.totalNIS,
        totalCIS: totals.totalCIS,
        total: totals.totalNIS + totals.totalCIS,
        fiscalYear,
        budgetType,
        region
      });
    }
    // Return default values if no data exists
    return res.json({
      nis: 0,
      cis: 0,
      nisSubsidy: 0,
      cisSubsidy: 0,
      fiscalYear,
      budgetType,
      region
    });
  } catch (err) {
    // console.error("Error in getIAsOMCost:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
/**
 * Save IAs O&M Cost data
 */
const saveIAsOMCost = async (req, res) => {
  try {
    // Determine fiscal year
    let fiscalYear;
    if (req.body.fiscalYear) {
      fiscalYear = req.body.fiscalYear;
    } else {
      const activeSetting = await Settings.findOne({ isActive: true });
      if (!activeSetting)
        return res.status(404).json({ error: "No active settings found." });
      fiscalYear = activeSetting.fiscalYear;
    }
    // Get budget type from body or default to "INITIAL"
    const budgetType = (req.body.budgetType || "INITIAL").toUpperCase();
    // Get region from body, user, or default
    const region = req.body.region || req.user?.Region || req.body.meta?.region || "Central Office";    // Validate input
    const nis = parseFloat(req.body.nis) || 0;
    const cis = parseFloat(req.body.cis) || 0;
    const nisSubsidy = parseFloat(req.body.nisSubsidy) || 0;
    const cisSubsidy = parseFloat(req.body.cisSubsidy) || 0;
    if (nis < 0 || cis < 0 || nisSubsidy < 0 || cisSubsidy < 0) {
      return res.status(400).json({ error: "Values cannot be negative" });
    }    // Find existing data or create new
    const filter = { fiscalYear, budgetType, region };
    const update = {
      nis,
      cis,
      nisSubsidy,
      cisSubsidy,
      processBy: req.body.meta?.processBy || req.user?.FirstName + " " + req.user?.LastName,
      processDate: new Date()
    };
    const options = { upsert: true, new: true, setDefaultsOnInsert: true };
    const updatedData = await IAsOMCost.findOneAndUpdate(filter, update, options);
    res.json({
      success: true,
      data: updatedData
    });
  } catch (err) {
    // console.error("Error in saveIAsOMCost:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
module.exports = {
  getIAsOMCost,
  saveIAsOMCost
};