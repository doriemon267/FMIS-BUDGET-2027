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
    enum: ['FULL', 'OFFICE', 'RESPONSIBILITY_CENTER', 'OWN_ONLY'],
    default: 'OFFICE'
  },
  // Office assignments (combines old department and region functionality)
  offices: [{
    type: mongoose.Schema.Types.Mixed, // Allow both ObjectId and String for flexibility
    ref: 'department'
  }],
  // Responsibility Center assignments (was divisions)
  responsibilityCenters: [{
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
UserOrganizationalAssignmentSchema.methods.hasOfficeAccess = function(officeId) {
  if (this.accessScope === 'FULL') return true;
  return this.offices.some(o => o.toString() === officeId.toString());
};
UserOrganizationalAssignmentSchema.methods.hasResponsibilityCenterAccess = function(responsibilityCenterName) {
  if (this.accessScope === 'FULL') return true;
  if (this.accessScope === 'OWN_ONLY') return false;
  return this.responsibilityCenters.includes(responsibilityCenterName);
};
// New method to get the consolidation target for hierarchical saving
UserOrganizationalAssignmentSchema.methods.getConsolidationTarget = function() {
  const result = {
    primaryLevel: this.accessScope,
    consolidationData: {}
  };
  switch (this.accessScope) {
    case 'RESPONSIBILITY_CENTER':
      // Responsibility Center users save to their Office's records
      result.consolidationData = {
        originalLevel: 'RESPONSIBILITY_CENTER',
        targetLevel: 'OFFICE',
        originalValue: this.responsibilityCenters[0], // Primary responsibility center
        targetValue: this.offices[0], // Consolidate to office
        office: this.offices[0] // Ultimate office for reporting
      };
      break;
    case 'OFFICE':
      // Office users save directly to their office
      result.consolidationData = {
        originalLevel: 'OFFICE',
        targetLevel: 'OFFICE',
        originalValue: this.offices[0],
        targetValue: this.offices[0],
        office: this.offices[0]
      };
      break;
    default:
      // FULL or OWN_ONLY access
      result.consolidationData = {
        originalLevel: this.accessScope,
        targetLevel: this.accessScope,
        originalValue: null,
        targetValue: null,
        office: null
      };
  }
  return result;
};
// Method to get effective office for data consolidation
UserOrganizationalAssignmentSchema.methods.getEffectiveOffice = function() {
  // Always return the primary office for consolidation
  if (this.offices && this.offices.length > 0) {
    return this.offices[0];
  }
  return null;
};
// Static methods
UserOrganizationalAssignmentSchema.statics.findByUserId = function(userId) {
  return this.findOne({ userId }).populate('offices');
};
UserOrganizationalAssignmentSchema.statics.getUserPermissions = async function(userId) {
  const assignment = await this.findByUserId(userId);
  if (!assignment) {
    // Default permissions for users without assignments
    return {
      accessScope: 'OWN_ONLY',
      offices: [],
      responsibilityCenters: [],
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
