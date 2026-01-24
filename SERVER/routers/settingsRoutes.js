const {
  getAllSettings,
  getCompensationOnlySettings,
  createSettings,
  updateSettings,
  deleteSettings,
  getActiveSettings,
  setActiveFiscalYear,
  getAdvancedSettings,
  updateAdvancedSettings,
  // NEW FUNCTIONS
  createSettingsWithRegions,
  extendBudgetPeriod,
  activateBudgetPeriod,
  getSettingsByRegion,
  getActiveSettingsWithPeriods,
  updateCompensationSettings,
  // STANDALONE COMPENSATION ENDPOINTS
  createCompensationSettings,
  getCompensationSettings,
  updateCompensationSettingsStandalone,
  linkCompensationToSettings,
  unlinkCompensationFromSettings,
  getLinkedFiscalYears,
} = require("../controllers/settingsControllerEnhanced");
const Router = require("express").Router;
const settingsRouter = Router();
const check_token_dev = require("../middlewares/check_token_dev");
const check_token_prod = require("../middlewares/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;
// Apply authentication to all settings routes
settingsRouter.use(tokenMiddleware);

// ==================== STANDALONE COMPENSATION MANAGEMENT ENDPOINTS ====================
// ✅ These endpoints enforce STRICT SEPARATION:
// - Compensation Settings are created INDEPENDENTLY (not tied to fiscal years)
// - Multiple fiscal years can REUSE the SAME compensation
// - Users must EXPLICITLY LINK compensation to fiscal years
// ⚠️ PLACED FIRST: Specific routes must come before generic /settings/:id

// Create standalone compensation settings (NOT tied to any fiscal year)
settingsRouter.post("/compensation", createCompensationSettings);

// Get all available compensation settings
settingsRouter.get("/compensation", getCompensationSettings);

// Update standalone compensation settings
settingsRouter.put("/compensation/:id", updateCompensationSettingsStandalone);

// Get all fiscal years linked to a specific compensation
settingsRouter.get("/compensation/:compensationId/linked-fiscal-years", getLinkedFiscalYears);

// ==================== SPECIFIC SETTINGS ROUTES (must come before generic /settings/:id) ====================

// Link compensation to a fiscal year (assign after creation)
settingsRouter.put("/settings/:id/link-compensation", linkCompensationToSettings);

// Remove compensation link from fiscal year (set to null)
settingsRouter.delete("/settings/:id/compensation-link", unlinkCompensationFromSettings);

// Get settings with compensation data only (for Compensation Settings page)
settingsRouter.get("/settings/compensation-only", getCompensationOnlySettings);

// Get active fiscal year settings
settingsRouter.get("/settings/active", getActiveSettings);

// Advanced (compensation) settings
settingsRouter.get("/settings/advanced/:fiscalYear", getAdvancedSettings);
settingsRouter.put("/settings/advanced/:fiscalYear", updateAdvancedSettings);

// Get all fiscal years from settings (with budgetType and _id)
settingsRouter.get("/settings/fiscal-years", async (req, res) => {
  try {
    const Settings = require("../models/Settings");
    const settings = await Settings.find({}, { fiscalYear: 1, budgetType: 1, _id: 1 })
      .sort({ fiscalYear: 1, budgetType: 1 });
    
    // Return full objects with _id, fiscalYear, and budgetType
    const fiscalYears = settings.map(setting => ({
      _id: setting._id,
      fiscalYear: setting.fiscalYear,
      fiscalYearCode: setting.fiscalYear, // Alias for frontend compatibility
      budgetType: setting.budgetType,
    }));
    
    res.status(200).json({ data: fiscalYears });
  } catch (error) {
    console.error("Error fetching fiscal years:", error);
    res.status(500).json({ message: "Server error", error });
  }
});

// Get settings by region
settingsRouter.get("/settings/by-region/:region", getSettingsByRegion);

// Get active settings with all budget periods
settingsRouter.get("/settings/active/with-periods", getActiveSettingsWithPeriods);

// Set a specific fiscal year as active
settingsRouter.patch("/settings/:id/activate", setActiveFiscalYear);

// Create settings with regions and multiple budget periods
settingsRouter.post("/settings/enhanced/create", createSettingsWithRegions);

// Extend a budget period (add new phase/period)
settingsRouter.post("/settings/:id/extend-period", extendBudgetPeriod);

// Activate a specific budget period (manual activation)
settingsRouter.patch("/settings/:id/activate-period", activateBudgetPeriod);

// Update compensation settings separately
settingsRouter.put("/settings/:id/compensation", updateCompensationSettings);

// ==================== LEGACY ENDPOINTS (backward compatibility - MUST BE LAST) ====================
// ⚠️ Generic routes MUST come last so specific routes match first

// Get all settings
settingsRouter.get("/settings", getAllSettings);

// Create new settings
settingsRouter.post("/settings", createSettings);

// Update an existing settings entry
settingsRouter.put("/settings/:id", updateSettings);

// Delete a settings entry
settingsRouter.delete("/settings/:id", deleteSettings);

module.exports = settingsRouter;
