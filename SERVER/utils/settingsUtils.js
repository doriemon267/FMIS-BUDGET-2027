/**
 * Settings Utilities - Helper functions for working with Settings and CompensationSettings
 */

const Settings = require("../models/Settings");
const CompensationSettings = require("../models/CompensationSettings");

/**
 * Get active settings with compensation data
 * Returns a merged object containing both Settings and CompensationSettings data
 * 
 * @param {Object} options - Query options
 * @returns {Object} Merged settings object with all compensation fields
 */
async function getActiveSettingsWithCompensation(options = {}) {
  try {
    const { region = null, lean = false } = options;

    // Build query for Settings
    let settingsQuery = { isActive: true };
    if (region) {
      settingsQuery.$or = [
        { applicableRegions: "All" },
        { applicableRegions: region },
      ];
    }

    // Fetch active settings
    let activeSettings = await Settings.findOne(settingsQuery);
    if (!activeSettings) {
      return null;
    }

    // Fetch associated compensation settings if referenced
    let compensationSettings = null;
    if (activeSettings.compensationSettingsId) {
      compensationSettings = await CompensationSettings.findById(
        activeSettings.compensationSettingsId
      );
    }

    // If no explicitly linked compensation settings, try to find by fiscal year/budget type
    if (!compensationSettings) {
      compensationSettings = await CompensationSettings.findOne({
        fiscalYear: activeSettings.fiscalYear,
        budgetType: activeSettings.budgetType,
      });
    }

    // Merge settings with compensation data
    const merged = lean
      ? activeSettings.toObject()
      : JSON.parse(JSON.stringify(activeSettings.toObject ? activeSettings.toObject() : activeSettings));

    if (compensationSettings) {
      const compensationData = compensationSettings.toObject
        ? compensationSettings.toObject()
        : compensationSettings;

      // Copy all compensation fields to merged object
      Object.keys(compensationData).forEach((key) => {
        if (
          !key.startsWith("_") &&
          key !== "fiscalYear" &&
          key !== "budgetType" &&
          key !== "notes"
        ) {
          merged[key] = compensationData[key];
        }
      });
    }

    return merged;
  } catch (error) {
    console.error("Error in getActiveSettingsWithCompensation:", error);
    throw error;
  }
}

/**
 * Get all settings with compensation data (for lists/reports)
 * 
 * @param {Object} options - Query options
 * @returns {Array} Array of merged settings objects
 */
async function getAllSettingsWithCompensation(options = {}) {
  try {
    const { region = null, fiscalYear = null, budgetType = null } = options;

    // Build query
    let query = {};
    if (region) {
      query.$or = [{ applicableRegions: "All" }, { applicableRegions: region }];
    }
    if (fiscalYear) query.fiscalYear = fiscalYear;
    if (budgetType) query.budgetType = budgetType;

    const settingsList = await Settings.find(query).populate(
      "compensationSettingsId"
    );

    // Merge each with compensation data
    const mergedList = settingsList.map((settings) => {
      const settingsObj = settings.toObject();
      const compensationSettings = settingsObj.compensationSettingsId;

      if (compensationSettings && typeof compensationSettings === "object") {
        // Copy compensation fields
        Object.keys(compensationSettings).forEach((key) => {
          if (
            !key.startsWith("_") &&
            key !== "fiscalYear" &&
            key !== "budgetType" &&
            key !== "notes"
          ) {
            settingsObj[key] = compensationSettings[key];
          }
        });
      }

      return settingsObj;
    });

    return mergedList;
  } catch (error) {
    console.error("Error in getAllSettingsWithCompensation:", error);
    throw error;
  }
}

/**
 * Get compensation field safely with fallback
 * 
 * @param {Object} settings - Settings object
 * @param {String} fieldName - Field name to retrieve
 * @param {*} defaultValue - Default value if not found
 * @returns {*} Field value or default
 */
function getCompensationField(settings, fieldName, defaultValue = 0) {
  if (!settings) return defaultValue;
  
  const value = settings[fieldName];
  return value !== null && value !== undefined ? value : defaultValue;
}

module.exports = {
  getActiveSettingsWithCompensation,
  getAllSettingsWithCompensation,
  getCompensationField,
};