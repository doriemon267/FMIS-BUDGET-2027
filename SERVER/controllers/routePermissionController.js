const RoutePermission = require("../models/RoutePermission");

// ─── DEFAULT SEED DATA ────────────────────────────────────────────────────────
// These mirror the hard-coded values from CLIENT/src/App.jsx.
// Run POST /api/route-permissions/seed to insert any missing entries.
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
    requiredWorkflowRoles: ["superAdmin"],
    excludeRoles: [],
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
    path: "/hierarchical-user-assignments",
    label: "Hierarchical User Assignments",
    group: "Settings",
    requiredPermissions: ["ManageSettings"],
    requiredWorkflowRoles: [],
    excludeRoles: ["preparer", "reviewer", "approver"],
  },
  {
    path: "/setup/organization",
    label: "Organization Setup",
    group: "Settings",
    requiredPermissions: ["ManageSettings"],
    requiredWorkflowRoles: [],
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
  const { label, group, requiredPermissions, requiredWorkflowRoles, excludeRoles, isActive } =
    req.body;
  try {
    const updated = await RoutePermission.findByIdAndUpdate(
      id,
      { label, group, requiredPermissions, requiredWorkflowRoles, excludeRoles, isActive },
      { new: true, runValidators: true }
    );
    if (!updated) {
      return res.status(404).json({ error: "Route permission not found." });
    }
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

  const { label, group, requiredPermissions, requiredWorkflowRoles, excludeRoles, isActive } =
    req.body;
  try {
    const updated = await RoutePermission.findOneAndUpdate(
      { path },
      { label, group, requiredPermissions, requiredWorkflowRoles, excludeRoles, isActive },
      { new: true, runValidators: true }
    );
    if (!updated) {
      return res.status(404).json({ error: "Route permission not found." });
    }
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
        isActive: true,
      },
      { new: true }
    );

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
  const { path, label, group, requiredPermissions, requiredWorkflowRoles, excludeRoles, isActive } =
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
      isActive: isActive !== undefined ? isActive : true,
      isSeeded: false,
    });

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
    return res.json({ message: "Deleted successfully." });
  } catch (e) {
    console.error("[routePermissionController.deleteRoute]", e);
    return res.status(500).json({ error: "Something went wrong." });
  }
};

// Export defaults so the frontend seed endpoint can be called
exports.DEFAULT_ROUTE_PERMISSIONS = DEFAULT_ROUTE_PERMISSIONS;
