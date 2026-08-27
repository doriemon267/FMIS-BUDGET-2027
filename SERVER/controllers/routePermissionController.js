const RoutePermission = require("../models/RoutePermission");
const UserActivityLog = require("../models/UserActivityLog");
const routePermissionCache = require("../utils/routePermissionCache");
const SystemSetting = require("../models/SystemSetting");
const { getRoleAliases } = require("../constants/routePermissionPolicy");

const logActivity = (req, action, details) => {
  if (!req.user) return;
  UserActivityLog.create({
    userId: req.user.userId || "SYSTEM",
    userName: req.user.userName || "SYSTEM",
    userRoles: req.user.Roles || [],
    action,
    resource: "ROUTE_PERMISSION",
    method: req.method,
    ipAddress: req.clientIp || req.ip,
    details
  }).catch(e => console.error("[AuditLog Error]", e.message));
};

// ─── DEFAULT SEED DATA ────────────────────────────────────────────────────────
// These mirror the hard-coded values from CLIENT/src/App.jsx.
// Run POST /api/route-permissions/seed to insert any missing entries.
const SETTINGS_MANAGEMENT_ROLES = [
  "SUPER_ADMIN",
  "BUDGET_PLANNING_ANALYST",
  "BUDGET_OFFICER",
  "BUDGET_MANAGER",
];

