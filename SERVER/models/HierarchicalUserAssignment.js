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
  workflowRoles: {
    type: [String],
    enum: [
      'divisionCreator', 'divisionApprover',
      'departmentCreator', 'departmentConsolidator', 'departmentSubmission',
      'regionCreator', 'regionFinalVerifier'
    ],
    default: []
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
  const doc = await this.findOne({ userId, isActive: true })
    .populate('regionId', 'regionName Region RegionName')
    .populate('departmentId', 'Department departmentName DepartmentName');

  if (!doc) {
    // Return a safe default object with stubbed access-check methods
    return {
      userId,
      assignmentLevel: 'NONE',
      accessScope: 'OWN_ONLY',
      regions: [],
      departments: [],
      divisions: [],
      workflowRoles: [],
      rolePermissions: {
        canCreateProposals: false,
        canEditOwnProposals: true,
        canEditAllProposals: false,
        canDeleteProposals: false,
        canApproveProposals: false,
        canViewReports: false,
        canManageUsers: false,
        canManageSettings: false
      },
      hasRegionAccess: () => false,
      hasDepartmentAccess: () => false,
      hasDivisionAccess: () => false
    };
  }

  // Build name-based accessible snapshots
  const mongoose = require('mongoose');
  const accessibleRegions = [];
  const accessibleDepartments = [];
  const accessibleDivisions = [];

  if (doc.regionId) {
    const regionId = doc.regionId._id || doc.regionId;
    let regionName = doc.regionId.regionName || doc.regionId.Region || null;
    if (!regionName) {
      const regionDoc = await mongoose.connection.db.collection('regions').findOne({ _id: regionId });
      regionName = regionDoc ? (regionDoc.regionName || regionDoc.Region) : null;
    }
    accessibleRegions.push({ _id: regionId, regionName: regionName || 'Central Office' });
  }

  if (doc.departmentId) {
    accessibleDepartments.push({
      _id: doc.departmentId._id || doc.departmentId,
      departmentName: doc.departmentId.Department || doc.departmentId.departmentName || doc.departmentId.DepartmentName || null
    });
  }

  if (doc.divisionName) {
    accessibleDivisions.push(doc.divisionName);
  }

  // Attach transient fields and return the Mongoose document so instance methods work
  doc.accessScope = doc.assignmentLevel;
  doc.regions = accessibleRegions;
  doc.departments = accessibleDepartments;
  doc.divisions = accessibleDivisions;
  doc.workflowRoles = Array.isArray(doc.workflowRoles) ? doc.workflowRoles : [];
  return doc;
};

// Method to check if user has access to specific region (accepts name or id)
HierarchicalUserAssignmentSchema.methods.hasRegionAccess = function(regionOrId) {
  if (this.assignmentLevel === 'FULL') return true;
  const regionName = this.regionId?.regionName || this.regionId?.Region || this.accessibleRegionNames?.[0];
  if (typeof regionOrId === 'string') {
    return !!regionName && regionName === regionOrId;
  }
  return this.regionId && this.regionId.toString() === String(regionOrId);
};

// Method to check if user has access to specific department (accepts name or id)
HierarchicalUserAssignmentSchema.methods.hasDepartmentAccess = function(deptOrId) {
  if (this.assignmentLevel === 'FULL') return true;
  if (this.assignmentLevel === 'REGION') return true; // Region users can access all departments in their region
  const departmentName = this.departmentId?.departmentName || this.departmentId?.DepartmentName || this.accessibleDepartmentNames?.[0];
  if (typeof deptOrId === 'string') {
    return !!departmentName && departmentName === deptOrId;
  }
  return this.departmentId && this.departmentId.toString() === String(deptOrId);
};

// Method to check if user has access to specific division (by name)
HierarchicalUserAssignmentSchema.methods.hasDivisionAccess = function(divisionName) {
  if (this.assignmentLevel === 'FULL') return true;
  if (this.assignmentLevel === 'REGION') return true; // Region users can access all divisions in their region
  if (this.assignmentLevel === 'DEPARTMENT') return true; // Department users can access all divisions in their department
  return (this.divisionName || this.accessibleDivisionNames?.[0]) === divisionName;
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
