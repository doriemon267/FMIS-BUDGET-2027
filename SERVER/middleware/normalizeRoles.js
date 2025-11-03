/**
 * Role Normalization Middleware
 * 
 * Maps legacy/database role names to standardized workflow roles
 * This ensures consistent role checking across the application
 * 
 * Standard Workflow Roles (6-Step Workflow):
 * - PREPARER              → Step 1: Initial proposal creators
 * - BUDGET REVIEWER              → Step 2: Division level reviewers
 * - APPROVER              → Step 3: Division/Office level approvers
 * - BUDGET_ANALYST        → Step 4: Technical budget review
 * - BUDGET_OFFICER        → Step 5: Operational budget approval
 * - OVERALL_BUDGET_APPROVER → Step 6: Executive budget approval
 * - BUDGET_COORDINATOR    → BUDGET REVIEWER (Step 2: Division/Department reviewers)
 * - BUDGET_MANAGER        → Upper management (legacy)
 */

// Role synonym mapping - maps various role names to standardized workflow roles
const ROLE_SYNONYMS = {
  // BUDGET PREPARER synonyms (Initial proposal creators)
  'BUDGET PREPARER': 'BUDGET PREPARER',
  'PREPARER': 'BUDGET PREPARER',
  
  // BUDGET REVIEWER synonyms (Division level review)
  'REVIEWER': 'BUDGET REVIEWER',
  'DIVISION_REVIEWER': 'BUDGET REVIEWER',
  'DIVISIONREVIEWER': 'BUDGET REVIEWER',
  'BUDGET_COORDINATOR': 'BUDGET REVIEWER',        // Old role mapping
  'DEPARTMENTCREATOR': 'BUDGET REVIEWER',          // Legacy mapping
  'DEPARTMENT_CREATOR': 'BUDGET REVIEWER',         // Legacy mapping
  'DEPARTMENT_COORDINATOR': 'BUDGET REVIEWER',     // Legacy mapping
  'REGIONCREATOR': 'BUDGET REVIEWER',              // Legacy mapping
  'REGION_CREATOR': 'BUDGET REVIEWER',             // Legacy mapping
  'REGION_COORDINATOR': 'BUDGET REVIEWER',         // Legacy mapping
  
  // APPROVER synonyms (Division/Office level approval)
  'APPROVER': 'APPROVER',
  'DIVISION_APPROVER': 'APPROVER',
  'DIVISIONAPPROVER': 'APPROVER',
  'OFFICE_APPROVER': 'APPROVER',
  'OFFICEAPPROVER': 'APPROVER',
  'BUDGET_OFFICER': 'APPROVER',            // Old BUDGET_OFFICER maps to APPROVER
  'BUDGETOFFICER': 'APPROVER',             // Old BUDGET_OFFICER maps to APPROVER
  'DEPARTMENTVERIFIER': 'APPROVER',         // Legacy mapping
  'DEPARTMENT_VERIFIER': 'APPROVER',        // Legacy mapping
  'REGIONVERIFIER': 'BUDGET_OFFICER',      // Legacy mapping
  'REGION_VERIFIER': 'BUDGET_OFFICER',     // Legacy mapping
  'OFFICEVERIFIER': 'BUDGET_OFFICER',      // Legacy mapping
  'OFFICE_VERIFIER': 'BUDGET_OFFICER',     // Legacy mapping
  
  // OVERALL_BUDGET_APPROVER synonyms (Executive budget approval)
  'OVERALL_BUDGET_APPROVER': 'OVERALL_BUDGET_APPROVER',
  'OVERALLBUDGETAPPROVER': 'OVERALL_BUDGET_APPROVER',
  'OVERALL_APPROVER': 'OVERALL_BUDGET_APPROVER',
  'FINAL_APPROVER': 'OVERALL_BUDGET_APPROVER',
  'FINALAPPROVER': 'OVERALL_BUDGET_APPROVER',
  'BUDGET_DIRECTOR': 'OVERALL_BUDGET_APPROVER',
  'BUDGETDIRECTOR': 'OVERALL_BUDGET_APPROVER',
  
  // BUDGET MANAGER synonyms (Upper management - legacy)
  'BUDGETMANAGER': 'BUDGET_MANAGER',
  'BUDGET_MANAGER': 'BUDGET_MANAGER',
  'BUDGET_OFFICE_HEAD': 'BUDGET_MANAGER',
  'BUDGETOFFICEHEAD': 'BUDGET_MANAGER'
};

/**
 * Normalize a single role name to its standardized workflow role
 * @param {string} role - The role to normalize
 * @returns {string} - The normalized role name
 */
function normalizeRole(role) {
  if (!role || typeof role !== 'string') return role;
  
  // Convert to uppercase and remove spaces
  const normalized = role.toUpperCase().replace(/\s+/g, '_');
  
  // Check if there's a synonym mapping
  return ROLE_SYNONYMS[normalized] || normalized;
}

/**
 * Middleware to normalize user roles
 * Adds both original and normalized roles to req.user
 */
const normalizeRoles = (req, res, next) => {
  try {
    if (!req.user || !req.user.Roles) {
      return next();
    }

    const originalRoles = req.user.Roles;
    const normalizedRoles = new Set();
    const roleMapping = [];

    // Normalize each role and track mappings
    for (const role of originalRoles) {
      const normalized = normalizeRole(role);
      normalizedRoles.add(normalized);
      
      // Track the mapping for debugging
      if (normalized !== role) {
        roleMapping.push({
          original: role,
          normalized: normalized
        });
      }
    }

    // Add normalized roles to the user object
    req.user.Roles = Array.from(normalizedRoles);
    req.user.originalRoles = originalRoles;
    req.user.roleMapping = roleMapping;

    // Log role normalization for debugging (only if mappings occurred)
    if (roleMapping.length > 0) {
      console.log('🎭 Role Normalization:', {
        userId: req.user.id,
        original: originalRoles,
        normalized: req.user.Roles,
        mappings: roleMapping
      });
    }

    next();
  } catch (error) {
    console.error('❌ Role normalization error:', error);
    // Don't block the request, just log the error
    next();
  }
};

module.exports = {
  normalizeRoles,
  normalizeRole,
  ROLE_SYNONYMS
};