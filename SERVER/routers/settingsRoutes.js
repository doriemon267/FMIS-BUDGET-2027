const {
  getAllSettings,
  createSettings,
  updateSettings,
  deleteSettings,
  getActiveSettings,
  setActiveFiscalYear,
  getAdvancedSettings,    // bagong function para kuhanin ang advanced settings
  updateAdvancedSettings, // bagong function para i-update ang advanced settings
} = require("../controllers/settingsController");
const Router = require("express").Router;
const settingsRouter = Router();
// Get all settings
settingsRouter.get("/settings", getAllSettings);
// Get active fiscal year settings
settingsRouter.get("/settings/active", getActiveSettings);
// Create new settings
settingsRouter.post("/settings", createSettings);
// Update an existing settings entry
settingsRouter.put("/settings/:id", updateSettings);
// Delete a settings entry
settingsRouter.delete("/settings/:id", deleteSettings);
// Set a specific fiscal year as active
settingsRouter.patch("/settings/:id/activate", setActiveFiscalYear);
// --- Mga bagong endpoints para sa advanced (compensation) settings ---
// Kunin ang advanced settings para sa isang partikular na fiscal year
settingsRouter.get("/settings/advanced/:fiscalYear", getAdvancedSettings);
// I-update ang advanced settings para sa isang partikular na fiscal year
settingsRouter.put("/settings/advanced/:fiscalYear", updateAdvancedSettings);
// Get all fiscal years from settings
settingsRouter.get("/settings/fiscal-years", async (req, res) => {
  try {
    const Settings = require("../models/Settings");
    const settings = await Settings.find({}, { fiscalYear: 1, _id: 0 }).sort({ fiscalYear: 1 });
    const fiscalYears = settings.map(setting => setting.fiscalYear);
    res.status(200).json(fiscalYears);
  } catch (error) {
    console.error("Error fetching fiscal years:", error);
    res.status(500).json({ message: "Server error", error });
  }
});
module.exports = settingsRouter;