const Settings = require("../models/Settings");

const normalizeRole = (role) =>
  String(role || "")
    .replace(/[\s_-]+/g, "")
    .toUpperCase();

const collectRoles = (user) =>
  new Set(
    [
      ...(user?.Roles || []),
      ...(user?.workflowRoles || []),
      ...(user?.hierarchicalAccess?.workflowRoles || []),
      ...(user?.hierarchicalAccess?.roles || []),
    ]
      .map(normalizeRole)
      .filter(Boolean)
  );

const getTierRoleProfile = (user) => {
  const roles = collectRoles(user);
  const isSuperAdmin = roles.has("SUPERADMIN") || roles.has("ADMIN");
  const isAnalyst =
    roles.has("BUDGETPLANNINGANALYST") || roles.has("BUDGETANALYST");
  const isOfficer = roles.has("BUDGETOFFICER");
  const isManager =
    roles.has("BUDGETMANAGER") || roles.has("OVERALLBUDGETAPPROVER");
  const isPreparer = roles.has("BUDGETPREPARER") || roles.has("PREPARER");
  const isReviewer = roles.has("BUDGETREVIEWER") || roles.has("REVIEWER");
  const isApprover = roles.has("BUDGETAPPROVER") || roles.has("APPROVER");

  return {
    hasBrdAccess: isSuperAdmin || isAnalyst || isOfficer || isManager,
    hasProposalWorkflowAccess: isPreparer || isReviewer || isApprover,
    isSuperAdmin,
    isAnalyst,
    isPreparer,
    isReviewer,
    isApprover,
  };
};

const requireTierAccess = async (req, res, next) => {
  try {
    const profile = getTierRoleProfile(req.user);
    req.tierAccessProfile = profile;

    if (profile.hasBrdAccess) return next();
    if (!profile.hasProposalWorkflowAccess) {
      return res.status(403).json({
        success: false,
        code: "TIER_ROLE_ACCESS_DENIED",
        message: "Your role is not authorized to access Tier Management.",
      });
    }

    const activeSettings = await Settings.findOne({ isActive: true })
      .select("budgetType fiscalYear")
      .lean();
    const activeBudgetType = String(activeSettings?.budgetType || "")
      .trim()
      .toUpperCase();

    if (activeBudgetType !== "NEP") {
      return res.status(403).json({
        success: false,
        code: "TIER_PHASE_ACCESS_DENIED",
        message:
          "Tier Management is available to Budget Preparers, Reviewers, and Approvers only during the NEP budget phase.",
        activeBudgetType: activeSettings?.budgetType || null,
      });
    }

    req.activeTierSettings = activeSettings;
    return next();
  } catch (error) {
    console.error("[requireTierAccess] Failed to evaluate Tier access:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to verify the active Tier budget phase.",
    });
  }
};

module.exports = {
  getTierRoleProfile,
  requireTierAccess,
};

