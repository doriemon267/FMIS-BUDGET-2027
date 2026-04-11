const Settings = require("../models/Settings");
const CompensationSettings = require("../models/CompensationSettings");
const RATA = require("../models/RATA");
const PersonnelService = require('../models/PersonnelServices');
const EmployeeCourtAppearance = require("../models/employeeCourtAppearance");
const MealAllowance = require("../models/mealAllowance");
const mongoose = require("mongoose");
const {
  numberFilter,
  dateFilter,
  textFilter,
  booleanFilter,
} = require("../utils/controller_get_process");

const normalizeRoles = (roles = []) => {
  if (!Array.isArray(roles)) return [];
  return roles.map((role) => String(role || '').replace(/\s+/g, '_').toUpperCase());
};

const canManageESignatureToggle = (user = {}) => {
  const normalizedRoles = normalizeRoles(user?.Roles || user?.roles || []);
  return normalizedRoles.some((role) => [
    'SUPER_ADMIN',
    'BUDGET_MANAGER',
    'BUDGET_OFFICER',
    'BUDGET_PLANNING_ANALYST',
  ].includes(role));
};

// ==================== ENHANCED FUNCTIONS ====================

/**
 * Create Settings with Regions and Budget Periods
 * This replaces the old createSettings function
 * 
 * ✅ STRICT SEPARATION GUARANTEE:
 * - NO compensation is auto-created or auto-linked
 * - New fiscal years are ALWAYS created WITHOUT compensation
 * - Compensation must be created separately and linked explicitly
 */
