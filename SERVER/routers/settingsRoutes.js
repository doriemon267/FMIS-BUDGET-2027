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
  addRegionDueDateExtension,
  updateRegionDueDateExtension,
  removeRegionDueDateExtension,
  // STANDALONE COMPENSATION ENDPOINTS
  createCompensationSettings,
  getCompensationSettings,
  updateCompensationSettingsStandalone,
  linkCompensationToSettings,
  unlinkCompensationFromSettings,
  getLinkedFiscalYears,
} = require("../controllers/settingsControllerEnhanced");
const Router = require("express").Router;
const isAuth = require('../middleware/is_auth');
const settingsRouter = Router();
const { logUserActivity } = require("../middleware/userLogs");
// Apply authentication to all settings routes
settingsRouter.use(isAuth);

// ==================== STANDALONE COMPENSATION MANAGEMENT ENDPOINTS ====================
// ✅ These endpoints enforce STRICT SEPARATION:
// - Compensation Settings are created INDEPENDENTLY (not tied to fiscal years)
// - Multiple fiscal years can REUSE the SAME compensation
// - Users must EXPLICITLY LINK compensation to fiscal years
// ⚠️ PLACED FIRST: Specific routes must come before generic /settings/:id

// Create standalone compensation settings (NOT tied to any fiscal year)
settingsRouter.post("/compensation", logUserActivity({ action: 'CREATE', resource: 'CompensationSettings' }), createCompensationSettings);

// Get all available compensation settings
settingsRouter.get("/compensation", getCompensationSettings);

// Update standalone compensation settings
settingsRouter.put("/compensation/:id", logUserActivity({ action: 'UPDATE', resource: 'CompensationSettings', getResourceId: (req) => req.params.id }), updateCompensationSettingsStandalone);

// Get all fiscal years linked to a specific compensation
settingsRouter.get("/compensation/:compensationId/linked-fiscal-years", getLinkedFiscalYears);

// ==================== SPECIFIC SETTINGS ROUTES (must come before generic /settings/:id) ====================

// Link compensation to a fiscal year (assign after creation) – used by Compensation Management
settingsRouter.put("/settings/:id/link-compensation", logUserActivity({ action: 'UPDATE', resource: 'Settings', getResourceId: (req) => req.params.id, getDetails: () => ({ subAction: 'link-compensation' }) }), linkCompensationToSettings);

// Remove compensation link from fiscal year (set to null)
settingsRouter.delete("/settings/:id/compensation-link", logUserActivity({ action: 'UPDATE', resource: 'Settings', getResourceId: (req) => req.params.id, getDetails: () => ({ subAction: 'unlink-compensation' }) }), unlinkCompensationFromSettings);

// Get settings with compensation data only (for Compensation Settings page)
settingsRouter.get("/settings/compensation-only", getCompensationOnlySettings);

// Get active fiscal year settings
settingsRouter.get("/settings/active", getActiveSettings);

// Advanced (compensation) settings – used by Compensation Management / CompensationSettingsForm
settingsRouter.get("/settings/advanced/:fiscalYear", getAdvancedSettings);
settingsRouter.put("/settings/advanced/:fiscalYear", logUserActivity({ action: 'UPDATE', resource: 'Settings', getResourceId: (req) => req.params.fiscalYear, getDetails: () => ({ subAction: 'advanced-compensation' }) }), updateAdvancedSettings);

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
settingsRouter.patch("/settings/:id/activate", logUserActivity({ action: 'UPDATE', resource: 'Settings', getResourceId: (req) => req.params.id, getDetails: () => ({ subAction: 'activate' }) }), setActiveFiscalYear);

// Create settings with regions and multiple budget periods (used by /fysettings)
settingsRouter.post("/settings/enhanced/create", logUserActivity({ action: 'CREATE', resource: 'Settings' }), createSettingsWithRegions);

// Extend a budget period (add new phase/period)
settingsRouter.post("/settings/:id/extend-period", logUserActivity({ action: 'UPDATE', resource: 'Settings', getResourceId: (req) => req.params.id, getDetails: () => ({ subAction: 'extend-period' }) }), extendBudgetPeriod);

// Activate a specific budget period (manual activation)
settingsRouter.patch("/settings/:id/activate-period", logUserActivity({ action: 'UPDATE', resource: 'Settings', getResourceId: (req) => req.params.id, getDetails: () => ({ subAction: 'activate-period' }) }), activateBudgetPeriod);

// Region-specific due date extensions (same FY + budget type, extended due date for specific region(s))
settingsRouter.post("/settings/:id/region-extension", logUserActivity({ action: 'CREATE', resource: 'Settings', getResourceId: (req) => req.params.id, getDetails: () => ({ subAction: 'region-extension' }) }), addRegionDueDateExtension);
settingsRouter.put("/settings/:id/region-extension/:extensionId", logUserActivity({ action: 'UPDATE', resource: 'Settings', getResourceId: (req) => req.params.id, getDetails: () => ({ subAction: 'region-extension' }) }), updateRegionDueDateExtension);
settingsRouter.delete("/settings/:id/region-extension/:extensionId", logUserActivity({ action: 'DELETE', resource: 'Settings', getResourceId: (req) => req.params.id, getDetails: () => ({ subAction: 'region-extension' }) }), removeRegionDueDateExtension);

// Update compensation settings separately
settingsRouter.put("/settings/:id/compensation", updateCompensationSettings);

// ==================== LEGACY ENDPOINTS (backward compatibility - MUST BE LAST) ====================
// ⚠️ Generic routes MUST come last so specific routes match first

// Get all settings
settingsRouter.get("/settings", getAllSettings);

// Create new settings
settingsRouter.post("/settings", logUserActivity({ action: 'CREATE', resource: 'Settings' }), createSettings);

// Update an existing settings entry
settingsRouter.put(
  "/settings/:id",
  logUserActivity({
    action: 'UPDATE',
    resource: 'Settings',
    getResourceId: (req) => req.params.id,
    getDetails: (req) => ({
      subAction: 'update-settings',
      ...(req?._settingsAuditDetails || {}),
    }),
  }),
  updateSettings
);

// Delete a settings entry
settingsRouter.delete("/settings/:id", logUserActivity({ action: 'DELETE', resource: 'Settings', getResourceId: (req) => req.params.id }), deleteSettings);

module.exports = settingsRouter;

