/**
 * 🔒 Region-Based Access Control Routes
 * 
 * This router demonstrates how to implement strict region-based access control
 * where users can only transact in regions they are explicitly assigned to.
 * 
 * Features:
 * - User-region assignment management
 * - Transaction validation by region
 * - Automatic region filtering for read operations
 * - Administrative endpoints for region assignment
 */
const Router = require('express').Router;
const {
  getUserRegionAccess,
  validateRegionTransaction,
  createRegionBasedTransaction,
  getRegionFilteredTransactions,
  assignUserRegions
} = require('../controllers/regionBasedTransactionController');
// Import RBAC middleware
const { regionBasedAccessControl, strictRegionControl, getUserAccessibleRegions } = require('../middleware/regionBasedAccessControl');
// Import existing security middleware
const { 
  authenticatedRoute, 
  adminRoute, 
  PERMISSION_LEVELS 
} = require('../middleware/securityMiddleware');
const regionRBACRouter = Router();
// 🔒 REGION-BASED ACCESS CONTROL ROUTES
/**
 * USER ACCESS INFORMATION ENDPOINTS
 * These endpoints help users and administrators understand region access
 */
// Get current user's accessible regions
regionRBACRouter.get(
  '/my-region-access',
  ...authenticatedRoute(),
  getUserAccessibleRegions,
  getUserRegionAccess
);
// Validate if user can perform operation in specific region
regionRBACRouter.post(
  '/validate-region-access',
  ...authenticatedRoute(),
  validateRegionTransaction
);
/**
 * REGION-FILTERED DATA ENDPOINTS
 * These endpoints demonstrate automatic region filtering for read operations
 */
// Get transactions with automatic region filtering
regionRBACRouter.get(
  '/transactions',
  ...authenticatedRoute(),
  regionBasedAccessControl('read', { logAccess: true }), // Apply read filters
  getRegionFilteredTransactions
);
// Get transactions for specific region (with validation)
regionRBACRouter.get(
  '/transactions/region/:region',
  ...authenticatedRoute(),
  (req, res, next) => {
    // Move region from params to body for middleware compatibility
    req.body.region = req.params.region;
    next();
  },
  regionBasedAccessControl('read', { logAccess: true }),
  getRegionFilteredTransactions
);
/**
 * TRANSACTIONAL ENDPOINTS WITH STRICT REGION CONTROL
 * These endpoints enforce strict region-based access for write operations
 */
// Create transaction (strict region validation)
regionRBACRouter.post(
  '/transactions',
  ...authenticatedRoute(),
  strictRegionControl('create'), // Strict validation for create operations
  createRegionBasedTransaction
);
// Update transaction (strict region validation)
regionRBACRouter.put(
  '/transactions/:id',
  ...authenticatedRoute(),
  strictRegionControl('update'), // Strict validation for update operations
  (req, res) => {
    // Example update endpoint
    const transactionId = req.params.id;
    const validatedRegion = req.validatedRegion;
    res.status(200).json({
      success: true,
      message: `Transaction ${transactionId} updated successfully`,
      region: validatedRegion,
      userRegionAccess: req.userRegionAccess
    });
  }
);
// Delete transaction (strict region validation)
regionRBACRouter.delete(
  '/transactions/:id',
  ...authenticatedRoute(),
  strictRegionControl('delete'), // Strict validation for delete operations
  (req, res) => {
    // Example delete endpoint
    const transactionId = req.params.id;
    const validatedRegion = req.validatedRegion;
    res.status(200).json({
      success: true,
      message: `Transaction ${transactionId} deleted successfully`,
      region: validatedRegion,
      userRegionAccess: req.userRegionAccess
    });
  }
);
/**
 * PROPOSAL ENDPOINTS WITH REGION-BASED ACCESS CONTROL
 * Examples of how to apply RBAC to existing proposal endpoints
 */
