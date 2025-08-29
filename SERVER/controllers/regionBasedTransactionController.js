/**
 * 🔒 Region-Based Transaction Controller
 * 
 * This controller demonstrates how to implement strict region-based access control
 * for transactional operations. Users can only perform transactions in regions
 * they are explicitly assigned to through the UserOrganizationalAssignment system.
 */

const { regionBasedAccessControl, getUserAccessibleRegions } = require('../middleware/regionBasedAccessControl');
const UserOrganizationalAssignment = require('../models/UserOrganizationalAssignment');
const Region = require('../models/Region');
const { hasFullAccess } = require('../middleware/securityMiddleware');

/**
 * Get user's accessible regions
 * This endpoint returns the regions a user can transact in
 */
const getUserRegionAccess = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRoles = req.user.Roles;
    const userName = req.user.username || req.user.name;

    console.log(`🔍 Getting region access for user: ${userName} (${userId})`);

    // Check if user has full access
    if (hasFullAccess(userRoles)) {
      const allRegions = await Region.find({}).select('Region RegionCode _id').lean();
      
      return res.status(200).json({
        success: true,
        accessType: 'FULL_ACCESS',
        message: 'User has access to all regions',
        regions: allRegions,
        totalRegions: allRegions.length,
        userInfo: {
          userId,
          userName,
          roles: userRoles
        }
      });
    }

    // Get user's specific organizational assignments
    const assignment = await UserOrganizationalAssignment.getUserPermissions(userId);
    
    if (!assignment || !assignment.regions || assignment.regions.length === 0) {
      return res.status(200).json({
        success: true,
        accessType: 'NO_ACCESS',
        message: 'User has no region assignments',
        regions: [],
        totalRegions: 0,
        userInfo: {
          userId,
          userName,
          roles: userRoles
        },
        recommendations: [
          'Contact your administrator to request region access',
          'Ensure your user account has been properly configured'
        ]
      });
    }

    // Populate region details
    const populatedAssignment = await UserOrganizationalAssignment
      .findById(assignment._id)
      .populate('regions', 'Region RegionCode _id')
      .lean();

    const accessibleRegions = populatedAssignment?.regions || [];

    return res.status(200).json({
      success: true,
      accessType: 'REGION_BASED',
      message: `User has access to ${accessibleRegions.length} region(s)`,
      regions: accessibleRegions,
      totalRegions: accessibleRegions.length,
      accessScope: assignment.accessScope,
      rolePermissions: assignment.rolePermissions,
      userInfo: {
        userId,
        userName,
        roles: userRoles
      }
    });

  } catch (error) {
    console.error('🚨 Error getting user region access:', error);
    return res.status(500).json({
      success: false,
      message: 'Error retrieving user region access',
      error: error.message
    });
  }
};

/**
 * Validate region access for a transaction
 * This endpoint checks if a user can perform a specific operation in a region
 */