const DEFAULT_ROUTE_PERMISSIONS = [
  // ── General / Dashboard ───────────────────────────────────────────────────
  {
    path: "/employee",
    label: "Employee List",
    group: "General",
    requiredPermissions: [],
    requiredWorkflowRoles: ["superAdmin", "preparer", "overallBudgetApprover"],
    excludeRoles: [],
  },
  {
    path: "/allproposal",
    label: "All Proposals (Workflow)",
    group: "Proposals",
    requiredPermissions: [],
    requiredWorkflowRoles: [],
    excludeRoles: [],
  },
  {
    path: "/proposal-details",
    label: "Proposal Details",
    group: "Proposals",
    requiredPermissions: [],
    requiredWorkflowRoles: [
      "superAdmin",
      "preparer",
      "reviewer",
      "approver",
      "overallBudgetApprover",
      "budgetAnalyst",
    ],
    excludeRoles: [],
  },

  // ── Tier / BRD ───────────────────────────────────────────────────────────
  {
    path: "/tier",
    label: "Tier Management",
    group: "Tier",
    requiredPermissions: [],
    requiredWorkflowRoles: [
      "superAdmin",
      "preparer",
      "reviewer",
      "approver",
      "budgetAnalyst",
      "budgetOfficer",
      "budgetManager",
    ],
    excludeRoles: [],
    applicableProposalTypes: ["NEP"],
  },
  {
    path: "/tier-comparison",
    label: "Tier Comparison",
    group: "Tier",
    requiredPermissions: [],
    requiredWorkflowRoles: [
      "BUDGET_PLANNING_ANALYST",
      "budgetAnalyst",
      "BUDGET_OFFICER",
      "BUDGET_MANAGER",
      "overallBudgetApprover",
      "superAdmin",
    ],
    excludeRoles: [],
  },
  {
    path: "/brd-consolidation",
    label: "BRD Consolidation",
    group: "Tier",
    requiredPermissions: [],
    requiredWorkflowRoles: [
      "BUDGET_PLANNING_ANALYST",
      "budgetAnalyst",
      "BUDGET_OFFICER",
      "BUDGET_MANAGER",
      "overallBudgetApprover",
      "superAdmin",
    ],
    excludeRoles: [],
  },
  {
    path: "/comparative-report",
    label: "Comparative Report",
    group: "Tier",
    requiredPermissions: [],
    requiredWorkflowRoles: [
      "preparer",
      "reviewer",
      "approver",
      "superAdmin",
      "budgetAnalyst",
    ],
    excludeRoles: [],
  },
  {
    path: "/nep-ceiling",
    label: "NEP Ceiling",
    group: "Tier",
    requiredPermissions: [],
    requiredWorkflowRoles: [
      "BUDGET_OFFICER",
      "BUDGET_MANAGER",
      "overallBudgetApprover",
      "superAdmin",
    ],
    excludeRoles: [],
  },

  // ── Employee Benefits ─────────────────────────────────────────────────────
  {
    path: "/employeeBenefits",
    label: "Employee Benefits",
    group: "Employee Benefits",
    requiredPermissions: [],
    requiredWorkflowRoles: ["superAdmin", "preparer", "overallBudgetApprover"],
    excludeRoles: [],
  },
  {
    path: "/courtAppearance",
    label: "Court Appearance",
    group: "Employee Benefits",
    requiredPermissions: [],
    requiredWorkflowRoles: ["superAdmin", "preparer", "overallBudgetApprover"],
    excludeRoles: [],
  },
  {
    path: "/overTime",
    label: "Overtime Pay",
    group: "Employee Benefits",
    requiredPermissions: [],
    requiredWorkflowRoles: ["superAdmin", "preparer", "overallBudgetApprover"],
    excludeRoles: [],
  },
  {
    path: "/subsistenceAllowanceMDS",
    label: "Subsistence Allowance MDS",
    group: "Employee Benefits",
    requiredPermissions: [],
    requiredWorkflowRoles: ["superAdmin", "preparer", "overallBudgetApprover"],
    excludeRoles: [],
  },
  {
    path: "/subsistenceAllowanceST",
    label: "Subsistence Allowance ST",
    group: "Employee Benefits",
    requiredPermissions: [],
    requiredWorkflowRoles: ["superAdmin", "preparer", "overallBudgetApprover"],
    excludeRoles: [],
  },
  {
    path: "/subsistenceAllowance",
    label: "Subsistence Allowance",
    group: "Employee Benefits",
    requiredPermissions: [],
    requiredWorkflowRoles: ["superAdmin", "preparer", "overallBudgetApprover"],
    excludeRoles: [],
  },
  {
    path: "/loyaltyPay",
    label: "Loyalty Pay",
    group: "Employee Benefits",
    requiredPermissions: [],
    requiredWorkflowRoles: ["superAdmin", "preparer", "overallBudgetApprover"],
    excludeRoles: [],
  },
  {
    path: "/mealallowance",
    label: "Meal Allowance",
    group: "Employee Benefits",
    requiredPermissions: [],
    requiredWorkflowRoles: ["superAdmin", "preparer", "overallBudgetApprover"],
    excludeRoles: [],
  },
  {
    path: "/medicalAllowance",
    label: "Medical Allowance",
    group: "Employee Benefits",
    requiredPermissions: [],
    requiredWorkflowRoles: ["superAdmin", "preparer", "overallBudgetApprover"],
    excludeRoles: [],
  },
  {
    path: "/childrenAllowance",
    label: "Children's Allowance",
    group: "Employee Benefits",
    requiredPermissions: [],
    requiredWorkflowRoles: ["superAdmin", "preparer", "overallBudgetApprover"],
    excludeRoles: [],
  },
  {
    path: "/retirees",
    label: "Retirees",
    group: "Employee Benefits",
    requiredPermissions: [],
    requiredWorkflowRoles: ["superAdmin", "preparer", "overallBudgetApprover"],
    excludeRoles: [],
  },

  // ── Reports ───────────────────────────────────────────────────────────────
  {
    path: "/consolidated-corporate-income",
    label: "Consolidated Corporate Income",
    group: "Reports",
    requiredPermissions: ["ViewReports"],
    requiredWorkflowRoles: [
      "preparer",
      "reviewer",
      "approver",
      "superAdmin",
      "budgetAnalyst",
    ],
    excludeRoles: [],
  },
  {
    path: "/consolidated-reports",
    label: "Consolidated MOOE Reports",
    group: "Reports",
    requiredPermissions: ["ViewReports"],
    requiredWorkflowRoles: [
      "preparer",
      "reviewer",
      "approver",
      "superAdmin",
      "budgetAnalyst",
    ],
    excludeRoles: [],
  },
  {
    path: "/consolidated-capital-outlay-reports",
    label: "Consolidated Capital Outlay Reports",
    group: "Reports",
    requiredPermissions: ["ViewReports"],
    requiredWorkflowRoles: [
      "preparer",
      "reviewer",
      "approver",
      "superAdmin",
      "budgetAnalyst",
    ],
    excludeRoles: [],
  },
  {
    path: "/consolidated-personnel-services-reports",
    label: "Consolidated Personnel Services Reports",
    group: "Reports",
    requiredPermissions: ["ViewReports"],
    requiredWorkflowRoles: [
      "preparer",
      "reviewer",
      "approver",
      "superAdmin",
      "budgetAnalyst",
    ],
    excludeRoles: [],
  },
  {
    path: "/comprehensive-reports",
    label: "Comprehensive Reports",
    group: "Reports",
    requiredPermissions: ["ViewReports"],
    requiredWorkflowRoles: [
      "superAdmin",
      "budgetAnalyst",
      "preparer",
      "approver",
      "reviewer",
    ],
    excludeRoles: [],
  },

  // ── Settings (restricted) ─────────────────────────────────────────────────
  {
    path: "/categories",
    label: "Categories",
    group: "Settings",
    requiredPermissions: ["ManageSettings"],
    requiredWorkflowRoles: ["regionCreator", "superAdmin"],
    excludeRoles: [],
  },
  {
    path: "/rata",
    label: "RATA Management",
    group: "Settings",
    requiredPermissions: ["ManageSettings"],
    requiredWorkflowRoles: ["regionCreator", "superAdmin"],
    excludeRoles: [],
  },
  {
    path: "/fysettings",
    label: "Fiscal Year Settings",
    group: "Settings",
    requiredPermissions: ["ManageSettings"],
    requiredWorkflowRoles: ["regionCreator", "superAdmin"],
    excludeRoles: ["preparer", "reviewer", "approver"],
  },
  {
    path: "/compensation-management",
    label: "Compensation Management",
    group: "Settings",
    requiredPermissions: ["ManageSettings"],
    requiredWorkflowRoles: ["regionCreator", "superAdmin"],
    excludeRoles: ["preparer", "reviewer", "approver"],
  },
  {
    path: "/settings",
    label: "System Settings",
    group: "Settings",
    requiredPermissions: ["ManageSettings"],
    requiredWorkflowRoles: ["regionCreator", "superAdmin"],
    excludeRoles: ["preparer", "reviewer", "approver"],
  },
  {
    path: "/salary-management",
    label: "Salary Management",
    group: "Settings",
    requiredPermissions: ["ManageSettings"],
    requiredWorkflowRoles: ["superAdmin"],
    excludeRoles: [],
  },
  {
    path: "/salary-table",
    label: "Salary Table",
    group: "Settings",
    requiredPermissions: ["ManageSettings"],
    requiredWorkflowRoles: ["regionCreator", "superAdmin"],
    excludeRoles: [],
  },
  {
    path: "/employee-salary-table",
    label: "Employee Salary Table",
    group: "Settings",
    requiredPermissions: ["ManageSettings"],
    requiredWorkflowRoles: ["regionCreator", "superAdmin"],
    excludeRoles: [],
  },
  {
    path: "/cos-salary-table",
    label: "COS Salary Table",
    group: "Settings",
    requiredPermissions: ["ManageSettings"],
    requiredWorkflowRoles: ["regionCreator", "superAdmin"],
    excludeRoles: [],
  },
  {
    path: "/grouped-income-categories",
    label: "Grouped Income Categories",
    group: "Settings",
    requiredPermissions: ["ManageSettings"],
    requiredWorkflowRoles: ["superAdmin"],
    excludeRoles: [],
  },
  {
    path: "/position-titles",
    label: "Position Titles",
    group: "Settings",
    requiredPermissions: ["ManageSettings"],
    requiredWorkflowRoles: SETTINGS_MANAGEMENT_ROLES,
    excludeRoles: ["preparer", "reviewer", "approver"],
  },
  {
    path: "/hierarchical-user-assignments",
    label: "Hierarchical User Assignments",
    group: "Settings",
    requiredPermissions: ["ManageSettings"],
    requiredWorkflowRoles: SETTINGS_MANAGEMENT_ROLES,
    excludeRoles: ["preparer", "reviewer", "approver"],
  },
  {
    path: "/setup/organization",
    label: "Organization Setup",
    group: "Settings",
    requiredPermissions: ["ManageSettings"],
    requiredWorkflowRoles: SETTINGS_MANAGEMENT_ROLES,
    excludeRoles: ["preparer", "reviewer", "approver"],
  },
  {
    path: "/income-management",
    label: "Income Management",
    group: "Settings",
    requiredPermissions: ["EditAllProposals"],
    requiredWorkflowRoles: ["superAdmin"],
    excludeRoles: [],
  },
  {
    path: "/corporate-income-upload",
    label: "Corporate Income Upload",
    group: "Settings",
    requiredPermissions: ["EditAllProposals"],
    requiredWorkflowRoles: ["superAdmin"],
    excludeRoles: [],
  },
  {
    path: "/mooe-upload",
    label: "MOOE Upload",
    group: "Settings",
    requiredPermissions: ["EditAllProposals"],
    requiredWorkflowRoles: ["superAdmin"],
    excludeRoles: [],
  },
  {
    path: "/database-backup",
    label: "Database Backup",
    group: "Settings",
    requiredPermissions: ["ManageSettings"],
    requiredWorkflowRoles: ["superAdmin"],
    excludeRoles: [],
  },
  {
    path: "/audit-logs",
    label: "Audit Logs",
    group: "Settings",
    requiredPermissions: [],
    requiredWorkflowRoles: ["superAdmin"],
    excludeRoles: [],
  },
  {
    path: "/user-activity-logs",
    label: "User Activity Logs",
    group: "Settings",
    requiredPermissions: [],
    requiredWorkflowRoles: ["superAdmin"],
    excludeRoles: [],
  },
  {
    path: "/bulk-upload-management",
    label: "Bulk Upload Management",
    group: "Settings",
    requiredPermissions: [],
    requiredWorkflowRoles: ["superAdmin"],
    excludeRoles: [],
  },
  {
    path: "/subsidy-monitoring",
    label: "Subsidy Monitoring",
    group: "Settings",
    requiredPermissions: [],
    requiredWorkflowRoles: ["superAdmin"],
    excludeRoles: [],
  },
  {
    path: "/route-permissions",
    label: "Route Permission Management",
    group: "Settings",
    requiredPermissions: ["ManageSettings"],
    requiredWorkflowRoles: ["superAdmin"],
    excludeRoles: [],
  },
];

