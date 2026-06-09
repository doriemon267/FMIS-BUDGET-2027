const express = require('express');
const router = express.Router();
const CompensationSettings = require("../models/CompensationSettings");
const Settings = require("../models/Settings");

router.get('/', async (req, res) => {
  try {
    const compensations = await CompensationSettings.find().sort({ createdAt: -1 });

    const enrichedCompensations = await Promise.all(
      compensations.map(async (compensation) => {
        const linkedSettings = await Settings.find({ compensationSettingsId: compensation._id }).select("_id fiscalYear budgetType");
        const linkedFiscalYears = linkedSettings.map((setting) => setting._id);
        const linkedBudgetTypes = linkedSettings.map((setting) => setting.budgetType).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);

        return {
          ...compensation.toObject(),
          linkedFiscalYears,
          linkedBudgetTypes,
          linkedCount: linkedFiscalYears.length,
        };
      })
    );
    res.status(200).json({ message: "Compensation settings retrieved successfully", count: enrichedCompensations.length, compensationSettings: enrichedCompensations });
  } catch (error) {
    console.error("Error in getCompensationSettings:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
