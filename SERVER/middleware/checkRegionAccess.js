const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');

// Re-implemented to use HierarchicalUserAssignment (legacy controller removed)
const checkUserRegionAccess = async (userId, regionName) => {
  try {
    if (!regionName) return true;

    const assignment = await HierarchicalUserAssignment
      .findOne({ userId, isActive: true })
      .populate('regionId', 'Region regionName RegionName');

    if (!assignment) return false;
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
  try {
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