// ─── CONTROLLERS ─────────────────────────────────────────────────────────────

/**
 * GET /api/route-permissions
 * Returns all route permission configs. Used by the frontend context.
 */
exports.getAll = async (req, res) => {
  try {
    const routes = await RoutePermission.find({ isActive: true }).sort({
      group: 1,
      label: 1,
    });
    return res.json({ routes, "route-permissions": routes });
  } catch (e) {
    console.error("[routePermissionController.getAll]", e);
    return res.status(500).json({ error: "Something went wrong." });
  }
};

/**
 * GET /api/route-permissions/all
 * Returns all route configs (including inactive). Admin view only.
 */
exports.getAllAdmin = async (req, res) => {
  try {
    const routes = await RoutePermission.find().sort({ group: 1, label: 1 });
    return res.json({ routes, "route-permissions": routes });
  } catch (e) {
    console.error("[routePermissionController.getAllAdmin]", e);
    return res.status(500).json({ error: "Something went wrong." });
  }
};

/**
 * PUT /api/route-permissions/:id
 * Update a single route permission config.
 */
exports.update = async (req, res) => {
  const { id } = req.params;
  const { label, group, requiredPermissions, requiredWorkflowRoles, excludeRoles, applicableProposalTypes, isActive } =
    req.body;
  try {
    const updated = await RoutePermission.findByIdAndUpdate(
      id,
      { label, group, requiredPermissions, requiredWorkflowRoles, excludeRoles, applicableProposalTypes, isActive },
      { new: true, runValidators: true }
    );
    if (!updated) {
      return res.status(404).json({ error: "Route permission not found." });
    }
    routePermissionCache.invalidate();
    logActivity(req, "UPDATE_ROUTE_PERMISSION", { routeId: id, path: updated.path, group: updated.group });
    return res.json({ message: "Updated successfully.", route: updated });
  } catch (e) {
    console.error("[routePermissionController.update]", e);
    return res.status(500).json({ error: "Something went wrong." });
  }
};

