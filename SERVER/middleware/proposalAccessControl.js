const { checkUserOrganizationalAccess } = require('../controllers/userOrganizationalAssignmentController');
const { hasFullAccess } = require('./securityMiddleware');
// Middleware to control proposal access based on user's organizational assignments
const proposalAccessControl = (operation = 'read') => {
  return async (req, res, next) => {
    if (req.method === 'OPTIONS') return next();
    try {
      const userId = req.user.id;
      const userRoles = req.user.Roles;
      // Full access roles bypass all restrictions
      if (hasFullAccess(userRoles)) {
        return next();
      }
      // Extract organizational data from request
      const { region, department, division } = req.body;
      const queryRegion = req.query.region;
      const queryDepartment = req.query.department;
      const queryDivision = req.query.division;
      // For read operations, add filters to limit data access
      if (operation === 'read') {
        const orgFilter = {};
        // Check region access
        const targetRegion = region || queryRegion;
        if (targetRegion) {
          const hasAccess = await checkUserOrganizationalAccess(userId, { region: targetRegion });
          if (!hasAccess) {
            orgFilter.region = { $in: [] }; // Empty array = no results
          } else {
            orgFilter.region = targetRegion;
          }
        }
        // Check department access
        const targetDepartment = department || queryDepartment;
        if (targetDepartment) {
          const hasAccess = await checkUserOrganizationalAccess(userId, { department: targetDepartment });
          if (!hasAccess) {
            orgFilter.department = { $in: [] }; // Empty array = no results
          } else {
            orgFilter.department = targetDepartment;
          }
        }
        // Check division access
        const targetDivision = division || queryDivision;
        if (targetDivision) {
          const hasAccess = await checkUserOrganizationalAccess(userId, { division: targetDivision });
          if (!hasAccess) {
            orgFilter.division = { $in: [] }; // Empty array = no results
          } else {
            orgFilter.division = targetDivision;
          }
        }
        // Add organizational filter to request for use in controllers
        req.organizationalFilter = orgFilter;
        // For users with OWN_ONLY access, add processBy filter
        const assignment = await require('../models/UserOrganizationalAssignment').getUserPermissions(userId);
        if (assignment.accessScope === 'OWN_ONLY') {
          req.ownerFilter = { processBy: userId };
        }
        return next();
      }
      // For write operations (create, update, delete), check specific access
      if (['create', 'update', 'delete'].includes(operation)) {
        const targetRegion = region || queryRegion;
        const targetDepartment = department || queryDepartment;
        const targetDivision = division || queryDivision;
        // Check if user has access to the target organizational units
        const hasAccess = await checkUserOrganizationalAccess(userId, {
          region: targetRegion,
          department: targetDepartment,
          division: targetDivision
        });
        if (!hasAccess) {
          return res.status(403).json({ 
            message: "You don't have permission to perform this operation on this organizational unit" 
          });
        }
        // For update/delete operations, check if user owns the record or has admin rights
        if (['update', 'delete'].includes(operation)) {
          const recordId = req.params.id;
          if (recordId) {
            // This will be handled by individual controllers to check record ownership
            req.requireOwnershipCheck = true;
          }
        }
      }
      next();
    } catch (error) {
      console.error('Error in proposal access control:', error);
      return res.status(500).json({ message: 'Server error' });
    }
  };
};
// Middleware to check if user can edit a specific proposal
const checkProposalOwnership = (Model) => {
  return async (req, res, next) => {
    if (req.method === 'OPTIONS') return next();
    try {
      const userId = req.user.id;
      const userRoles = req.user.Roles;
      const recordId = req.params.id;
      // Full access roles can edit any proposal
      if (hasFullAccess(userRoles)) {
        return next();
      }
      // Check if record exists and user owns it
      const record = await Model.findById(recordId);
      if (!record) {
        return res.status(404).json({ message: 'Record not found' });
      }
      // Check ownership
      if (record.processBy !== userId) {
        return res.status(403).json({ 
          message: "You can only edit your own proposals" 
        });
      }
      next();
    } catch (error) {
      console.error('Error checking proposal ownership:', error);
      return res.status(500).json({ message: 'Server error' });
    }
  };
};
// Middleware to apply organizational and ownership filters to queries
const applyAccessFilters = () => {
  return (req, res, next) => {
    // Combine organizational and ownership filters
    const filters = {};
    if (req.organizationalFilter) {
      Object.assign(filters, req.organizationalFilter);
    }
    if (req.ownerFilter) {
      Object.assign(filters, req.ownerFilter);
    }
    // Add combined filter to request
    req.accessFilters = filters;
    next();
  };
};
// Helper function to get user's accessible regions/departments
const getUserAccessibleUnits = async (userId) => {
  try {
    const assignment = await require('../models/UserOrganizationalAssignment').getUserPermissions(userId);
    return {
      accessScope: assignment.accessScope,
      regions: assignment.regions || [],
      departments: assignment.departments || [],
      divisions: assignment.divisions || []
    };
  } catch (error) {
    console.error('Error getting user accessible units:', error);
    return {
      accessScope: 'OWN_ONLY',
      regions: [],
      departments: [],
      divisions: []
    };
  }
};
module.exports = {
  proposalAccessControl,
  checkProposalOwnership,
  applyAccessFilters,
  getUserAccessibleUnits
};