exports.createSettingsWithRegions = async (req, res) => {
  try {
    const {
      fiscalYear,
      budgetType,
      applicableRegions = ["All"],
      budgetPeriods = [],
      regionDueDateExtensions = [],
      isActive = true,
      eSignatureRequired = true,
    } = req.body;

    if (req.body?.eSignatureRequired !== undefined && !canManageESignatureToggle(req.user)) {
      return res.status(403).json({
        message: "You are not authorized to change the e-signature requirement setting.",
      });
    }

    // ⚠️ STRICT SEPARATION: Explicitly reject ANY compensation data sent with fiscal year creation
    // Compensation MUST be linked separately via Compensation Management page
    // This ensures NO accidental auto-creation or auto-linking of compensation
    const compensationFields = [
      'compensationData', 'PERA', 'hazardPay', 'RATA', 'medicalAllowance','additionalMedical', 'meal',
      'uniformALLOWANCE', 'productivityIncentive', 'cashGift', 'midyearBonus',
      'yearEndBonus', 'gsisPremium', 'pagibigPremium', 'employeeCompensation',
      'philhealthPremium', 'subsistenceAllowance', 'overtimeRate', 'weekdayMultiplier',
      'weekendMultiplier', 'earnedLeaves', 'compensationSettingsId'
    ];
    
    for (const field of compensationFields) {
      if (req.body[field] !== undefined) {
        console.warn(`⚠️ [STRICT SEPARATION] Rejection: ${field} attempted in fiscal year creation`);
        return res.status(400).json({
          message: `❌ Compensation field "${field}" cannot be set during fiscal year creation. Go to 'Compensation Management' page to link compensation after creating this fiscal year.`,
          reason: "STRICT_SEPARATION_ENFORCEMENT",
          detail: "Fiscal years and compensation settings are completely independent. After creating this fiscal year, use Compensation Management to link existing compensation settings to it."
        });
      }
    }

    // Validate
    if (!fiscalYear || !budgetType) {
      return res.status(400).json({
        message: "fiscalYear and budgetType are required",
      });
    }

    if (budgetPeriods.length === 0) {
      return res.status(400).json({
        message: "At least one budget period is required",
      });
    }

    // Check for duplicates
    const existingSettings = await Settings.findOne({ fiscalYear, budgetType });
    if (existingSettings) {
      return res.status(400).json({
        field: "fiscalYear",
        message:
          "Settings for this fiscal year and budget type already exist.",
      });
    }

    // Validate budget periods
    for (const period of budgetPeriods) {
      if (!period.periodName || !period.startDate || !period.dueDate) {
        return res.status(400).json({
          message:
            "Each budget period must have periodName, startDate, and dueDate",
        });
      }
      const start = new Date(period.startDate);
      const due = new Date(period.dueDate);
      if (start >= due) {
        return res.status(400).json({
          message: `In period "${period.periodName}": startDate must be before dueDate`,
        });
      }
    }

    // ✅ CRITICAL: compensationSettingsId is ALWAYS null during creation
    // Compensation templates are created on Compensation Settings page
    // But linking to fiscal years happens ONLY through Compensation Management page
    // This is enforced and guaranteed - NO auto-creation, NO auto-linking
    const compensationSettingsId = null;

    // Deactivate other settings if this is active
    if (isActive) {
      await Settings.updateMany({}, { isActive: false });
    }

    // Prepare budget periods with proper dates
    const processedPeriods = budgetPeriods.map((period, index) => ({
      periodName: period.periodName,
      startDate: new Date(period.startDate),
      dueDate: new Date(period.dueDate),
      isActive: index === 0 ? true : false, // First period is active by default
      createdAt: new Date(),
    }));

    // Process region due date extensions if provided
    const processedExtensions = (Array.isArray(regionDueDateExtensions) ? regionDueDateExtensions : []).map((ext) => ({
      regions: Array.isArray(ext.regions) ? ext.regions : [],
      dueDate: ext.dueDate ? new Date(ext.dueDate) : null,
      label: ext.label || null,
      createdAt: new Date(),
    })).filter((ext) => ext.regions.length > 0 && ext.dueDate);

    // Create settings
    const newSettings = new Settings({
      fiscalYear,
      budgetType,
      applicableRegions,
      budgetPeriods: processedPeriods,
      regionDueDateExtensions: processedExtensions,
      compensationSettingsId, // Always null - by design - NO compensation auto-creation
      isActive,
      eSignatureRequired,
      // For backward compatibility, set first period dates
      startDate: processedPeriods[0].startDate,
      dueDate: processedPeriods[0].dueDate,
    });

    await newSettings.save();

    // ✅ POST-SAVE VERIFICATION: Ensure NO compensation was auto-linked
    const savedSettings = await Settings.findById(newSettings._id);
    if (savedSettings.compensationSettingsId !== null && savedSettings.compensationSettingsId !== undefined) {
      console.error("🔴 SECURITY VIOLATION: Compensation auto-linked during fiscal year creation!");
      throw new Error("STRICT SEPARATION VIOLATION: Compensation was unexpectedly auto-linked");
    }

    // Populate compensation settings in response (will be null, which is correct)
    await newSettings.populate("compensationSettingsId");

    // Final verification in response
    if (newSettings.compensationSettingsId !== null && newSettings.compensationSettingsId !== undefined) {
      console.error("🔴 RESPONSE VIOLATION: Compensation populated in response!");
      throw new Error("STRICT SEPARATION VIOLATION: Compensation should not be returned");
    }

    res.status(201).json({
      message: "✅ Settings created successfully (without compensation - as designed)",
      settings: newSettings,
      info: {
        hasCompensation: false,
        compensationLinked: "No - must be linked separately",
        nextStep: "Go to 'Compensation Management' page to link existing compensation settings to this fiscal year"
      }
    });
  } catch (error) {
    console.error("Error in createSettingsWithRegions:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * Extend Budget Period (Add new period for extension)
 */
exports.extendBudgetPeriod = async (req, res) => {
  try {
    const { id } = req.params;
    const { periodName, startDate, dueDate } = req.body;

    if (!periodName || !startDate || !dueDate) {
      return res.status(400).json({
        message: "periodName, startDate, and dueDate are required",
      });
    }

    const settings = await Settings.findById(id);
    if (!settings) {
      return res.status(404).json({ message: "Settings not found" });
    }

    const start = new Date(startDate);
    const due = new Date(dueDate);

    if (start >= due) {
      return res.status(400).json({
        message: "startDate must be before dueDate",
      });
    }

    // Validate that new period doesn't overlap with existing ones
    const lastPeriod = settings.budgetPeriods[settings.budgetPeriods.length - 1];
    if (lastPeriod && start < lastPeriod.dueDate) {
      return res.status(400).json({
        message: `New period start date must be after the last period's due date (${lastPeriod.dueDate.toISOString()})`,
      });
    }

    // Add new period (not active by default)
    const newPeriod = {
      periodName,
      startDate: start,
      dueDate: due,
      isActive: false,
      createdAt: new Date(),
    };

    settings.budgetPeriods.push(newPeriod);
    await settings.save();

    await settings.populate("compensationSettingsId");

    res.status(200).json({
      message: "Budget period extended successfully",
      settings,
      newPeriod,
    });
  } catch (error) {
    console.error("Error in extendBudgetPeriod:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * Activate specific budget period manually
 */
exports.activateBudgetPeriod = async (req, res) => {
  try {
    const { id } = req.params;
    const { periodIndex } = req.body;

    if (periodIndex === undefined) {
      return res.status(400).json({
        message: "periodIndex is required",
      });
    }

    const settings = await Settings.findById(id);
    if (!settings) {
      return res.status(404).json({ message: "Settings not found" });
    }

    if (
      periodIndex < 0 ||
      periodIndex >= settings.budgetPeriods.length
    ) {
      return res.status(400).json({
        message: `Invalid periodIndex. Valid range is 0-${settings.budgetPeriods.length - 1}`,
      });
    }

    // Deactivate all periods
    settings.budgetPeriods.forEach((period) => {
      period.isActive = false;
    });

    // Activate selected period
    settings.budgetPeriods[periodIndex].isActive = true;

    // Update backward compatibility fields
    settings.startDate = settings.budgetPeriods[periodIndex].startDate;
    settings.dueDate = settings.budgetPeriods[periodIndex].dueDate;

    await settings.save();
    await settings.populate("compensationSettingsId");

    res.status(200).json({
      message: `Budget period "${settings.budgetPeriods[periodIndex].periodName}" activated successfully`,
      settings,
    });
  } catch (error) {
    console.error("Error in activateBudgetPeriod:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * Get Settings by Region
 */
exports.getSettingsByRegion = async (req, res) => {
  try {
    const { region } = req.params;

    const settings = await Settings.find({
      $or: [
        { applicableRegions: "All" },
        { applicableRegions: region },
      ],
    })
      .populate("compensationSettingsId")
      .sort({ fiscalYear: -1, createdAt: -1 });

    if (!settings || settings.length === 0) {
      return res.status(404).json({
        message: `No settings found for region: ${region}`,
      });
    }

    res.status(200).json({
      message: `Settings for region "${region}" retrieved successfully`,
      region,
      settings,
    });
  } catch (error) {
    console.error("Error in getSettingsByRegion:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * Get Current Active Settings with Budget Periods
 */
exports.getActiveSettingsWithPeriods = async (req, res) => {
  try {
    const { region } = req.query;

    let query = { isActive: true };
    if (region) {
      query.$or = [
        { applicableRegions: "All" },
        { applicableRegions: region },
      ];
    }

    const settings = await Settings.findOne(query).populate(
      "compensationSettingsId"
    );

    if (!settings) {
      return res.status(404).json({
        message: region
          ? `No active settings found for region: ${region}`
          : "No active settings found",
      });
    }

    // Get active period
    const activePeriod =
      settings.budgetPeriods.find((p) => p.isActive) ||
      settings.budgetPeriods[0];

    res.status(200).json({
      message: "Active settings retrieved successfully",
      settings,
      activePeriod,
    });
  } catch (error) {
    console.error("Error in getActiveSettingsWithPeriods:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * Update Compensation Settings (for a fiscal year)
 * ✅ STRICT SEPARATION: Compensation MUST be pre-linked, will NOT auto-create
 */
exports.updateCompensationSettings = async (req, res) => {
  try {
    const { id } = req.params; // Settings ID
    const updateData = req.body;

    const settings = await Settings.findById(id);
    if (!settings) {
      return res.status(404).json({ message: "Settings not found" });
    }

    // ✅ STRICT SEPARATION: Compensation MUST already be linked
    // Do NOT auto-create - users must link first via Compensation Management page
    if (!settings.compensationSettingsId) {
      return res.status(400).json({
        message: "No compensation settings linked to this fiscal year. Please go to 'Compensation Management' page and link existing compensation settings to this fiscal year.",
      });
    }

    // Update existing linked compensation
    await CompensationSettings.findByIdAndUpdate(
      settings.compensationSettingsId,
      updateData,
      { new: true, runValidators: true }
    );

    await settings.populate("compensationSettingsId");

    res.status(200).json({
      message: "Compensation settings updated successfully",
      settings,
    });
  } catch (error) {
    console.error("Error in updateCompensationSettings:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ==================== LEGACY FUNCTIONS (for backward compatibility) ====================

exports.createSettings = async (req, res) => {
  try {
    const { fiscalYear, budgetType, isActive } = req.body;
    const existingSettings = await Settings.findOne({ fiscalYear, budgetType });
    if (existingSettings) {
      return res.status(400).json({
        field: "fiscalYear",
        message:
          "Settings for this fiscal year and budget type already exist.",
      });
    }
    if (isActive) {
      await Settings.updateMany({}, { isActive: false });
    }
    const settingsData = {
      ...req.body,
      medicalAllowance:
        req.body.medicalAllowance !== undefined ? req.body.medicalAllowance : 200,
      meal: req.body.meal !== undefined ? req.body.meal : 200,
    };
    const newSettings = new Settings(settingsData);
    await newSettings.save();
    res.status(201).json(newSettings);
  } catch (error) {
    console.error("Error in createSettings:", error.stack);
    res.status(500).json({ message: "Server error", error });
  }
};

exports.getAllSettings = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      orderBy,
      order = "asc",
      operator,
      ...filters
    } = req.query;
    let query = {}; // No filter - show ALL settings
    if (search && search.split("-").length !== 3) {
      query.$or = [{ fiscalYear: { $regex: search, $options: "i" } }];
    }
    numberFilter(query, filters, operator);
    booleanFilter(query, { isActive: filters.isActive });
    dateFilter(query, { createdAt: filters.createdAt });
    const sortQuery = {
      [orderBy || "createdAt"]: order.toLowerCase() === "desc" ? -1 : 1,
    };
    const skip = (Number(page) - 1) * Number(limit);
    const settings = await Settings.find(query)
      .populate("compensationSettingsId")
      .skip(skip)
      .limit(Number(limit))
      .sort(sortQuery);
    const totalRecords = await Settings.countDocuments(query);
    return res.json({
      settings,
      totalPages: Math.ceil(totalRecords / limit),
      currentPage: Number(page),
      totalRecords,
    });
  } catch (error) {
    console.error("Error in getAllSettings:", error.stack);
    return res.status(500).json({ message: "Server error", error });
  }
};

/**
 * Get Settings with Compensation Data Only
 * Used specifically for the Compensation Settings page
 * Only returns Settings records that have explicit CompensationSettings configured
 */
exports.getCompensationOnlySettings = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      orderBy,
      order = "asc",
      operator,
      ...filters
    } = req.query;
    // Filter to ONLY show Settings that have explicit CompensationSettings configured
    let query = {
      compensationSettingsId: { $ne: null }
    };
    if (search && search.split("-").length !== 3) {
      query.$or = [{ fiscalYear: { $regex: search, $options: "i" } }];
    }
    numberFilter(query, filters, operator);
    booleanFilter(query, { isActive: filters.isActive });
    dateFilter(query, { createdAt: filters.createdAt });
    const sortQuery = {
      [orderBy || "createdAt"]: order.toLowerCase() === "desc" ? -1 : 1,
    };
    const skip = (Number(page) - 1) * Number(limit);
    const settings = await Settings.find(query)
      .populate("compensationSettingsId")
      .skip(skip)
      .limit(Number(limit))
      .sort(sortQuery);
    const totalRecords = await Settings.countDocuments(query);
    return res.json({
      settings,
      totalPages: Math.ceil(totalRecords / limit),
      currentPage: Number(page),
      totalRecords,
    });
  } catch (error) {
    console.error("Error in getCompensationOnlySettings:", error.stack);
    return res.status(500).json({ message: "Server error", error });
  }
};

exports.getActiveSettings = async (req, res) => {
  try {
    const { region } = req.query;
    const activeSettings = await Settings.findOne({ isActive: true }).populate(
      "compensationSettingsId"
    );
    if (!activeSettings) {
      return res.status(404).json({ message: "No active fiscal year found." });
    }
    const payload = activeSettings.toObject ? activeSettings.toObject() : activeSettings;

    // When region is provided, compute effective due date (considers region-specific extensions)
    if (region) {
      const { getEffectiveDueDateForRegion } = require("../utils/settingsUtils");
      const { dueDate: effectiveDueDate, isExtension } = getEffectiveDueDateForRegion(
        activeSettings,
        [String(region)]
      );
      payload.effectiveDueDate = effectiveDueDate ? effectiveDueDate.toISOString() : null;
      payload.effectiveIsExtension = isExtension || false;
    }

    res.status(200).json(payload);
  } catch (error) {
    console.error("Error in getActiveSettings:", error.stack);
    res.status(500).json({ message: "Server error", error });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      fiscalYear,
      startDate,
      dueDate,
      budgetType,
      budgetPeriods,
      applicableRegions,
      regionDueDateExtensions,
      isActive,
      eSignatureRequired,
      ...otherSettings
    } = req.body;

    if (req.body?.eSignatureRequired !== undefined && !canManageESignatureToggle(req.user)) {
      return res.status(403).json({
        message: "You are not authorized to change the e-signature requirement setting.",
      });
    }

    // ⚠️ STRICT: Reject compensation-related fields during fiscal year settings update
    // These fields belong to CompensationSettings and must be managed separately
    const rejectedCompensationFields = [
      'meal', 'medicalAllowance', 'PERA', 'hazardPay', 'RATA',
      'uniformALLOWANCE', 'productivityIncentive', 'cashGift','additionalMedical', 'midyearBonus',
      'yearEndBonus', 'gsisPremium', 'pagibigPremium', 'employeeCompensation',
      'philhealthPremium', 'subsistenceAllowance', 'overtimeRate', 'weekdayMultiplier',
      'weekendMultiplier', 'earnedLeaves', 'compensationSettingsId', 'compensationData'
    ];

    for (const field of rejectedCompensationFields) {
      if (req.body[field] !== undefined) {
        return res.status(400).json({
          message: `Compensation field "${field}" cannot be updated here. Use the Compensation Settings page to manage compensation values.`,
        });
      }
    }

    const existing = await Settings.findById(id);
    if (!existing) {
      return res.status(404).json({ message: "Settings not found." });
    }

    if (
      (fiscalYear !== undefined && fiscalYear !== existing.fiscalYear) ||
      (budgetType !== undefined && budgetType !== existing.budgetType)
    ) {
      const dup = await Settings.findOne({
        fiscalYear: fiscalYear ?? existing.fiscalYear,
        budgetType: budgetType ?? existing.budgetType,
      });
      if (dup && String(dup._id) !== String(existing._id)) {
        return res.status(400).json({
          field: "fiscalYear",
          message:
            "Settings for this fiscal year and budget type already exist.",
        });
      }
    }

    if (isActive === true && existing.isActive === false) {
      await Settings.updateMany({}, { $set: { isActive: false } });
    }

    const toUpdate = {};
    if (fiscalYear !== undefined) toUpdate.fiscalYear = fiscalYear;
    if (budgetType !== undefined) toUpdate.budgetType = budgetType;
    if (applicableRegions !== undefined) toUpdate.applicableRegions = applicableRegions;
    if (isActive !== undefined) toUpdate.isActive = isActive;
    if (eSignatureRequired !== undefined) toUpdate.eSignatureRequired = Boolean(eSignatureRequired);

    // Handle region due date extensions (same FY + budget type, extended due date per region)
    if (regionDueDateExtensions !== undefined && Array.isArray(regionDueDateExtensions)) {
      toUpdate.regionDueDateExtensions = regionDueDateExtensions.map((ext) => ({
        regions: Array.isArray(ext.regions) ? ext.regions : [],
        dueDate: ext.dueDate ? new Date(ext.dueDate) : null,
        label: ext.label || null,
        createdAt: ext.createdAt ? new Date(ext.createdAt) : new Date(),
      })).filter((ext) => ext.regions.length > 0 && ext.dueDate);
    }
    
    // Handle budgetPeriods update - this is the new structure
    if (budgetPeriods !== undefined && Array.isArray(budgetPeriods)) {
      // Process budget periods with proper date conversion
      const processedPeriods = budgetPeriods.map((period, index) => ({
        periodName: period.periodName || `Phase ${index + 1}`,
        startDate: period.startDate ? new Date(period.startDate) : null,
        dueDate: period.dueDate ? new Date(period.dueDate) : null,
        isActive: period.isActive ?? (index === 0),
        createdAt: period.createdAt || new Date()
      }));
      toUpdate.budgetPeriods = processedPeriods;
      
      // Sync legacy fields from the active period for backward compatibility
      const activePeriod = processedPeriods.find(p => p.isActive) || processedPeriods[0];
      if (activePeriod) {
        toUpdate.startDate = activePeriod.startDate;
        toUpdate.dueDate = activePeriod.dueDate;
      }
    } else {
      // If only legacy fields are sent (for backward compatibility)
      if (startDate !== undefined) toUpdate.startDate = new Date(startDate);
      if (dueDate !== undefined) toUpdate.dueDate = new Date(dueDate);
    }
    
    // Only allow non-compensation fields from otherSettings
    for (const [k, v] of Object.entries(otherSettings)) {
      if (v !== undefined && !rejectedCompensationFields.includes(k)) {
        toUpdate[k] = v;
      }
    }

    const updatedSettings = await Settings.findByIdAndUpdate(id, { $set: toUpdate }, {
      new: true,
      runValidators: true,
    }).populate("compensationSettingsId");

    if (eSignatureRequired !== undefined) {
      const previousValue = existing?.eSignatureRequired !== false;
      const currentValue = updatedSettings?.eSignatureRequired !== false;

      req._settingsAuditDetails = {
        ...req._settingsAuditDetails,
        eSignatureRequired: {
          changed: previousValue !== currentValue,
          previous: previousValue,
          current: currentValue,
          previousLabel: previousValue ? 'Required' : 'Optional',
          currentLabel: currentValue ? 'Required' : 'Optional',
        },
      };
    }

    // User activity log snapshot (before/after) for audit
    try {
      const { setSnapshot } = require("../middleware/userLogs");
      setSnapshot(req, existing, updatedSettings);
    } catch (_) { /* ignore */ }

    // ✅ STRICT SEPARATION: Compensation-related updates are handled in updateCompensationSettings
    // No meal/medical allowance updates happen here - only in the dedicated Compensation Settings endpoint
    
    res.status(200).json({
      message: "Settings updated successfully",
      settings: updatedSettings,
    });
  } catch (error) {
    console.error("Error in updateSettings:", error.stack);
    return res.status(500).json({ message: "Server error", error });
  }
};

exports.deleteSettings = async (req, res) => {
  try {
    const { id } = req.params;
    const settings = await Settings.findById(id);
    
    // Also delete associated compensation settings
    if (settings?.compensationSettingsId) {
      await CompensationSettings.findByIdAndDelete(settings.compensationSettingsId);
    }

    await Settings.findByIdAndDelete(id);
    res.status(200).json({ message: "Settings deleted successfully." });
  } catch (error) {
    console.error("Error in deleteSettings:", error.stack);
    res.status(500).json({ message: "Server error", error });
  }
};

/**
 * Add a region due date extension to an existing settings document (same FY + budget type, extended due date for specific region(s))
 */
exports.addRegionDueDateExtension = async (req, res) => {
  try {
    const { id } = req.params;
    const { regions = [], dueDate, label } = req.body;
    if (!Array.isArray(regions) || regions.length === 0 || !dueDate) {
      return res.status(400).json({
        message: "regions (array) and dueDate are required for a region extension.",
      });
    }
    const settings = await Settings.findById(id);
    if (!settings) {
      return res.status(404).json({ message: "Settings not found." });
    }
    const extensions = settings.regionDueDateExtensions || [];
    const newExt = {
      regions,
      dueDate: new Date(dueDate),
      label: label || null,
      createdAt: new Date(),
    };
    extensions.push(newExt);
    settings.regionDueDateExtensions = extensions;
    await settings.save();
    const updated = await Settings.findById(id).populate("compensationSettingsId");
    res.status(200).json({
      message: "Region due date extension added successfully.",
      settings: updated,
    });
  } catch (error) {
    console.error("Error in addRegionDueDateExtension:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * Update a region due date extension by its _id (subdocument id)
 */
exports.updateRegionDueDateExtension = async (req, res) => {
  try {
    const { id, extensionId } = req.params;
    const { regions, dueDate, label } = req.body;
    const settings = await Settings.findById(id);
    if (!settings) {
      return res.status(404).json({ message: "Settings not found." });
    }
    const extensions = settings.regionDueDateExtensions || [];
    const idx = extensions.findIndex((e) => String(e._id) === String(extensionId));
    if (idx === -1) {
      return res.status(404).json({ message: "Region extension not found." });
    }
    if (Array.isArray(regions) && regions.length > 0) {
      extensions[idx].regions = regions;
    }
    if (dueDate !== undefined) {
      extensions[idx].dueDate = new Date(dueDate);
    }
    if (label !== undefined) {
      extensions[idx].label = label || null;
    }
    settings.regionDueDateExtensions = extensions;
    await settings.save();
    const updated = await Settings.findById(id).populate("compensationSettingsId");
    res.status(200).json({
      message: "Region due date extension updated successfully.",
      settings: updated,
    });
  } catch (error) {
    console.error("Error in updateRegionDueDateExtension:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * Remove a region due date extension by its _id (subdocument id)
 */
exports.removeRegionDueDateExtension = async (req, res) => {
  try {
    const { id, extensionId } = req.params;
    const settings = await Settings.findById(id);
    if (!settings) {
      return res.status(404).json({ message: "Settings not found." });
    }
    const extensions = settings.regionDueDateExtensions || [];
    const idx = extensions.findIndex((e) => String(e._id) === String(extensionId));
    if (idx === -1) {
      return res.status(404).json({ message: "Region extension not found." });
    }
    extensions.splice(idx, 1);
    settings.regionDueDateExtensions = extensions;
    await settings.save();
    const updated = await Settings.findById(id).populate("compensationSettingsId");
    res.status(200).json({
      message: "Region due date extension removed successfully.",
      settings: updated,
    });
  } catch (error) {
    console.error("Error in removeRegionDueDateExtension:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.setActiveFiscalYear = async (req, res) => {
  try {
    const { id } = req.params;
    const settings = await Settings.findById(id);
    if (!settings) {
      return res.status(404).json({ message: "Settings not found." });
    }
    await Settings.updateMany({}, { isActive: false });
    settings.isActive = true;
    await settings.save();
    await settings.populate("compensationSettingsId");
    res.status(200).json({
      message: "Fiscal year activated successfully.",
      settings,
    });
  } catch (error) {
    console.error("Error in setActiveFiscalYear:", error.stack);
    res.status(500).json({ message: "Server error", error });
  }
};

exports.getAdvancedSettings = async (req, res) => {
  try {
    const { fiscalYear } = req.params;
    const { budgetType } = req.query;
    const filter = { fiscalYear };
    if (budgetType) filter.budgetType = budgetType;
    const settings = await Settings.findOne(filter).populate(
      "compensationSettingsId"
    );
    if (!settings) {
      return res
        .status(404)
        .json({ message: "Settings not found for this fiscal year." });
    }

    // If compensation settings exist, return those
    if (settings.compensationSettingsId) {
      return res.status(200).json(settings.compensationSettingsId);
    }

    // Otherwise return legacy fields
    const advancedFields = {
      PERA: settings.PERA,
      uniformAllowance: settings.uniformAllowance,
      productivityIncentive: settings.productivityIncentive,
      medicalAllowance: settings.medicalAllowance,
      cashGift: settings.cashGift,
      meal: settings.meal,
      courtAppearance: settings.courtAppearance,
      gsisPremium: settings.gsisPremium,
      providentFund: settings.providentFund,
      philhealthPremium: settings.philhealthPremium,
      pagibigPremium: settings.pagibigPremium,
      employeeCompensation: settings.employeeCompensation,
      overtimeRate: settings.overtimeRate,
      weekdayMultiplier: settings.weekdayMultiplier,
      weekendMultiplier: settings.weekendMultiplier,
      subsistenceAllowanceRate: settings.subsistenceAllowanceRate,
      subsistenceAllowanceMonthlyTiers: {
        eightHoursOrMore: 150,
        sixToLessThanEight: 125,
        fiveToLessThanSix: 100,
        fourToLessThanFive: 75,
        belowFour: 0,
        workDaysPerMonth: 22,
      },
      subsistenceAllowanceHourThresholds: {
        eightHoursOrMoreMin: 8,
        sixToLessThanEightMin: 6,
        fiveToLessThanSixMin: 5,
        fourToLessThanFiveMin: 4,
      },
      earnedLeaves: settings.earnedLeaves,
      additionalMedical: settings.additionalMedical,
    };
    res.status(200).json(advancedFields);
  } catch (error) {
    console.error("Error fetching advanced settings:", error.stack);
    res.status(500).json({ message: "Server error", error });
  }
};

// ==================== STANDALONE COMPENSATION ENDPOINTS ====================

/**
 * Create Compensation Settings (STANDALONE - NOT tied to fiscal years)
 * Users choose which compensation to apply to each fiscal year separately
 */
exports.createCompensationSettings = async (req, res) => {
  try {
    const { name, description, ...compensationData } = req.body;

    if (!name) {
      return res.status(400).json({
        message: "Compensation name is required",
      });
    }

    // ✅ STRICT SEPARATION: Compensation created independently, NOT during fiscal year creation
    // ✅ ENSURE ALL FIELDS ARE INITIALIZED with proper defaults
    const newCompensation = new CompensationSettings({
      name,
      description,
      // Personnel Services
      hazardPay: compensationData.hazardPay ?? 0,
      subsistenceAllowance: compensationData.subsistenceAllowance ?? 0,
      honoraria: compensationData.honoraria ?? 0,
      PERA: compensationData.PERA ?? 0,
      uniformAllowance: compensationData.uniformAllowance ?? 0,
      productivityIncentive: compensationData.productivityIncentive ?? 0,
      // Allowances
      medicalAllowance: compensationData.medicalAllowance ?? 200,
      childrenAllowance: compensationData.childrenAllowance ?? 0,
      meal: compensationData.meal ?? 200,
      cashGift: compensationData.cashGift ?? 0,
      additionalMedical: compensationData.additionalMedical ?? 0,
      courtAppearance: compensationData.courtAppearance ?? 0,
      // Premiums
      gsisPremium: compensationData.gsisPremium ?? 0,
      providentFund: compensationData.providentFund ?? 0,
      philhealthPremium: compensationData.philhealthPremium ?? 0,
      pagibigPremium: compensationData.pagibigPremium ?? 0,
      employeeCompensation: compensationData.employeeCompensation ?? 0,
      // Leave & Benefits
      earnedLeaves: compensationData.earnedLeaves ?? 0,
      retirementBenefits: compensationData.retirementBenefits ?? 0,
      terminalLeave: compensationData.terminalLeave ?? 0,
      // Overtime Rates
      weekdayMultiplier: compensationData.weekdayMultiplier ?? 1.25,
      weekendMultiplier: compensationData.weekendMultiplier ?? 1.5,
      // Subsistence Allowance
      subsistenceAllowanceRate: compensationData.subsistenceAllowanceRate ?? 0,
      subsistenceAllowanceMonthlyTiers: {
        eightHoursOrMore: compensationData.subsistenceAllowanceMonthlyTiers?.eightHoursOrMore ?? 150,
        sixToLessThanEight: compensationData.subsistenceAllowanceMonthlyTiers?.sixToLessThanEight ?? 125,
        fiveToLessThanSix: compensationData.subsistenceAllowanceMonthlyTiers?.fiveToLessThanSix ?? 100,
        fourToLessThanFive: compensationData.subsistenceAllowanceMonthlyTiers?.fourToLessThanFive ?? 75,
        belowFour: compensationData.subsistenceAllowanceMonthlyTiers?.belowFour ?? 0,
        workDaysPerMonth: compensationData.subsistenceAllowanceMonthlyTiers?.workDaysPerMonth ?? 22,
      },
      subsistenceAllowanceHourThresholds: {
        eightHoursOrMoreMin: compensationData.subsistenceAllowanceHourThresholds?.eightHoursOrMoreMin ?? 8,
        sixToLessThanEightMin: compensationData.subsistenceAllowanceHourThresholds?.sixToLessThanEightMin ?? 6,
        fiveToLessThanSixMin: compensationData.subsistenceAllowanceHourThresholds?.fiveToLessThanSixMin ?? 5,
        fourToLessThanFiveMin: compensationData.subsistenceAllowanceHourThresholds?.fourToLessThanFiveMin ?? 4,
      },
      subsistenceAllowanceSTRates: {
        highRisk: {
          fifteenOrMoreDays: compensationData.subsistenceAllowanceSTRates?.highRisk?.fifteenOrMoreDays ?? 0.3,
          eightToFourteenDays: compensationData.subsistenceAllowanceSTRates?.highRisk?.eightToFourteenDays ?? 0.23,
          lessThanEightDays: compensationData.subsistenceAllowanceSTRates?.highRisk?.lessThanEightDays ?? 0.15,
        },
        lowRisk: {
          fifteenOrMoreDays: compensationData.subsistenceAllowanceSTRates?.lowRisk?.fifteenOrMoreDays ?? 0.15,
          eightToFourteenDays: compensationData.subsistenceAllowanceSTRates?.lowRisk?.eightToFourteenDays ?? 0.12,
          lessThanEightDays: compensationData.subsistenceAllowanceSTRates?.lowRisk?.lessThanEightDays ?? 0.1,
        },
      },
      // Loyalty Pay
      loyaltyPay: {
        baseYears: compensationData.loyaltyPay?.baseYears ?? 10,
        baseAmount: compensationData.loyaltyPay?.baseAmount ?? 10000,
        succeedingInterval: compensationData.loyaltyPay?.succeedingInterval ?? 5,
        succeedingAmount: compensationData.loyaltyPay?.succeedingAmount ?? 5000,
        cutoffDate: compensationData.loyaltyPay?.cutoffDate ?? "06-22",
      },
      // Audit trail
      lastModifiedBy: compensationData.lastModifiedBy,
      lastModifiedReason: compensationData.lastModifiedReason,
      notes: compensationData.notes,
    });

    await newCompensation.save();

    res.status(201).json({
      message: "Compensation settings created successfully",
      compensationSettings: newCompensation,
    });
  } catch (error) {
    console.error("Error in createCompensationSettings:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * Get all available Compensation Settings
 * ✅ NOW INCLUDES: For each compensation, fetch which fiscal years are linked to it
 */
exports.getCompensationSettings = async (req, res) => {
  try {
    const compensations = await CompensationSettings.find().sort({
      createdAt: -1,
    });

    console.log("📦 getCompensationSettings: Found", compensations.length, "compensation(s)");

    // ✅ ENHANCEMENT: For each compensation, get the linked fiscal years
    const compensationsWithLinks = await Promise.all(
      compensations.map(async (compensation) => {
        // Find all Settings (fiscal years) linked to this compensation
        const linkedSettings = await Settings.find({
          compensationSettingsId: compensation._id,
        }).select("_id fiscalYear budgetType");

        // Extract the IDs for display purposes
        const linkedFiscalYears = linkedSettings.map((setting) => setting._id);

        console.log(`   - ${compensation.name}:`);
        console.log(`     - ID: ${compensation._id}`);
        console.log(`     - Linked fiscal years: ${linkedFiscalYears.length}`);
        linkedSettings.forEach(s => {
          console.log(`       • FY ${s.fiscalYear} (${s.budgetType}) - ${s._id}`);
        });

        return {
          ...compensation.toObject(),
          linkedFiscalYears,
          linkedCount: linkedFiscalYears.length,
        };
      })
    );

    res.status(200).json({
      message: "Compensation settings retrieved successfully",
      count: compensations.length,
      compensationSettings: compensationsWithLinks,
    });
  } catch (error) {
    console.error("Error in getCompensationSettings:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * Update standalone Compensation Settings
 */
exports.updateCompensationSettingsStandalone = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Don't allow changing name during update
    if (updateData.name !== undefined) {
      delete updateData.name;
    }

    const updated = await CompensationSettings.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({
        message: "Compensation settings not found",
      });
    }

    res.status(200).json({
      message: "Compensation settings updated successfully",
      compensationSettings: updated,
    });
  } catch (error) {
    console.error("Error in updateCompensationSettingsStandalone:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * Link/Assign Compensation Settings to a Fiscal Year
 * This is how users map compensation to fiscal years AFTER creation
 */
exports.linkCompensationToSettings = async (req, res) => {
  try {
    const { id } = req.params; // Settings ID
    const { compensationSettingsId } = req.body;

    console.log("🔗 linkCompensationToSettings called:");
    console.log("   - Settings ID:", id);
    console.log("   - Compensation ID:", compensationSettingsId);

    if (!compensationSettingsId) {
      return res.status(400).json({
        message: "compensationSettingsId is required",
      });
    }

    // Verify compensation settings exist
    const compensation = await CompensationSettings.findById(
      compensationSettingsId
    );
    if (!compensation) {
      console.log("❌ Compensation not found:", compensationSettingsId);
      return res.status(404).json({
        message: "Compensation settings not found",
      });
    }
    console.log("✅ Compensation found:", compensation.name);

    // Verify settings exist
    let settings = await Settings.findById(id);
    if (!settings) {
      console.log("❌ Settings not found:", id);
      return res.status(404).json({
        message: "Settings not found",
      });
    }
    console.log("✅ Settings found:", settings.fiscalYear, settings.budgetType);
    console.log("   - Current compensationSettingsId:", settings.compensationSettingsId);

    // Link compensation to fiscal year
    settings.compensationSettingsId = compensationSettingsId;
    console.log("   - Setting compensationSettingsId to:", compensationSettingsId);

    // Save and verify
    const saveResult = await settings.save();
    console.log("✅ Settings saved successfully");
    console.log("   - Saved compensationSettingsId:", saveResult.compensationSettingsId);

    // Re-fetch to verify it was saved
    const verifySettings = await Settings.findById(id);
    console.log("✅ Settings re-fetched to verify:");
    console.log("   - Verified compensationSettingsId:", verifySettings.compensationSettingsId);

    // Populate for response
    await settings.populate("compensationSettingsId");

    res.status(200).json({
      message: `Compensation "${compensation.name}" linked to fiscal year ${settings.fiscalYear} successfully`,
      settings,
    });
  } catch (error) {
    console.error("❌ Error in linkCompensationToSettings:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * Remove compensation link from fiscal year (set to null)
 */
exports.unlinkCompensationFromSettings = async (req, res) => {
  try {
    const { id } = req.params; // Settings ID

    const settings = await Settings.findById(id);
    if (!settings) {
      return res.status(404).json({
        message: "Settings not found",
      });
    }

    const previousCompensationId = settings.compensationSettingsId;
    settings.compensationSettingsId = null;
    await settings.save();
    await settings.populate("compensationSettingsId");

    res.status(200).json({
      message: "Compensation unlinked from fiscal year successfully",
      settings,
    });
  } catch (error) {
    console.error("Error in unlinkCompensationFromSettings:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * Get all fiscal years linked to a specific compensation
 */
exports.getLinkedFiscalYears = async (req, res) => {
  try {
    const { compensationId } = req.params;

    // Verify compensation settings exist
    const compensation = await CompensationSettings.findById(compensationId);
    if (!compensation) {
      return res.status(404).json({
        message: "Compensation settings not found",
      });
    }

    // Find all settings (fiscal years) linked to this compensation
    const linkedSettings = await Settings.find({
      compensationSettingsId: compensationId,
    }).sort({ fiscalYear: 1 });

    // Extract just the IDs for the dialog to use
    const linkedFiscalYears = linkedSettings.map((setting) => setting._id);

    res.status(200).json({
      message: "Linked fiscal years retrieved successfully",
      linkedFiscalYears,
      count: linkedFiscalYears.length,
    });
  } catch (error) {
    console.error("Error in getLinkedFiscalYears:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.updateAdvancedSettings = async (req, res) => {
  try {
    const { fiscalYear } = req.params;
    const { budgetType } = req.query;
    const updateData = req.body;

    if (
      fiscalYear === "2025" &&
      updateData.philhealthPremium !== undefined
    ) {
      if (updateData.philhealthPremium !== 0.05) {
        return res.status(400).json({
          message:
            "PhilHealth premium must be 5% in 2025 per Circular 2019-0009.",
        });
      }
    }

    const filter = { fiscalYear };
    if (budgetType) filter.budgetType = budgetType;

    const settings = await Settings.findOne(filter);
    if (!settings) {
      return res
        .status(404)
        .json({ message: "Settings not found for this fiscal year." });
    }

    // ✅ STRICT SEPARATION: Only update if compensation is ALREADY linked
    // Do NOT auto-create compensation - users must link it first via Compensation Management page
    if (!settings.compensationSettingsId) {
      return res.status(400).json({
        message: "No compensation settings linked to this fiscal year. Please go to 'Compensation Management' page and link existing compensation settings to this fiscal year.",
      });
    }

    const existingCompensation = await CompensationSettings.findById(settings.compensationSettingsId);
    if (!existingCompensation) {
      return res.status(404).json({
        message: "Linked compensation settings not found.",
      });
    }

    if (updateData.subsistenceAllowanceMonthlyTiers) {
      const incomingTiers = updateData.subsistenceAllowanceMonthlyTiers || {};
      const currentTiers = existingCompensation.subsistenceAllowanceMonthlyTiers || {};

      updateData.subsistenceAllowanceMonthlyTiers = {
        eightHoursOrMore: incomingTiers.eightHoursOrMore ?? currentTiers.eightHoursOrMore ?? 150,
        sixToLessThanEight: incomingTiers.sixToLessThanEight ?? currentTiers.sixToLessThanEight ?? 125,
        fiveToLessThanSix: incomingTiers.fiveToLessThanSix ?? currentTiers.fiveToLessThanSix ?? 100,
        fourToLessThanFive: incomingTiers.fourToLessThanFive ?? currentTiers.fourToLessThanFive ?? 75,
        belowFour: incomingTiers.belowFour ?? currentTiers.belowFour ?? 0,
        workDaysPerMonth: incomingTiers.workDaysPerMonth ?? currentTiers.workDaysPerMonth ?? 22,
      };
    }

    if (updateData.subsistenceAllowanceHourThresholds) {
      const incomingThresholds = updateData.subsistenceAllowanceHourThresholds || {};
      const currentThresholds = existingCompensation.subsistenceAllowanceHourThresholds || {};

      updateData.subsistenceAllowanceHourThresholds = {
        eightHoursOrMoreMin:
          incomingThresholds.eightHoursOrMoreMin ?? currentThresholds.eightHoursOrMoreMin ?? 8,
        sixToLessThanEightMin:
          incomingThresholds.sixToLessThanEightMin ?? currentThresholds.sixToLessThanEightMin ?? 6,
        fiveToLessThanSixMin:
          incomingThresholds.fiveToLessThanSixMin ?? currentThresholds.fiveToLessThanSixMin ?? 5,
        fourToLessThanFiveMin:
          incomingThresholds.fourToLessThanFiveMin ?? currentThresholds.fourToLessThanFiveMin ?? 4,
      };
    }

    let compensationSettings;
    // Update existing compensation
    compensationSettings = await CompensationSettings.findByIdAndUpdate(
      settings.compensationSettingsId,
      updateData,
      { new: true, runValidators: true }
    );

    // Recalculate personnel services if needed
    if (updateData.philhealthPremium !== undefined) {
      const personnelServices = await PersonnelServices.find({ fiscalYear });
      for (const personnel of personnelServices) {
        let monthlyPhilhealthPremium;
        const monthlySalary = personnel.monthlySalary;
        if (monthlySalary <= 10000) {
          monthlyPhilhealthPremium = 500;
        } else if (monthlySalary >= 100000) {
          monthlyPhilhealthPremium = 5000;
        } else {
          monthlyPhilhealthPremium = monthlySalary * 0.05;
        }
        const newPhilhealthPremium = (monthlyPhilhealthPremium * 12) / 2;
        const numericFields = [
          "annualSalary",
          "RATA",
          "PERA",
          "uniformALLOWANCE",
          "productivityIncentive",
          "medical",
          "additionalMedical",
          "meal",
          "cashGift",
          "midyearBonus",
          "yearEndBonus",
          "gsisPremium",
          "pagibigPremium",
          "employeeCompensation",
          "subsistenceAllowanceMDS",
          "subsistenceAllowanceST",
          "overtimePay",
          "loyaltyAward",
          "retirementBenefits",
          "terminalLeave",
          "courtAppearance",
          "hazardPay",
          "subsistenceAllowance",
          "honoraria",
          "childrenAllowance",
          "earnedLeaves",
        ];
        personnel.philhealthPremium = newPhilhealthPremium;
        personnel.Total = numericFields.reduce(
          (acc, field) => acc + (Number(personnel[field]) || 0),
          0
        );
        await personnel.save();
      }
    }

    res.status(200).json({
      message: "Advanced settings updated successfully.",
      settings: compensationSettings,
    });
  } catch (error) {
    console.error("Error updating advanced settings:", error.stack);
    res.status(500).json({ message: "Server error", error });
  }
};