/**
 * PUT /api/route-permissions/by-path
 * Update by path (convenience endpoint for clients who know the path but not the _id).
 */
exports.updateByPath = async (req, res) => {
  const { path } = req.body;
  if (!path) return res.status(400).json({ error: "path is required." });

  const { label, group, requiredPermissions, requiredWorkflowRoles, excludeRoles, applicableProposalTypes, isActive } =
    req.body;
  try {
    const updated = await RoutePermission.findOneAndUpdate(
      { path },
      { label, group, requiredPermissions, requiredWorkflowRoles, excludeRoles, applicableProposalTypes, isActive },
      { new: true, runValidators: true }
    );
    if (!updated) {
      return res.status(404).json({ error: "Route permission not found." });
    }
    routePermissionCache.invalidate();
    logActivity(req, "UPDATE_ROUTE_PERMISSION_BY_PATH", { path, group: updated.group });
    return res.json({ message: "Updated successfully.", route: updated });
  } catch (e) {
    console.error("[routePermissionController.updateByPath]", e);
    return res.status(500).json({ error: "Something went wrong." });
  }
};

/**
 * POST /api/route-permissions/seed
 * Inserts default route permissions for any paths not yet in the DB.
 * Safe to call multiple times — uses upsert (won't overwrite existing customizations).
 */
