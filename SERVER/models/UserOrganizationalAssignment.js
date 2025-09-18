const mongoose = require('mongoose');
const UserOrganizationalAssignmentSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  userName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  // Access scope defines the level of organizational access
  accessScope: {
    type: String,
    enum: ['FULL', 'REGION', 'DEPARTMENT', 'DIVISION', 'OWN_ONLY'],
    default: 'REGION'
  },
  // Region assignments (existing functionality)
  regions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'region'
  }],
  // Department assignments
  departments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'department'
  }],
  // Division assignments (for future use)
  divisions: [{
    type: String // Store as string for now, can be ObjectId later
  }],
  // Role-based permissions
  rolePermissions: {
    CreateProposals: { type: Boolean, default: true },
    EditOwnProposals: { type: Boolean, default: true },
    EditAllProposals: { type: Boolean, default: false },
    DeleteProposals: { type: Boolean, default: false },
    ApproveProposals: { type: Boolean, default: false },
    ViewReports: { type: Boolean, default: true },
    ManageUsers: { type: Boolean, default: false },
    ManageSettings: { type: Boolean, default: false }
  },
  // Operational restrictions
  restrictions: {
    maxProposalAmount: { type: Number, default: null }, // null = no limit
    allowedBudgetTypes: [{ type: String }], // ['Initial', 'NEP', 'GAA']
    allowedFiscalYears: [{ type: String }],
    readOnlyMode: { type: Boolean, default: false }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: String
  },
  lastModifiedBy: {
    type: String
  }
});
// Pre-save middleware to update timestamps
UserOrganizationalAssignmentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});
// Instance methods
UserOrganizationalAssignmentSchema.methods.hasRegionAccess = function(regionId) {
  if (this.accessScope === 'FULL') return true;
  return this.regions.some(r => r.toString() === regionId.toString());
};
UserOrganizationalAssignmentSchema.methods.hasDepartmentAccess = function(departmentId) {
  if (this.accessScope === 'FULL') return true;
  if (this.accessScope === 'OWN_ONLY') return false;
  return this.departments.some(d => d.toString() === departmentId.toString());
};
UserOrganizationalAssignmentSchema.methods.hasDivisionAccess = function(divisionName) {
  if (this.accessScope === 'FULL') return true;
  if (this.accessScope === 'OWN_ONLY') return false;
  return this.divisions.includes(divisionName);
};
// New method to get the consolidation target for hierarchical saving
UserOrganizationalAssignmentSchema.methods.getConsolidationTarget = function() {
  const result = {
    primaryLevel: this.accessScope,
    consolidationData: {}
  };
  switch (this.accessScope) {
    case 'DIVISION':
      // Division users save to their Department's records
      result.consolidationData = {
        originalLevel: 'DIVISION',
        targetLevel: 'DEPARTMENT',
        originalValue: this.divisions[0], // Primary division
        targetValue: this.departments[0], // Consolidate to department
        region: this.regions[0] // Ultimate region for reporting
      };
      break;
    case 'DEPARTMENT':
      // Department users save to their Region's records
      result.consolidationData = {
        originalLevel: 'DEPARTMENT',
        targetLevel: 'REGION',
        originalValue: this.departments[0], // Primary department
        targetValue: this.regions[0], // Consolidate to region
        region: this.regions[0] // Same region
      };
      break;
    case 'REGION':
      // Region users save directly to their region
      result.consolidationData = {
        originalLevel: 'REGION',
        targetLevel: 'REGION',
        originalValue: this.regions[0],
        targetValue: this.regions[0],
        region: this.regions[0]
      };
      break;
    default:
      // FULL or OWN_ONLY access
      result.consolidationData = {
        originalLevel: this.accessScope,
        targetLevel: this.accessScope,
        originalValue: null,
        targetValue: null,
        region: null
      };
  }
  return result;
};
// Method to get effective region for data consolidation
UserOrganizationalAssignmentSchema.methods.getEffectiveRegion = function() {
  // Always return the primary region for consolidation
  if (this.regions && this.regions.length > 0) {
    return this.regions[0];
  }
  return null;
};
// Static methods
UserOrganizationalAssignmentSchema.statics.findByUserId = function(userId) {
  return this.findOne({ userId }).populate('regions departments');
};
UserOrganizationalAssignmentSchema.statics.getUserPermissions = async function(userId) {
  const assignment = await this.findByUserId(userId);
  if (!assignment) {
    // Default permissions for users without assignments
    return {
      accessScope: 'OWN_ONLY',
      regions: [],
      departments: [],
      divisions: [],
      rolePermissions: {
        CreateProposals: true,
        EditOwnProposals: true,
        EditAllProposals: false,
        DeleteProposals: false,
        ApproveProposals: false,
        ViewReports: false,
        ManageUsers: false,
        ManageSettings: false
      }
    };
  }
  return assignment;
};
module.exports = mongoose.model('UserOrganizationalAssignment', UserOrganizationalAssignmentSchema);
