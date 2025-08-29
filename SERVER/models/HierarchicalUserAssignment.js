const mongoose = require('mongoose');

const HierarchicalUserAssignmentSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  userName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  assignmentLevel: {
    type: String,
    enum: ['DIVISION', 'DEPARTMENT', 'REGION', 'FULL'],
    required: true
  },
  regionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'region',
    required: function() {
      return ['DIVISION', 'DEPARTMENT', 'REGION'].includes(this.assignmentLevel);
    }
  },
  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'department',
    required: function() {
      return ['DIVISION', 'DEPARTMENT'].includes(this.assignmentLevel);
    }
  },
  divisionName: {
    type: String,
    required: function() {
      return this.assignmentLevel === 'DIVISION';
    }
  },
  rolePermissions: {
    canCreateProposals: { type: Boolean, default: false },
    canEditOwnProposals: { type: Boolean, default: false },
    canEditAllProposals: { type: Boolean, default: false },
    canDeleteProposals: { type: Boolean, default: false },
    canApproveProposals: { type: Boolean, default: false },
    canViewReports: { type: Boolean, default: false },
    canManageUsers: { type: Boolean, default: false },
    canManageSettings: { type: Boolean, default: false }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
HierarchicalUserAssignmentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static method to get user permissions for access control
HierarchicalUserAssignmentSchema.statics.getUserPermissions = async function(userId) {
  const assignment = await this.findOne({ userId, isActive: true })
    .populate('regionId', 'regionName RegionName')
    .populate('departmentId', 'departmentName DepartmentName');
  
  if (!assignment) {
    return {
      userId,
      accessScope: 'OWN_ONLY',
      assignmentLevel: 'NONE',
      regions: [],
      departments: [],
      divisions: [],
      rolePermissions: {
        canCreateProposals: false,
        canEditOwnProposals: true,
        canEditAllProposals: false,
        canDeleteProposals: false,
        canApproveProposals: false,
        canViewReports: false,
        canManageUsers: false,
        canManageSettings: false
      }
    };
  }

  // Build access scope based on assignment level
  let accessScope = assignment.assignmentLevel;
  let accessibleRegions = [];
  let accessibleDepartments = [];
  let accessibleDivisions = [];

  if (assignment.regionId) {
    accessibleRegions.push({
      _id: assignment.regionId._id,
      regionName: assignment.regionId.regionName || assignment.regionId.RegionName
    });
  }

  if (assignment.departmentId) {
    accessibleDepartments.push({
      _id: assignment.departmentId._id,
      departmentName: assignment.departmentId.departmentName || assignment.departmentId.DepartmentName
    });
  }

  if (assignment.divisionName) {
    accessibleDivisions.push(assignment.divisionName);
  }

  return {
    userId: assignment.userId,
    assignmentLevel: assignment.assignmentLevel,
    accessScope,
    regions: accessibleRegions,
    departments: accessibleDepartments,
    divisions: accessibleDivisions,
    rolePermissions: assignment.rolePermissions
  };
};

// Method to check if user has access to specific region
HierarchicalUserAssignmentSchema.methods.hasRegionAccess = function(regionId) {
  if (this.assignmentLevel === 'FULL') return true;
  return this.regionId && this.regionId.toString() === regionId.toString();
};

// Method to check if user has access to specific department
HierarchicalUserAssignmentSchema.methods.hasDepartmentAccess = function(departmentId) {
  if (this.assignmentLevel === 'FULL') return true;
  if (this.assignmentLevel === 'REGION') return true; // Region users can access all departments in their region
  return this.departmentId && this.departmentId.toString() === departmentId.toString();
};

// Method to check if user has access to specific division
HierarchicalUserAssignmentSchema.methods.hasDivisionAccess = function(divisionName) {
  if (this.assignmentLevel === 'FULL') return true;
  if (this.assignmentLevel === 'REGION') return true; // Region users can access all divisions in their region
  if (this.assignmentLevel === 'DEPARTMENT') return true; // Department users can access all divisions in their department
  return this.divisionName === divisionName;
};

// Method to get consolidation target (where data should be saved)
HierarchicalUserAssignmentSchema.methods.getConsolidationTarget = function() {
  switch (this.assignmentLevel) {
    case 'DIVISION':
      // Division data consolidates to Department level
      return {
        level: 'DEPARTMENT',
        regionId: this.regionId,
        departmentId: this.departmentId,
        divisionName: null // Clear division for consolidated data
      };
    case 'DEPARTMENT':
      // Department data consolidates to Region level
      return {
        level: 'REGION',
        regionId: this.regionId,
        departmentId: null, // Clear department for consolidated data
        divisionName: null
      };
    case 'REGION':
      // Region data stays at Region level
      return {
        level: 'REGION',
        regionId: this.regionId,
        departmentId: null,
        divisionName: null
      };
    case 'FULL':
      // Full access can save anywhere
      return null;
    default:
      return null;
  }
};

module.exports = mongoose.model('HierarchicalUserAssignment', HierarchicalUserAssignmentSchema);