exports.seed = async (req, res) => {
  try {
    const results = { inserted: [], skipped: [] };

    for (const entry of DEFAULT_ROUTE_PERMISSIONS) {
      const existing = await RoutePermission.findOne({ path: entry.path });
      if (existing) {
        results.skipped.push(entry.path);
      } else {
        await RoutePermission.create({ ...entry, isSeeded: true });
        results.inserted.push(entry.path);
      }
    }

    if (results.inserted.length > 0) {
      routePermissionCache.invalidate();
      logActivity(req, "SEED_ROUTE_PERMISSIONS", { insertedCount: results.inserted.length });
    }
    return res.json({
      message: `Seed complete. Inserted: ${results.inserted.length}, Skipped: ${results.skipped.length}`,
      ...results,
    });
  } catch (e) {
    console.error("[routePermissionController.seed]", e);
    return res.status(500).json({ error: "Seed failed: " + (e.message || e) });
  }
};

/**
 * POST /api/route-permissions/sync
 * Syncs routes from the frontend dashboard.
 * If a route path doesn't exist, it creates a new entry.
 */
exports.sync = async (req, res) => {
  const { routes } = req.body;
  if (!routes || !Array.isArray(routes)) {
    return res.status(400).json({ error: "routes array is required." });
  }

  try {
    const results = { inserted: [], skipped: [] };

    for (const route of routes) {
      if (!route.path || !route.label) continue;
      
      const existing = await RoutePermission.findOne({ path: route.path });
      if (existing) {
        let updated = false;
        if (existing.group !== (route.group || "General")) {
          existing.group = route.group || "General";
          updated = true;
        }
        if (existing.label !== route.label) {
          existing.label = route.label;
          updated = true;
        }
        // Route discovery must never erase assignments when roles were not supplied.
        if (
          Array.isArray(route.requiredWorkflowRoles) &&
          JSON.stringify(existing.requiredWorkflowRoles) !== JSON.stringify(route.requiredWorkflowRoles)
        ) {
          existing.requiredWorkflowRoles = route.requiredWorkflowRoles;
          updated = true;
        }
        if (updated) {
          await existing.save();
          results.inserted.push(route.path + " (updated)");
        } else {
          results.skipped.push(route.path);
        }
      } else {
        const defaultEntry = DEFAULT_ROUTE_PERMISSIONS.find(
          (entry) => entry.path === route.path
        );
        await RoutePermission.create({
          path: route.path,
          label: route.label,
          group: defaultEntry?.group || route.group || "General",
          requiredPermissions: defaultEntry?.requiredPermissions || [],
          requiredWorkflowRoles: defaultEntry?.requiredWorkflowRoles || [],
          excludeRoles: defaultEntry?.excludeRoles || [],
          applicableProposalTypes:
            defaultEntry?.applicableProposalTypes || ["Initial", "NEP", "GAA"],
          isActive: true,
          isSeeded: true
        });
        results.inserted.push(route.path);
      }
    }

    if (results.inserted.length > 0 || results.skipped.length > 0) {
      routePermissionCache.invalidate();
      logActivity(req, "SYNC_ROUTE_PERMISSIONS", { insertedCount: results.inserted.length, skippedCount: results.skipped.length });
    }
    return res.json({
      message: `Sync complete. Inserted: ${results.inserted.length}, Skipped: ${results.skipped.length}`,
      ...results,
    });
  } catch (e) {
    console.error("[routePermissionController.sync]", e);
    return res.status(500).json({ error: "Sync failed: " + (e.message || e) });
  }
};

