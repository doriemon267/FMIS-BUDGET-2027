const mongoose = require('mongoose');

// Import referenced models to ensure they're registered
require('./Region');
require('./Department');

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
  // NEW: Support for multiple roles (November 2025)
  // Allow users to have multiple legitimate roles (e.g., Preparer + Reviewer)
  userRoles: [{
    type: String,
    enum: [
      // Standardized 6-step workflow roles (ONLY these valid values)
      'BUDGET_PREPARER',           // STEP 1: Creates draft proposals
      'BUDGET PREPARER',           // Legacy format with space
      'BUDGET_REVIEWER',           // STEP 2: Reviews and approves/rejects
      'BUDGET REVIEWER',           // Legacy format with space
      'BUDGET_APPROVER',           // STEP 3: Approves and forwards to analyst
      'BUDGET APPROVER',           // Legacy format with space
      'BUDGET_PLANNING_ANALYST',   // STEP 4: Analyzes and forwards to officer
      'BUDGET PLANNING ANALYST',   // Legacy format with space
      'BUDGET_OFFICER',            // STEP 5: Makes final budget decisions
      'BUDGET OFFICER',            // Legacy format with space
      'OVERALL_BUDGET_APPROVER',   // STEP 6: Final approval
      'OVERALL BUDGET APPROVER',   // Legacy format with space
      'SUPER_ADMIN',               // Admin override
      'SUPER ADMIN',               // Legacy format with space
      'ADMIN',                     // Admin override
      'BUDGET_ADMIN',              // Admin override
      'BUDGET ADMIN'               // Legacy format with space
    ]
  }],
  // Keep backward compatibility - primary role (highest in hierarchy)
  userRole: {
    type: String,
    enum: [
      // Standardized 6-step workflow roles (ONLY these valid values)
      'BUDGET_PREPARER',           // STEP 1: Creates draft proposals
      'BUDGET PREPARER',           // Legacy format with space
      'BUDGET_REVIEWER',           // STEP 2: Reviews and approves/rejects
      'BUDGET REVIEWER',           // Legacy format with space
      'BUDGET_APPROVER',           // STEP 3: Approves and forwards to analyst
      'BUDGET APPROVER',           // Legacy format with space
      'BUDGET_PLANNING_ANALYST',   // STEP 4: Analyzes and forwards to officer
      'BUDGET PLANNING ANALYST',   // Legacy format with space
      'BUDGET_OFFICER',            // STEP 5: Makes final budget decisions
      'BUDGET OFFICER',            // Legacy format with space
      'OVERALL_BUDGET_APPROVER',   // STEP 6: Final approval
      'OVERALL BUDGET APPROVER',   // Legacy format with space
      'SUPER_ADMIN',               // Admin override
      'SUPER ADMIN',               // Legacy format with space
      'ADMIN',                     // Admin override
      'BUDGET_ADMIN',              // Admin override
      'BUDGET ADMIN'               // Legacy format with space
    ],
    required: false,
    default: undefined
  },
  // NEW: Assignment Level with new naming convention
  assignmentLevel: {
    type: String,
    enum: [
      // New levels (September 2025)
      'DIVISION_LEVEL',
      'DEPARTMENT_REGIONAL_LEVEL',
      'BUDGET_AND_REVENUE_DIVISION',
      // Legacy levels (for backward compatibility)
      'DIVISION',
      'DEPARTMENT',
      'REGION',
      'RESPONSIBILITY_CENTER',
      'OFFICE',
      'FULL'
    ],
    required: true
  },
  regionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'region',
    required: function() {
      return [
        'DIVISION', 'DEPARTMENT', 'REGION', 'RESPONSIBILITY_CENTER',
        'DIVISION_LEVEL', 'DEPARTMENT_REGIONAL_LEVEL'
      ].includes(this.assignmentLevel);
    }
  },
  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'department',
    required: function() {
      return [
        'DIVISION', 'DEPARTMENT', 'RESPONSIBILITY_CENTER', 'OFFICE',
        'DIVISION_LEVEL', 'DEPARTMENT_REGIONAL_LEVEL'
      ].includes(this.assignmentLevel);
    }
  },
  divisionName: {
    type: String,
    required: function() {
      return ['DIVISION', 'RESPONSIBILITY_CENTER', 'DIVISION_LEVEL'].includes(this.assignmentLevel);
    }
  },
  // NEW: Budget Planning Analyst Region Configuration (November 2025)
  isNIAWide: {
    type: Boolean,
    default: false,
    description: 'If true, Budget Planning Analyst can access proposals from all regions (NIA-Wide)'
  },
  assignedRegions: {
    type: [String],
    default: [],
    description: 'Specific regions assigned to Budget Planning Analyst (region codes like "MARIIS", "CALABARZON", etc. - only used if isNIAWide is false)'
  },
  rolePermissions: {
    CreateProposals: { type: Boolean, default: false },
    EditOwnProposals: { type: Boolean, default: false },
    EditAllProposals: { type: Boolean, default: false },
    DeleteProposals: { type: Boolean, default: false },
    ApproveProposals: { type: Boolean, default: false },
    canApproveProposals: { type: Boolean, default: false },
    ViewReports: { type: Boolean, default: false },
    ManageUsers: { type: Boolean, default: false },
    ManageSettings: { type: Boolean, default: false }
  },
  // NEW: Updated workflow roles for 6-step workflow
  workflowRoles: {
    type: [String],
    enum: [
      // New 6-step workflow roles (September 2025) - INTERNAL NAMES
      'divisionCreator', 'divisionReviewer', 'divisionApprover',
      'officeCreator', 'officeApprover',
      'budgetAnalyst', 'budgetOfficer', 'overallBudgetApprover',
      'budgetAdmin',
      // NEW USER-FACING ROLE NAMES (September 2025 system) - STANDARDIZED with underscores
      'BUDGET_PREPARER', 'BUDGET_REVIEWER', 'BUDGET_APPROVER',
      'BUDGET_PLANNING_ANALYST', 'BUDGET_OFFICER', 'OVERALL_BUDGET_APPROVER', 'BUDGET_ADMIN',
      // Legacy roles (for backward compatibility)
      'departmentCreator', 'departmentConsolidator', 'departmentSubmission',
      'officeConsolidator', 'officeSubmission', 'officeFinalVerifier',
      'regionCreator', 'regionFinalVerifier'
    ],
    default: []
  },
  // Operational restrictions
  restrictions: {
    allowedBudgetTypes: [{ type: String }], // ['Initial', 'NEP', 'GAA']
    allowedFiscalYears: [{ type: String }],
    readOnlyMode: { type: Boolean, default: false }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // NEW: Track migration status for backward compatibility
  migrationStatus: {
    type: String,
    enum: ['LEGACY', 'MIGRATED', 'NEW'],
    default: 'NEW'
  },
  // NEW: Store old assignment level for migration tracking
  legacyAssignmentLevel: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  migratedAt: {
    type: Date,
    default: null
  }
});
// Update the updatedAt field before saving
HierarchicalUserAssignmentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});
// Static method to get user permissions for access control
HierarchicalUserAssignmentSchema.statics.getUserPermissions = async function(userId, userRoles = []) {
  let doc = await this.findOne({ userId, isActive: true })
    .populate('regionId', 'regionName Region RegionName')
    .populate('departmentId', 'Department departmentName DepartmentName');
  // Fallback: handle potential type/format mismatches of userId
  if (!doc) {
    try {
      const mongoose = require('mongoose');
      const candidates = [userId];
      const asNum = Number(userId);
      const asStr = String(userId);
      if (!Number.isNaN(asNum)) candidates.push(asNum);
      candidates.push(asStr);
      if (asStr.trim) candidates.push(asStr.trim());
      const raw = await mongoose.connection.db
        .collection('hierarchicaluserassignments')
        .findOne({ isActive: true, userId: { $in: candidates } });
      if (raw?._id) {
        doc = await this.findById(raw._id)
          .populate('regionId', 'regionName Region RegionName')
          .populate('departmentId', 'Department departmentName DepartmentName');
      }
    } catch (e) {
      // ignore fallback errors; will return stub below
    }
  }
  // Normalize assignmentLevel and workflowRoles where possible to avoid legacy mismatches
  try {
    const mapping = {
      'RESPONSIBILITY_CENTER': 'DIVISION_LEVEL',
      'DIVISION': 'DIVISION_LEVEL',
      'OFFICE': 'DEPARTMENT_REGIONAL_LEVEL',
      'DEPARTMENT': 'DEPARTMENT_REGIONAL_LEVEL',
      'REGION': 'BUDGET_AND_REVENUE_DIVISION'
    };
    if (doc && doc.assignmentLevel && mapping[doc.assignmentLevel]) {
      const normalized = mapping[doc.assignmentLevel];
      if (doc.assignmentLevel !== normalized) {
        doc.legacyAssignmentLevel = doc.assignmentLevel;
        doc.assignmentLevel = normalized;
        // Persist normalization but don't block on errors
        doc.save().catch(err => console.warn('Failed to persist normalized assignmentLevel:', err.message));
      }
    }
    // Normalize workflow role casing - map to valid enum values
    if (doc && Array.isArray(doc.workflowRoles) && doc.workflowRoles.length > 0) {
      // Valid enum values for workflowRoles
      const validRoles = new Set([
        'divisionCreator', 'divisionReviewer', 'divisionApprover',
        'officeCreator', 'officeApprover',
        'budgetAnalyst', 'budgetOfficer', 'overallBudgetApprover', 'budgetAdmin',
        'BUDGET_PREPARER', 'BUDGET_REVIEWER', 'BUDGET_APPROVER',
        'BUDGET_PLANNING_ANALYST', 'BUDGET_OFFICER', 'OVERALL_BUDGET_APPROVER', 'BUDGET_ADMIN',
        'departmentCreator', 'departmentConsolidator', 'departmentSubmission',
        'officeConsolidator', 'officeSubmission', 'officeFinalVerifier',
        'regionCreator', 'regionFinalVerifier'
      ]);
      
      // Map non-standard role names to valid enum values
      const roleMapping = {
        'BUDGETANALYST': 'budgetAnalyst',
        'BUDGETPLANNINGANALYST': 'budgetAnalyst',
        'BUDGET_ANALYST': 'budgetAnalyst',
        'BUDGETOFFICER': 'budgetOfficer',
        'OVERALLBUDGETAPPROVER': 'overallBudgetApprover',
        'BUDGETADMIN': 'budgetAdmin',
        'DIVISIONCREATOR': 'divisionCreator',
        'DIVISIONREVIEWER': 'divisionReviewer',
        'DIVISIONAPPROVER': 'divisionApprover',
        'OFFICECREATOR': 'officeCreator',
        'OFFICEAPPROVER': 'officeApprover',
        'BUDGETPREPARER': 'BUDGET_PREPARER',
        'BUDGETREVIEWER': 'BUDGET_REVIEWER',
        'BUDGETAPPROVER': 'BUDGET_APPROVER',
        'BUDGET PREPARER': 'BUDGET_PREPARER',
        'BUDGET REVIEWER': 'BUDGET_REVIEWER',
        'BUDGET APPROVER': 'BUDGET_APPROVER',
        'BUDGET PLANNING ANALYST': 'BUDGET_PLANNING_ANALYST',
        'BUDGET OFFICER': 'BUDGET_OFFICER',
        'OVERALL BUDGET APPROVER': 'OVERALL_BUDGET_APPROVER',
        'BUDGET ADMIN': 'BUDGET_ADMIN'
      };
      
      const normalizedRoles = doc.workflowRoles.map(r => {
        const role = String(r);
        // If already valid, keep it
        if (validRoles.has(role)) return role;
        // Try mapping by uppercase key without spaces/underscores
        const key = role.replace(/[_\s]+/g, '').toUpperCase();
        if (roleMapping[key]) return roleMapping[key];
        // Try direct mapping with original casing preserved
        if (roleMapping[role]) return roleMapping[role];
        // Return original if no mapping found (will be filtered out if invalid)
        return role;
      }).filter(r => validRoles.has(r));
      
      const uniq = Array.from(new Set(normalizedRoles));
      if (JSON.stringify(uniq) !== JSON.stringify(doc.workflowRoles)) {
        doc.workflowRoles = uniq;
        doc.save().catch(err => console.warn('Failed to persist normalized workflowRoles:', err.message));
      }
    }
  } catch (e) {
    // Non-fatal -- normalization best-effort only
    console.warn('Normalization check failed:', e.message);
  }
  if (!doc) {
    // Check if user has workflow roles that grant default permissions
    const workflowRoles = Array.isArray(userRoles) ? userRoles : [];
    const hasWorkflowRole = workflowRoles.some(role => 
      ['BUDGET_PREPARER', 'BUDGET_REVIEWER', 'BUDGET_APPROVER', 'BUDGET_PLANNING_ANALYST', 'BUDGET_OFFICER', 'OVERALL_BUDGET_APPROVER'].includes(role)
    );
    
    if (hasWorkflowRole) {
      // Grant default permissions for workflow users
      return {
        userId,
        assignmentLevel: 'WORKFLOW', // Special level for workflow users
        accessScope: 'WORKFLOW_ACCESS',
        regions: [], // Workflow users can access data based on their role permissions
        departments: [],
        divisions: [],
        workflowRoles: workflowRoles,
        rolePermissions: {
          CreateProposals: workflowRoles.includes('BUDGET_PREPARER'),
          EditOwnProposals: true, // All workflow users can edit their own proposals
          EditAllProposals: ['BUDGET_REVIEWER', 'BUDGET_APPROVER', 'BUDGET_PLANNING_ANALYST', 'BUDGET_OFFICER', 'OVERALL_BUDGET_APPROVER'].some(role => workflowRoles.includes(role)),
          DeleteProposals: ['BUDGET_OFFICER', 'OVERALL_BUDGET_APPROVER'].some(role => workflowRoles.includes(role)),
          ApproveProposals: ['BUDGET_APPROVER', 'BUDGET_PLANNING_ANALYST', 'BUDGET_OFFICER', 'OVERALL_BUDGET_APPROVER'].some(role => workflowRoles.includes(role)),
          ViewReports: true, // All workflow users can view reports
          ManageUsers: ['BUDGET_ADMIN', 'OVERALL_BUDGET_APPROVER'].some(role => workflowRoles.includes(role)),
          ManageSettings: ['BUDGET_ADMIN', 'OVERALL_BUDGET_APPROVER'].some(role => workflowRoles.includes(role))
        },
        hasRegionAccess: () => true, // Workflow users have access to view data
        hasDepartmentAccess: () => true,
        hasDivisionAccess: () => true
      };
    }
    
    // Return a safe default object with stubbed access-check methods for users without assignments
    return {
      userId,
      assignmentLevel: 'NONE',
      accessScope: 'OWN_ONLY',
      regions: [],
      departments: [],
      divisions: [],
      workflowRoles: [],
      rolePermissions: {
        CreateProposals: false,
        EditOwnProposals: true,
        EditAllProposals: false,
        DeleteProposals: false,
        ApproveProposals: false,
        ViewReports: false,
        ManageUsers: false,
        ManageSettings: false
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
  const newLevel = this.assignmentLevel;
  
  // Handle new assignment levels
  switch (newLevel) {
    case 'DIVISION_LEVEL':
    case 'DIVISION':
      // Division data consolidates to Department level
      return {
        level: 'DEPARTMENT',
        regionId: this.regionId,
        departmentId: this.departmentId,
        divisionName: null // Clear division for consolidated data
      };
    case 'DEPARTMENT_REGIONAL_LEVEL':
    case 'DEPARTMENT':
      // Department data consolidates to Region level
      return {
        level: 'REGION',
        regionId: this.regionId,
        departmentId: null, // Clear department for consolidated data
        divisionName: null
      };
    case 'BUDGET_AND_REVENUE_DIVISION':
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

/**
 * NEW: Get the normalized assignment level (maps legacy to new levels)
 */
HierarchicalUserAssignmentSchema.methods.getNormalizedAssignmentLevel = function() {
  const mapping = {
    'RESPONSIBILITY_CENTER': 'DIVISION_LEVEL',
    'DIVISION': 'DIVISION_LEVEL',
    'OFFICE': 'DEPARTMENT_REGIONAL_LEVEL',
    'DEPARTMENT': 'DEPARTMENT_REGIONAL_LEVEL',
    'REGION': 'BUDGET_AND_REVENUE_DIVISION'
  };
  return mapping[this.assignmentLevel] || this.assignmentLevel;
};

/**
 * NEW: Check if user is a preparer (can create proposals)
 */
HierarchicalUserAssignmentSchema.methods.isPreparer = function() {
  const preparerRoles = ['divisionCreator', 'officeCreator'];
  return this.workflowRoles.some(role => preparerRoles.includes(role));
};

/**
 * NEW: Check if user is a reviewer (reviews submissions)
 */
HierarchicalUserAssignmentSchema.methods.isReviewer = function() {
  const reviewerRoles = ['divisionReviewer'];
  return this.workflowRoles.some(role => reviewerRoles.includes(role));
};

/**
 * NEW: Check if user is an approver (approves submissions)
 */
HierarchicalUserAssignmentSchema.methods.isApprover = function() {
  const approverRoles = ['divisionApprover', 'officeApprover'];
  return this.workflowRoles.some(role => approverRoles.includes(role));
};

/**
 * NEW: Check if user is in Budget and Revenue Division
 */
HierarchicalUserAssignmentSchema.methods.isBudgetAndRevenueUser = function() {
  const budgetRoles = ['budgetAnalyst', 'budgetOfficer', 'overallBudgetApprover', 'budgetAdmin'];
  return this.workflowRoles.some(role => budgetRoles.includes(role));
};

/**
 * NEW: Get the next workflow step for this user
 */
HierarchicalUserAssignmentSchema.methods.getNextWorkflowStep = function() {
  const WORKFLOW_STEPS = {
    'divisionCreator': 'divisionReviewer',
    'divisionReviewer': 'divisionApprover',
    'divisionApprover': 'budgetAnalyst',
    'officeCreator': 'officeApprover',
    'officeApprover': 'budgetAnalyst',
    'budgetAnalyst': 'budgetOfficer',
    'budgetOfficer': 'overallBudgetApprover',
    'overallBudgetApprover': null
  };
  
  // Return next steps for this user's roles
  const nextSteps = [];
  this.workflowRoles.forEach(role => {
    const next = WORKFLOW_STEPS[role];
    if (next && !nextSteps.includes(next)) {
      nextSteps.push(next);
    }
  });
  
  return nextSteps.length > 0 ? nextSteps : null;
};

module.exports = mongoose.model('HierarchicalUserAssignment', HierarchicalUserAssignmentSchema);