const validateRegionTransaction = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRoles = req.user.Roles;
    const { region, operation = 'read' } = req.body;

    if (!region) {
      return res.status(400).json({
        success: false,
        message: 'Region is required for validation',
        code: 'REGION_REQUIRED'
      });
    }

    console.log(`🔍 Validating ${operation} access for user ${userId} in region: ${region}`);

    // Check if user has full access
    if (hasFullAccess(userRoles)) {
      return res.status(200).json({
        success: true,
        accessGranted: true,
        message: 'Full access granted - user can transact in all regions',
        region,
        operation,
        accessType: 'FULL_ACCESS'
      });
    }

    // Get user's assignments and check region access
    const assignment = await UserOrganizationalAssignment.getUserPermissions(userId);
    
    // Check region access
    const hasRegionAccess = assignment.regions?.some(assignedRegion => {
      if (typeof assignedRegion === 'string') {
        return assignedRegion === region;
      }
      return assignedRegion.Region === region || assignedRegion._id?.toString() === region;
    }) || false;

    if (!hasRegionAccess) {
      const allowedRegions = assignment.regions?.map(r => r.Region || r) || [];
      
      return res.status(403).json({
        success: false,
        accessGranted: false,
        message: `Access denied. You cannot ${operation} data in region: ${region}`,
        region,
        operation,
        allowedRegions,
        code: 'REGION_ACCESS_DENIED'
      });
    }

    // Check operation permissions
    const permissions = assignment.rolePermissions || {};
    let canPerformOperation = true;

    switch (operation) {
      case 'create':
        canPerformOperation = permissions.canCreateProposals !== false;
        break;
      case 'update':
        canPerformOperation = permissions.canEditOwnProposals !== false || permissions.canEditAllProposals === true;
        break;
      case 'delete':
        canPerformOperation = permissions.canDeleteProposals === true;
        break;
    }

    if (!canPerformOperation) {
      return res.status(403).json({
        success: false,
        accessGranted: false,
        message: `Access denied. You don't have permission to perform ${operation} operations`,
        region,
        operation,
        code: 'OPERATION_PERMISSION_DENIED',
        rolePermissions: permissions
      });
    }

    return res.status(200).json({
      success: true,
      accessGranted: true,
      message: `Access granted for ${operation} operation in region: ${region}`,
      region,
      operation,
      accessType: 'REGION_BASED',
      permissions
    });

  } catch (error) {
    console.error('🚨 Error validating region transaction:', error);
    return res.status(500).json({
      success: false,
      message: 'Error validating region transaction',
      error: error.message
    });
  }
};

/**
 * Example of a protected transactional endpoint
 * This shows how to implement region-based access control in actual business logic
 */
const createRegionBasedTransaction = async (req, res) => {
  try {
    const userId = req.user.id;
    const { region, transactionData, transactionType } = req.body;

    // The regionBasedAccessControl middleware has already validated:
    // 1. User has access to the specified region
    // 2. User has permission to create transactions
    // 3. Region is properly validated and stored in req.validatedRegion

    const validatedRegion = req.validatedRegion || region;

    console.log(`💼 Creating ${transactionType} transaction for user ${userId} in region: ${validatedRegion}`);

    // Simulate transaction creation with region enforcement
    const transaction = {
      id: `txn_${Date.now()}`,
      type: transactionType,
      region: validatedRegion,
      createdBy: userId,
      createdAt: new Date(),
      data: transactionData,
      status: 'PENDING'
    };

    // In a real implementation, this would save to your database
    // const savedTransaction = await YourTransactionModel.create(transaction);

    return res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      transaction,
      regionAccess: req.userRegionAccess
    });

  } catch (error) {
    console.error('🚨 Error creating region-based transaction:', error);
    return res.status(500).json({
      success: false,
      message: 'Error creating transaction',
      error: error.message
    });
  }
};

/**
 * Get transactions with automatic region filtering
 * This shows how read operations are automatically filtered by user's region access
 */
const getRegionFilteredTransactions = async (req, res) => {
  try {
    const userId = req.user.id;
    const requestedRegion = req.query.region;

    // The regionBasedAccessControl middleware has already:
    // 1. Applied appropriate region filters in req.regionFilters
    // 2. Set accessible regions in req.accessibleRegions

    const regionFilters = req.regionFilters || {};
    const accessibleRegions = req.accessibleRegions || [];

    console.log(`📋 Getting transactions for user ${userId} with filters:`, regionFilters);

    // Simulate database query with region filters
    const mockTransactions = [
      { id: 1, region: 'NCR', type: 'PROPOSAL', amount: 100000 },
      { id: 2, region: 'REGION_IV', type: 'BUDGET', amount: 200000 },
      { id: 3, region: 'REGION_VII', type: 'PROPOSAL', amount: 150000 }
    ];

    // Apply region filters (in real implementation, this would be done in the database)
    let filteredTransactions = mockTransactions;
    
    if (regionFilters.region && regionFilters.region.$in) {
      filteredTransactions = mockTransactions.filter(txn => 
        regionFilters.region.$in.includes(txn.region)
      );
    }

    // If a specific region was requested, further filter
    if (requestedRegion) {
      filteredTransactions = filteredTransactions.filter(txn => 
        txn.region === requestedRegion
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Transactions retrieved successfully',
      transactions: filteredTransactions,
      totalCount: filteredTransactions.length,
      appliedFilters: regionFilters,
      accessibleRegions: accessibleRegions,
      requestedRegion: requestedRegion || 'ALL'
    });

  } catch (error) {
    console.error('🚨 Error getting region-filtered transactions:', error);
    return res.status(500).json({
      success: false,
      message: 'Error retrieving transactions',
      error: error.message
    });
  }
};