/**
 * POST /api/route-permissions/bulk-update
 * Bulk assigns or removes a role from multiple routes at once.
 */
exports.bulkUpdateRole = async (req, res) => {
  const { routeIds, roleId, action } = req.body;
  if (!Array.isArray(routeIds) || !roleId || !action) {
    return res.status(400).json({ error: "routeIds array, roleId, and action are required." });
  }

  try {
    if (action === "add") {
      await RoutePermission.updateMany(
        { _id: { $in: routeIds } },
        { $addToSet: { requiredWorkflowRoles: roleId } }
      );
    } else if (action === "remove") {
      const aliases = getRoleAliases(roleId);
      await RoutePermission.updateMany(
        { _id: { $in: routeIds } },
        { $pull: { requiredWorkflowRoles: { $in: aliases } } }
      );
    }
    routePermissionCache.invalidate();
    logActivity(req, "BULK_UPDATE_ROLE_PERMISSION", { action, roleId, routeIdsCount: routeIds.length });
    return res.json({ message: "Bulk update successful." });
  } catch (e) {
    console.error("[routePermissionController.bulkUpdateRole]", e);
    return res.status(500).json({ error: "Something went wrong." });
  }
};

/**
 * POST /api/route-permissions/reset/:id
 * Resets a single route's permissions back to its seeded default values.
 */
