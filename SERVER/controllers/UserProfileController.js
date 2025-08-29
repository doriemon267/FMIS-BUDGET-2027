const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');

// Get current user's complete profile including hierarchical assignment
const getCurrentUserProfile = async (req, res) => {
  try {
    const userId = String(req.user.id);
    console.log('[UserProfileController] Loading HierarchicalUserAssignment for userId:', userId);

    const assignmentDoc = await HierarchicalUserAssignment
      .findOne({ userId, isActive: true })
      .populate('regionId', 'Region regionName RegionName _id')
      .populate('departmentId', 'Department departmentName DepartmentName _id');

    if (!assignmentDoc) {
      console.warn('[UserProfileController] No HierarchicalUserAssignment found for userId:', userId);
    } else {
      console.log('[UserProfileController] Found hierarchical assignment:', assignmentDoc?._id);
    }

    const regionsArr = assignmentDoc && assignmentDoc.regionId ? [{
      id: assignmentDoc.regionId._id,
      _id: assignmentDoc.regionId._id,
      name: assignmentDoc.regionId.Region || assignmentDoc.regionId.regionName || assignmentDoc.regionId.RegionName,
      regionName: assignmentDoc.regionId.Region || assignmentDoc.regionId.regionName || assignmentDoc.regionId.RegionName,
      Region: assignmentDoc.regionId.Region || assignmentDoc.regionId.regionName || assignmentDoc.regionId.RegionName
    }] : [];

    const departmentsArr = assignmentDoc && assignmentDoc.departmentId ? [{
      id: assignmentDoc.departmentId._id,
      _id: assignmentDoc.departmentId._id,
      name: assignmentDoc.departmentId.Department || assignmentDoc.departmentId.departmentName || assignmentDoc.departmentId.DepartmentName,
      Department: assignmentDoc.departmentId.Department || assignmentDoc.departmentId.departmentName || assignmentDoc.departmentId.DepartmentName
    }] : [];

    const hierarchicalAccess = assignmentDoc ? {
      scope: assignmentDoc.assignmentLevel,
      accessibleRegions: regionsArr.map(r => ({ _id: r._id, regionName: r.regionName || r.Region || r.name })),
      accessibleDepartments: departmentsArr.map(d => ({ _id: d._id, departmentName: d.Department || d.name })),
      accessibleDivisions: assignmentDoc.divisionName ? [assignmentDoc.divisionName] : [],
      rolePermissions: assignmentDoc.rolePermissions || {},
      consolidationInfo: assignmentDoc.getConsolidationTarget ? assignmentDoc.getConsolidationTarget() : null
    } : {
      scope: 'OWN_ONLY',
      accessibleRegions: [],
      accessibleDepartments: [],
      accessibleDivisions: [],
      rolePermissions: {}
    };

    const userProfile = {
      ...req.user,
      // Backward compat fields
      regionAssignments: null, // legacy removed
      regions: regionsArr,
      departments: departmentsArr,
      // New hierarchical info
      hierarchicalAssignment: assignmentDoc ? {
        assignmentLevel: assignmentDoc.assignmentLevel,
        regionId: assignmentDoc.regionId?._id || null,
        departmentId: assignmentDoc.departmentId?._id || null,
        divisionName: assignmentDoc.divisionName || null
      } : null,
      hierarchicalAccess
    };

    return res.status(200).json(userProfile);
  } catch (error) {
    console.error('Error fetching current user profile:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getCurrentUserProfile
};