/**
 * Bulk assign regions to a user (Admin only)
 * This endpoint allows administrators to assign regions to users
 */
const assignUserRegions = async (req, res) => {
  try {
    const { targetUserId, regions, accessScope = 'REGION', rolePermissions = {} } = req.body;
    const adminUserId = req.user.id;

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'Target user ID is required',
        code: 'USER_ID_REQUIRED'
      });
    }

    if (!regions || !Array.isArray(regions) || regions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one region must be specified',
        code: 'REGIONS_REQUIRED'
      });
    }

    console.log(`👨‍💼 Admin ${adminUserId} assigning regions to user ${targetUserId}:`, regions);

    // Validate that all specified regions exist
    const validRegions = await Region.find({ 
      $or: [
        { _id: { $in: regions } },
        { Region: { $in: regions } }
      ]
    }).lean();

    if (validRegions.length !== regions.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more specified regions do not exist',
        validRegions: validRegions.map(r => r.Region),
        code: 'INVALID_REGIONS'
      });
    }

    // Create or update user organizational assignment
    const regionIds = validRegions.map(r => r._id);
    
    let assignment = await UserOrganizationalAssignment.findOne({ userId: targetUserId });
    
    if (assignment) {
      assignment.regions = regionIds;
      assignment.accessScope = accessScope;
      assignment.rolePermissions = { ...assignment.rolePermissions, ...rolePermissions };
      assignment.lastModifiedBy = adminUserId;
      await assignment.save();
    } else {
      // Need to get user details for new assignment
      // In a real implementation, you would fetch from your User model
      assignment = await UserOrganizationalAssignment.create({
        userId: targetUserId,
        userName: `User_${targetUserId}`, // Replace with actual user lookup
        email: `user${targetUserId}@example.com`, // Replace with actual user lookup
        accessScope,
        regions: regionIds,
        rolePermissions: {
          canCreateProposals: true,
          canEditOwnProposals: true,
          canEditAllProposals: false,
          canDeleteProposals: false,
          canApproveProposals: false,
          canViewReports: true,
          canManageUsers: false,
          canManageSettings: false,
          ...rolePermissions
        },
        createdBy: adminUserId,
        lastModifiedBy: adminUserId
      });
    }

    // Populate the result
    const populatedAssignment = await UserOrganizationalAssignment
      .findById(assignment._id)
      .populate('regions', 'Region RegionCode _id')
      .lean();

    return res.status(200).json({
      success: true,
      message: 'User region assignment updated successfully',
      assignment: populatedAssignment,
      assignedRegions: populatedAssignment.regions,
      totalRegions: populatedAssignment.regions.length
    });

  } catch (error) {
    console.error('🚨 Error assigning user regions:', error);
    return res.status(500).json({
      success: false,
      message: 'Error assigning user regions',
      error: error.message
    });
  }
};

module.exports = {
  getUserRegionAccess,
  validateRegionTransaction,
  createRegionBasedTransaction,
  getRegionFilteredTransactions,
  assignUserRegions
};