exports.resetToDefault = async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await RoutePermission.findById(id);
    if (!existing) return res.status(404).json({ error: "Not found." });

    const defaultEntry = DEFAULT_ROUTE_PERMISSIONS.find((d) => d.path === existing.path);
    if (!defaultEntry) {
      return res.status(400).json({ error: "No default config found for this path." });
    }

    const reset = await RoutePermission.findByIdAndUpdate(
      id,
      {
        requiredPermissions: defaultEntry.requiredPermissions,
        requiredWorkflowRoles: defaultEntry.requiredWorkflowRoles,
        excludeRoles: defaultEntry.excludeRoles,
        applicableProposalTypes: defaultEntry.applicableProposalTypes || ["Initial", "NEP", "GAA"],
        isActive: true,
      },
      { new: true }
    );

    routePermissionCache.invalidate();
    logActivity(req, "RESET_ROUTE_PERMISSION", { routeId: id });
    return res.json({ message: "Reset to default.", route: reset });
  } catch (e) {
    console.error("[routePermissionController.resetToDefault]", e);
    return res.status(500).json({ error: "Something went wrong." });
  }
};

/**
 * POST /api/route-permissions
 * Create a new route permission config.
 */
exports.create = async (req, res) => {
  const { path, label, group, requiredPermissions, requiredWorkflowRoles, excludeRoles, applicableProposalTypes, isActive } =
    req.body;
  
  if (!path) return res.status(400).json({ error: "path is required." });
  if (!label) return res.status(400).json({ error: "label is required." });

  try {
    const existing = await RoutePermission.findOne({ path });
    if (existing) {
      return res.status(400).json({ error: "Route with this path already exists." });
    }

    const created = await RoutePermission.create({
      path,
      label,
      group: group || "General",
      requiredPermissions: requiredPermissions || [],
      requiredWorkflowRoles: requiredWorkflowRoles || [],
      excludeRoles: excludeRoles || [],
      applicableProposalTypes: applicableProposalTypes || ["Initial", "NEP", "GAA"],
      isActive: isActive !== undefined ? isActive : true,
      isSeeded: false,
    });

    routePermissionCache.invalidate();
    logActivity(req, "CREATE_ROUTE_PERMISSION", { path });
    return res.status(201).json({ message: "Created successfully.", route: created });
  } catch (e) {
    console.error("[routePermissionController.create]", e);
    return res.status(500).json({ error: "Something went wrong." });
  }
};

/**
 * DELETE /api/route-permissions/:id
 * Delete a single route permission config.
 */
exports.deleteRoute = async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await RoutePermission.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: "Route permission not found." });
    }
    routePermissionCache.invalidate();
    logActivity(req, "DELETE_ROUTE_PERMISSION", { routeId: id });
    return res.json({ message: "Deleted successfully." });
  } catch (e) {
    console.error("[routePermissionController.deleteRoute]", e);
    return res.status(500).json({ error: "Something went wrong." });
  }
};

/**
 * POST /api/route-permissions/save-defaults
 * Saves the current requiredWorkflowRoles as customDefaultRoles for all routes.
 */
exports.saveDefaults = async (req, res) => {
  try {
    const routes = await RoutePermission.find();
    let updatedCount = 0;
    
    for (const route of routes) {
      route.customDefaultRoles = [...route.requiredWorkflowRoles];
      route.customDefaultProposalTypes = [...route.applicableProposalTypes];
      await route.save();
      updatedCount++;
    }

    routePermissionCache.invalidate();
    logActivity(req, "SAVE_ROUTE_DEFAULTS", { updatedCount });
    return res.json({ message: `Successfully saved current configuration as defaults for ${updatedCount} routes.` });
  } catch (e) {
    console.error("[routePermissionController.saveDefaults]", e);
    return res.status(500).json({ error: "Something went wrong saving defaults." });
  }
};

/**
 * POST /api/route-permissions/restore-defaults
 * Restores requiredWorkflowRoles from customDefaultRoles for all routes.
 * If customDefaultRoles is null, falls back to the hardcoded system defaults.
 */
