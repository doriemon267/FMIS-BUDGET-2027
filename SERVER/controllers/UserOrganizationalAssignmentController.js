const UserOrganizationalAssignment = require('../models/UserOrganizationalAssignment');
const Region = require('../models/Region');
const Department = require('../models/Department');
// Get all user organizational assignments
const getAllUserOrganizationalAssignments = async (req, res) => {
  try {
    const assignments = await UserOrganizationalAssignment.find()
      .populate('regions departments');
    return res.status(200).json(assignments);
  } catch (error) {
    console.error('Error fetching user organizational assignments:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};
// Get assignments for a specific user
const getUserOrganizationalAssignments = async (req, res) => {
  try {
    const { userId } = req.params;
    const assignment = await UserOrganizationalAssignment.findByUserId(userId);
    if (!assignment) {
      return res.status(200).json({ 
        userId, 
        accessScope: 'OWN_ONLY',
        regions: [], 
        departments: [], 
        divisions: [],
        rolePermissions: {}
      });
    }
    return res.status(200).json(assignment);
  } catch (error) {
    console.error('Error fetching user organizational assignments:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};
// Get current user's organizational assignments
const getCurrentUserOrganizationalAssignments = async (req, res) => {
  try {
    const userId = req.user.id;
    const assignment = await UserOrganizationalAssignment.getUserPermissions(userId);
    return res.status(200).json(assignment);
  } catch (error) {
    console.error('Error fetching current user organizational assignments:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};
// Create or update user organizational assignment
const createOrUpdateUserOrganizationalAssignment = async (req, res) => {
  try {
    const { 
      userId, 
      userName, 
      email, 
      accessScope,
      regions, 
      departments, 
      divisions,
      rolePermissions,
      restrictions
    } = req.body;
    if (!userId || !userName || !email) {
      return res.status(400).json({ message: 'Missing required fields: userId, userName, email' });
    }
    // Find existing assignment or create new one
    let assignment = await UserOrganizationalAssignment.findOne({ userId });
    if (assignment) {
      // Update existing assignment
      assignment.userName = userName;
      assignment.email = email;
      assignment.accessScope = accessScope || assignment.accessScope;
      assignment.regions = regions || assignment.regions;
      assignment.departments = departments || assignment.departments;
      assignment.divisions = divisions || assignment.divisions;
      assignment.rolePermissions = { ...assignment.rolePermissions, ...rolePermissions };
      assignment.restrictions = { ...assignment.restrictions, ...restrictions };
      assignment.lastModifiedBy = req.user.id;
      await assignment.save();
    } else {
      // Create new assignment
      assignment = await UserOrganizationalAssignment.create({
        userId,
        userName,
        email,
        accessScope: accessScope || 'REGION',
        regions: regions || [],
        departments: departments || [],
        divisions: divisions || [],
        rolePermissions: rolePermissions || {},
        restrictions: restrictions || {},
        createdBy: req.user.id,
        lastModifiedBy: req.user.id
      });
    }
    // Populate before returning
    const populatedAssignment = await UserOrganizationalAssignment
      .findById(assignment._id)
      .populate('regions departments');
    return res.status(200).json(populatedAssignment);
  } catch (error) {
    console.error('Error creating/updating user organizational assignment:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};
// Delete user organizational assignment
const deleteUserOrganizationalAssignment = async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await UserOrganizationalAssignment.findOneAndDelete({ userId });
    if (!result) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    return res.status(200).json({ message: 'Assignment deleted successfully' });
  } catch (error) {
    console.error('Error deleting user organizational assignment:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};
// Check if user has access to a specific organizational unit
const checkUserOrganizationalAccess = async (userId, { region, department, division }) => {
  try {
    const assignment = await UserOrganizationalAssignment.getUserPermissions(userId);
    // Full access bypasses all restrictions
    if (assignment.accessScope === 'FULL') {
      return true;
    }
    // Own only access denies all organizational checks
    if (assignment.accessScope === 'OWN_ONLY') {
      return false;
    }
    // Check region access
    if (region && !assignment.hasRegionAccess(region)) {
      return false;
    }
    // Check department access
    if (department && !assignment.hasDepartmentAccess(department)) {
      return false;
    }
    // Check division access
    if (division && !assignment.hasDivisionAccess(division)) {
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error checking user organizational access:', error);
    return false;
  }
};
// Get user's role permissions
const getUserRolePermissions = async (req, res) => {
  try {
    const userId = req.user.id;
    const assignment = await UserOrganizationalAssignment.getUserPermissions(userId);
    return res.status(200).json({
      userId,
      accessScope: assignment.accessScope,
      rolePermissions: assignment.rolePermissions,
      restrictions: assignment.restrictions
    });
  } catch (error) {
    console.error('Error fetching user role permissions:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};
// Bulk update role permissions for multiple users
const bulkUpdateRolePermissions = async (req, res) => {
  try {
    const { userUpdates } = req.body; // Array of { userId, rolePermissions, restrictions }
    if (!Array.isArray(userUpdates)) {
      return res.status(400).json({ message: 'userUpdates must be an array' });
    }
    const results = [];
    for (const update of userUpdates) {
      const { userId, rolePermissions, restrictions } = update;
      const assignment = await UserOrganizationalAssignment.findOne({ userId });
      if (assignment) {
        assignment.rolePermissions = { ...assignment.rolePermissions, ...rolePermissions };
        assignment.restrictions = { ...assignment.restrictions, ...restrictions };
        assignment.lastModifiedBy = req.user.id;
        await assignment.save();
        results.push({ userId, status: 'updated' });
      } else {
        results.push({ userId, status: 'not_found' });
      }
    }
    return res.status(200).json({ results });
  } catch (error) {
    console.error('Error bulk updating role permissions:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};
module.exports = {
  getAllUserOrganizationalAssignments,
  getUserOrganizationalAssignments,
  getCurrentUserOrganizationalAssignments,
  createOrUpdateUserOrganizationalAssignment,
  deleteUserOrganizationalAssignment,
  checkUserOrganizationalAccess,
  getUserRolePermissions,
  bulkUpdateRolePermissions
};