/**
 * Role Normalization Middleware
 * 
 * Maps legacy/database role names to standardized workflow roles
 * This ensures consistent role checking across the application
 * 
 * Standard Workflow Roles:
 * - BUDGET_ANALYST      → Division level creators (divisionCreator)
 * - BUDGET_COORDINATOR  → Department/Region level creators (departmentCreator)
 * - BUDGET_OFFICER      → Department/Region level verifiers (departmentVerifier)
 * - BUDGET_MANAGER      → Budget Office final approvers (budgetManager)
 */

// Role synonym mapping - maps various role names to standardized workflow roles
const ROLE_SYNONYMS = {
  // BUDGET ANALYST synonyms (Division level creators)
  'DIVISIONCREATOR': 'BUDGET_ANALYST',
  'DIVISION_CREATOR': 'BUDGET_ANALYST',
  'DIVISION_ANALYST': 'BUDGET_ANALYST',
  'DIVISION_ENCODER': 'BUDGET_ANALYST',
  'DIVISION_STAFF': 'BUDGET_ANALYST',
  'DIVISIONAPPROVER': 'BUDGET_ANALYST',  // Legacy - to be migrated
  'DIVISION_APPROVER': 'BUDGET_ANALYST', // Legacy - to be migrated
  
  // BUDGET COORDINATOR synonyms (Department/Region level creators)
  'DEPARTMENTCREATOR': 'BUDGET_COORDINATOR',
  'DEPARTMENT_CREATOR': 'BUDGET_COORDINATOR',
  'DEPARTMENT_COORDINATOR': 'BUDGET_COORDINATOR',
  'REGIONCREATOR': 'BUDGET_COORDINATOR',
  'REGION_CREATOR': 'BUDGET_COORDINATOR',
  'REGION_COORDINATOR': 'BUDGET_COORDINATOR',
  
  // BUDGET OFFICER synonyms (Department/Region level verifiers)
  'DEPARTMENTVERIFIER': 'BUDGET_OFFICER',
  'DEPARTMENT_VERIFIER': 'BUDGET_OFFICER',
  'DEPARTMENT_APPROVER': 'BUDGET_OFFICER',
  'REGIONVERIFIER': 'BUDGET_OFFICER',
  'REGION_VERIFIER': 'BUDGET_OFFICER',
  'REGION_APPROVER': 'BUDGET_OFFICER',
  'OFFICEAPPROVER': 'BUDGET_OFFICER',
  'OFFICE_APPROVER': 'BUDGET_OFFICER',
  'OFFICEVERIFIER': 'BUDGET_OFFICER',
  'OFFICE_VERIFIER': 'BUDGET_OFFICER',
  'OFFICE_HEAD': 'BUDGET_OFFICER',
  
  // BUDGET MANAGER synonyms (Budget Office final approvers)
  'BUDGETMANAGER': 'BUDGET_MANAGER',
  'BUDGET_MANAGER': 'BUDGET_MANAGER',
  'BUDGET_OFFICE_HEAD': 'BUDGET_MANAGER',
  'BUDGET_DIRECTOR': 'BUDGET_MANAGER',
  'FINAL_APPROVER': 'BUDGET_MANAGER',
  'BUDGETOFFICEHEAD': 'BUDGET_MANAGER',
  'BUDGETDIRECTOR': 'BUDGET_MANAGER',
  'FINALAPPROVER': 'BUDGET_MANAGER'
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