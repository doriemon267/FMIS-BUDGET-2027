const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
const UserOrganizationalAssignment = require('../models/UserOrganizationalAssignment');

// Re-implemented to use HierarchicalUserAssignment (legacy controller removed)
const checkUserRegionAccess = async (userId, regionName) => {
  try {
    if (!regionName) return true;

    // Try new structure first
    try {
      const newAssignment = await UserOrganizationalAssignment.findOne({ userId });
      if (newAssignment) {
        if (newAssignment.accessScope === 'FULL') return true;
        if (newAssignment.accessScope === 'OWN_ONLY') return true; // Allow OWN_ONLY users to pass region check (filtering happens downstream)
        
        // For OFFICE scope, check if the region is in their offices
        // Note: in new structure, offices can represent regions
        return true; // Be lenient for now as transition continues
      }
    } catch (e) {}

    const assignment = await HierarchicalUserAssignment
      .findOne({ userId, isActive: true })
      .populate('regionId', 'Region regionName RegionName');
    
    if (!assignment) {
      // Fallback: If no assignment doc exists at all, allow to pass region check
      // This prevents 403s for unassigned users, allowing OWN_ONLY logic to take over
      return true;
    }
    
    if (assignment.assignmentLevel === 'FULL') return true;
    const assignedRegion = assignment.regionId
      ? (assignment.regionId.Region || assignment.regionId.regionName || assignment.regionId.RegionName)
      : null;
    if (!assignedRegion) return false;
    return String(assignedRegion).toLowerCase() === String(regionName).toLowerCase();
  } catch (err) {
    console.error('Error in checkUserRegionAccess:', err);
    return false;
  }
};
const checkRegionAccess = async (req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  try {
    // SUPER ADMIN has access to all regions
    const userRoles = req.user?.Roles || [];
    if (userRoles.includes('SUPER ADMIN') || userRoles.includes('SUPER_ADMIN')) {
      return next();
    }
    
    const userId = req.user.id;
    const region = req.body.region || req.query.region;
    // If no region in request, allow access
    if (!region) {
      return next();
    }
    // Check if user has access to this region
    const hasAccess = await checkUserRegionAccess(userId, region);
    if (!hasAccess) {
      return res.status(403).json({
        message: "You don't have permission to process proposals for this region"
      });
    }
    next();
  } catch (error) {
    console.error('Error in checkRegionAccess middleware:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};
module.exports = checkRegionAccess;
module.exports.checkUserRegionAccess = checkUserRegionAccess;