// Get proposals with region filtering
regionRBACRouter.get(
  '/proposals',
  ...authenticatedRoute(),
  regionBasedAccessControl('read', { logAccess: true }),
  async (req, res) => {
    try {
      const regionFilters = req.regionFilters || {};
      const accessibleRegions = req.accessibleRegions || [];
      // In a real implementation, apply these filters to your Proposal model query
      // Example query structure:
      // const proposals = await Proposal.find({
      //   ...regionFilters,
      //   ...req.query // other query parameters
      // });
      const mockProposals = [
        { id: 1, region: 'NCR', title: 'IT Equipment Purchase', amount: 500000 },
        { id: 2, region: 'REGION_IV', title: 'Office Supplies', amount: 100000 },
        { id: 3, region: 'REGION_VII', title: 'Training Program', amount: 200000 }
      ];
      // Apply region filters to mock data
      let filteredProposals = mockProposals;
      if (regionFilters.region && regionFilters.region.$in) {
        filteredProposals = mockProposals.filter(proposal => 
          regionFilters.region.$in.includes(proposal.region)
        );
      }
      res.status(200).json({
        success: true,
        proposals: filteredProposals,
        totalCount: filteredProposals.length,
        appliedFilters: regionFilters,
        accessibleRegions: accessibleRegions
      });
    } catch (error) {
      console.error('Error getting proposals:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving proposals',
        error: error.message
      });
    }
  }
);
// Create proposal with region validation
regionRBACRouter.post(
  '/proposals',
  ...authenticatedRoute(),
  strictRegionControl('create'),
  async (req, res) => {
    try {
      const { title, description, amount, category } = req.body;
      const validatedRegion = req.validatedRegion;
      const userId = req.user.id;
      // Create proposal with validated region
      const proposal = {
        id: `prop_${Date.now()}`,
        title,
        description,
        amount,
        category,
        region: validatedRegion,
        createdBy: userId,
        createdAt: new Date(),
        status: 'DRAFT'
      };
      // In a real implementation:
      // const savedProposal = await Proposal.create(proposal);
      res.status(201).json({
        success: true,
        message: 'Proposal created successfully',
        proposal,
        regionAccess: req.userRegionAccess
      });
    } catch (error) {
      console.error('Error creating proposal:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating proposal',
        error: error.message
      });
    }
  }
);
/**
 * ADMINISTRATIVE ENDPOINTS (LEGACY REMOVED)
 * Legacy user-region assignment endpoints have been removed.
 * Please use hierarchical endpoints under /api/hierarchical-rbac instead.
 */
/**
 * TESTING & DEBUGGING ENDPOINTS
 * These endpoints help with testing and debugging the RBAC system
 */
// Test region access for different operations
regionRBACRouter.post(
  '/test/region-access',
  ...authenticatedRoute(),
  async (req, res) => {
    try {
      const { region, operations = ['read', 'create', 'update', 'delete'] } = req.body;
      const userId = req.user.id;
      if (!region) {
        return res.status(400).json({
          success: false,
          message: 'Region is required for testing',
          code: 'REGION_REQUIRED'
        });
      }
      const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
      const { hasFullAccess } = require('../middleware/securityMiddleware');
      const { checkRegionAccess, checkOperationPermission } = require('../middleware/regionBasedAccessControl');
      const userRoles = req.user.Roles;
      const assignmentDoc = await HierarchicalUserAssignment.findOne({ userId, isActive: true }).populate('regionId', 'Region RegionName regionName');
      const assignment = assignmentDoc ? {
        accessScope: assignmentDoc.assignmentLevel,
        regions: assignmentDoc.regionId ? [{ Region: assignmentDoc.regionId.Region || assignmentDoc.regionId.RegionName || assignmentDoc.regionId.regionName }] : []
      } : { accessScope: 'OWN_ONLY', regions: [] };
      const testResults = {
        userId,
        region,
        hasFullAccess: hasFullAccess(userRoles),
        accessScope: assignment.accessScope,
        assignedRegions: assignment.regions?.map(r => r.Region || r) || [],
        operationResults: {}
      };
      // Test each operation
      for (const operation of operations) {
        const hasRegionAccess = await checkRegionAccess(assignment, region);
        const hasOperationPermission = checkOperationPermission(assignment, operation);
        testResults.operationResults[operation] = {
          hasRegionAccess,
          hasOperationPermission,
          allowed: hasRegionAccess && hasOperationPermission
        };
      }
      res.status(200).json({
        success: true,
        message: 'Region access test completed',
        testResults
      });
    } catch (error) {
      console.error('Error testing region access:', error);
      res.status(500).json({
        success: false,
        message: 'Error testing region access',
        error: error.message
      });
    }
  }
);
module.exports = regionRBACRouter;