exports.restoreDefaults = async (req, res) => {
  try {
    const routes = await RoutePermission.find();
    let updatedCount = 0;

    for (const route of routes) {
      if (route.customDefaultRoles !== null || route.customDefaultProposalTypes !== null) {
        // Restore from custom default
        if (route.customDefaultRoles !== null) {
          route.requiredWorkflowRoles = [...route.customDefaultRoles];
        }
        if (route.customDefaultProposalTypes !== null) {
          route.applicableProposalTypes = [...route.customDefaultProposalTypes];
        }
        await route.save();
        updatedCount++;
      } else {
        // Fallback to system default if no custom default was ever saved
        const defaultEntry = DEFAULT_ROUTE_PERMISSIONS.find((d) => d.path === route.path);
        if (defaultEntry) {
          route.requiredWorkflowRoles = [...defaultEntry.requiredWorkflowRoles];
          route.applicableProposalTypes = defaultEntry.applicableProposalTypes || ["Initial", "NEP", "GAA"];
          await route.save();
          updatedCount++;
        }
      }
    }

    routePermissionCache.invalidate();
    logActivity(req, "RESTORE_ROUTE_DEFAULTS", { updatedCount });
    return res.json({ message: `Successfully restored defaults for ${updatedCount} routes.` });
  } catch (e) {
    console.error("[routePermissionController.restoreDefaults]", e);
    return res.status(500).json({ error: "Something went wrong restoring defaults." });
  }
};

// Export defaults so the frontend seed endpoint can be called
exports.DEFAULT_ROUTE_PERMISSIONS = DEFAULT_ROUTE_PERMISSIONS;

// ─── MAINTENANCE MODE ──────────────────────────────────────────────────────────

/**
 * GET /api/route-permissions/maintenance-status
 * Returns current maintenance mode status and message.
 * Available to all authenticated users.
 */
exports.getMaintenanceStatus = async (req, res) => {
  try {
    const setting = await SystemSetting.findOne({ key: "maintenance_mode" }).lean();
    const value = setting?.value || {};
    return res.json({
      isMaintenanceMode: Boolean(value.isActive),
      maintenanceMessage: value.message || "",
      updatedAt: setting?.updatedAt || null,
      updatedBy: setting?.updatedBy || null,
    });
  } catch (e) {
    console.error("[getMaintenanceStatus]", e);
    return res.status(500).json({ error: "Could not fetch maintenance status." });
  }
};

/**
 * PUT /api/route-permissions/maintenance-status
 * Toggle or update maintenance mode. Super Admin only (enforced by router via requireDynamicPermission).
 * Body: { isActive: boolean, message?: string }
 */
exports.updateMaintenanceStatus = async (req, res) => {
  try {
    const { isActive, message } = req.body;

    // Validate
    if (typeof isActive !== "boolean") {
      return res.status(400).json({ error: "isActive must be a boolean." });
    }

    // Upsert the setting
    const setting = await SystemSetting.findOneAndUpdate(
      { key: "maintenance_mode" },
      {
        $set: {
          value: { isActive, message: message || "" },
          description: "System maintenance mode toggle",
          updatedBy: req.user?.particular || req.user?.userId || "SYSTEM",
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // Invalidate the middleware cache
    try {
      const checkMaintenanceMode = require("../middleware/checkMaintenanceMode");
      if (typeof checkMaintenanceMode.invalidateCache === "function") {
        checkMaintenanceMode.invalidateCache();
      }
    } catch (_) {}

    // Log activity
    logActivity(req, "TOGGLE_MAINTENANCE_MODE", { isActive, message: message || "" });

    return res.json({
      success: true,
      isMaintenanceMode: Boolean(setting.value?.isActive),
      maintenanceMessage: setting.value?.message || "",
      updatedAt: setting.updatedAt,
      updatedBy: setting.updatedBy,
    });
  } catch (e) {
    console.error("[updateMaintenanceStatus]", e);
    return res.status(500).json({ error: "Could not update maintenance status." });
  }
};
