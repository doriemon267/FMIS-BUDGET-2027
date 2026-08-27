const mongoose = require("mongoose");

/**
 * RoutePermission model
 * Stores per-route access configuration that replaces hard-coded
 * requiredPermissions / requiredWorkflowRoles in App.jsx.
 * SuperAdmins can modify these at runtime via the Settings UI.
 */
const routePermissionSchema = new mongoose.Schema(
  {
    /** The frontend route path, used as the unique key. e.g. "/consolidated-reports" */
    path: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    /** Human-readable label shown in the management UI */
    label: {
      type: String,
      required: true,
      trim: true,
    },
    /** Optional group/category for grouping in the UI (e.g. "Reports", "Settings") */
    group: {
      type: String,
      default: "General",
      trim: true,
    },
    /** Array of permission strings required to access this route. Empty = no permission check */
    requiredPermissions: {
      type: [String],
      default: [],
    },
    /** Array of workflow role strings. User must have AT LEAST ONE. Protected Settings routes fail closed when empty. */
    requiredWorkflowRoles: {
      type: [String],
      default: [],
    },
    /** Roles to explicitly DENY access to, even if they have the required workflow role */
    excludeRoles: {
      type: [String],
      default: [],
    },
    /** Proposal types this route is applicable to. e.g. ["Initial", "NEP", "GAA"]. Empty = All */
    applicableProposalTypes: {
      type: [String],
      enum: ["Initial", "NEP", "GAA"],
      default: ["Initial", "NEP", "GAA"],
    },
    /** Stores the user-defined default roles to restore to */
    customDefaultRoles: {
      type: [String],
      default: null,
    },
    /** Stores the user-defined default proposal types to restore to */
    customDefaultProposalTypes: {
      type: [String],
      default: null,
    },
    /** Whether this route config is active. Inactive = falls back to hardcoded defaults */
    isActive: {
      type: Boolean,
      default: true,
    },
    /** Whether this record was seeded (auto-created from defaults) */
    isSeeded: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

routePermissionSchema.index({ group: 1 });

module.exports = mongoose.model("RoutePermission", routePermissionSchema);
