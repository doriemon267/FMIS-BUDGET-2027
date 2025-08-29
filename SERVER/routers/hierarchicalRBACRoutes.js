/**
 * 🏢 Hierarchical Access Control Routes
 * 
 * Routes for managing the hierarchical RBAC system with Division → Department → Region consolidation
 */

const express = require('express');
const router = express.Router();
const { authenticatedRoute, adminRoute } = require('../middleware/securityMiddleware');
const { 
  hierarchicalAccessControl, 
  strictHierarchicalControl, 
  getHierarchicalAccessInfo 
} = require('../middleware/hierarchicalAccessControl');
const {
  createOrUpdateHierarchicalAssignment,
  getHierarchicalAssignment,
  getAllHierarchicalAssignments,
  deleteHierarchicalAssignment,
  testHierarchicalConsolidation
} = require('../controllers/HierarchicalUserAssignmentController');

// =============================================================================
// HIERARCHICAL USER ASSIGNMENT MANAGEMENT ROUTES (Admin Only)
// =============================================================================

/**
 * Create or update hierarchical user assignment
 * POST /api/hierarchical-rbac/assignments
 */
router.post(
  '/assignments',
  ...adminRoute(),
  createOrUpdateHierarchicalAssignment
);

/**
 * Get hierarchical assignment for a specific user
 * GET /api/hierarchical-rbac/assignments/:userId
 */
router.get(
  '/assignments/:userId',
  ...authenticatedRoute(),
  getHierarchicalAssignment
);

/**
 * Get all hierarchical assignments (Admin only)
 * GET /api/hierarchical-rbac/assignments
 */
router.get(
  '/assignments',
  ...adminRoute(),
  getAllHierarchicalAssignments
);

/**
 * Delete hierarchical assignment
 * DELETE /api/hierarchical-rbac/assignments/:userId
 */
router.delete(
  '/assignments/:userId',
  ...adminRoute(),
  deleteHierarchicalAssignment
);

/**
 * Test hierarchical consolidation
 * POST /api/hierarchical-rbac/test-consolidation
 */
router.post(
  '/test-consolidation',
  ...adminRoute(),
  testHierarchicalConsolidation
);

// =============================================================================
// HIERARCHICAL ACCESS INFORMATION ROUTES
// =============================================================================

/**
 * Get current user's hierarchical access information
 * GET /api/hierarchical-rbac/my-access
 */
router.get(
  '/my-access',
  ...authenticatedRoute(),
  getHierarchicalAccessInfo,
  async (req, res) => {
    try {
      const accessInfo = req.hierarchicalAccessInfo;
      
      return res.status(200).json({
        success: true,
        message: 'Hierarchical access information retrieved successfully',
        accessInfo: {
          ...accessInfo,
          explanation: getAccessExplanation(accessInfo.scope),
          consolidationExplanation: getConsolidationExplanation(accessInfo.scope)
        }
      });
    } catch (error) {
      console.error('Error getting hierarchical access info:', error);
      return res.status(500).json({
        success: false,
        message: 'Error retrieving hierarchical access information',
        error: error.message
      });
    }
  }
);

/**
 * Validate hierarchical access for specific operation
 * POST /api/hierarchical-rbac/validate-access
 */
router.post(
  '/validate-access',
  ...authenticatedRoute(),
  async (req, res) => {
    try {
      const { operation, targetData } = req.body;
      const userId = req.user.id;
      const userRoles = req.user.Roles;

      if (!operation) {
        return res.status(400).json({
          success: false,
          message: 'Operation is required for validation',
          code: 'MISSING_OPERATION'
        });
      }

      // Create a mock request to test hierarchical access
      const mockReq = {
        user: req.user,
        body: targetData || {},
        method: operation.toUpperCase() === 'READ' ? 'GET' : 'POST'
      };

      // Test hierarchical access
      let validationResult = { hasAccess: false, reason: 'Unknown error' };

      try {
        await new Promise((resolve, reject) => {
          const mockRes = {
            status: (code) => ({
              json: (data) => {
                validationResult = { 
                  hasAccess: false, 
                  reason: data.message || 'Access denied',
                  code: data.code 
                };
                reject(new Error('Access denied'));
              }
            })
          };

          const mockNext = () => {
            validationResult = { hasAccess: true, reason: 'Access granted' };
            resolve();
          };

          hierarchicalAccessControl(operation)(mockReq, mockRes, mockNext);
        });
      } catch (error) {
        // Access was denied, but we have the validation result
      }

      return res.status(200).json({
        success: true,
        message: 'Hierarchical access validation completed',
        validation: {
          userId,
          operation,
          targetData: targetData || {},
          result: validationResult,
          timestamp: new Date()
        }
      });

    } catch (error) {
      console.error('Error validating hierarchical access:', error);
      return res.status(500).json({
        success: false,
        message: 'Error validating hierarchical access',
        error: error.message
      });
    }
  }
);

// =============================================================================
// EXAMPLE PROTECTED ROUTES WITH HIERARCHICAL ACCESS CONTROL
// =============================================================================

/**
 * Example: Get proposals with hierarchical filtering
 * GET /api/hierarchical-rbac/proposals
 */
router.get(
  '/proposals',
  ...authenticatedRoute(),
  hierarchicalAccessControl('read'),
  async (req, res) => {
    try {
      // The hierarchicalAccessControl middleware has already applied filters
      const filters = req.hierarchicalFilters || {};
      const accessInfo = req.hierarchicalAccess || {};

      // Mock proposal data for demonstration
      const mockProposals = [
        {
          id: '1',
          title: 'Division IT Equipment',
          division: 'IT Division',
          department: 'Technology Department',
          region: 'NCR',
          amount: 50000,
          status: 'Pending'
        },
        {
          id: '2',
          title: 'Department Training Budget',
          department: 'HR Department',
          region: 'Region IV-A',
          amount: 75000,
          status: 'Approved'
        },
        {
          id: '3',
          title: 'Regional Infrastructure',
          region: 'NCR',
          amount: 100000,
          status: 'Under Review'
        }
      ];

      // Apply hierarchical filtering (in real implementation, this would be database queries)
      let filteredProposals = mockProposals;

      if (accessInfo.scope === 'DIVISION') {
        filteredProposals = mockProposals.filter(p => 
          accessInfo.accessibleDivisions.includes(p.division) ||
          accessInfo.accessibleDepartments.some(d => (d.Department || d) === p.department)
        );
      } else if (accessInfo.scope === 'DEPARTMENT') {
        filteredProposals = mockProposals.filter(p => 
          accessInfo.accessibleDepartments.some(d => (d.Department || d) === p.department) ||
          accessInfo.accessibleRegions.some(r => (r.Region || r) === p.region)
        );
      } else if (accessInfo.scope === 'REGION') {
        filteredProposals = mockProposals.filter(p => 
          accessInfo.accessibleRegions.some(r => (r.Region || r) === p.region)
        );
      }

      return res.status(200).json({
        success: true,
        message: 'Proposals retrieved with hierarchical filtering',
        data: {
          proposals: filteredProposals,
          totalCount: filteredProposals.length,
          appliedFilters: filters,
          userAccess: accessInfo,
          hierarchicalInfo: {
            scope: accessInfo.scope,
            consolidationInfo: accessInfo.consolidationInfo
          }
        }
      });

    } catch (error) {
      console.error('Error getting hierarchical proposals:', error);
      return res.status(500).json({
        success: false,
        message: 'Error retrieving proposals',
        error: error.message
      });
    }
  }
);

/**
 * Example: Create proposal with hierarchical consolidation
 * POST /api/hierarchical-rbac/proposals
 */
router.post(
  '/proposals',
  ...authenticatedRoute(),
  strictHierarchicalControl('create'),
  async (req, res) => {
    try {
      // The hierarchical middleware has already applied consolidation
      const consolidatedData = req.body;
      const originalContext = req.originalOrgContext || {};
      const hierarchicalAccess = req.hierarchicalAccess || {};

      // Simulate saving to database with consolidated data
      const savedProposal = {
        id: `prop_${Date.now()}`,
        ...consolidatedData,
        createdBy: req.user.id,
        createdAt: new Date(),
        status: 'Pending'
      };

      return res.status(201).json({
        success: true,
        message: 'Proposal created with hierarchical consolidation',
        data: {
          proposal: savedProposal,
          consolidationApplied: {
            originalContext,
            consolidatedContext: {
              region: consolidatedData.region,
              department: consolidatedData.department,
              division: consolidatedData.division
            },
            consolidationMetadata: consolidatedData.consolidationMetadata
          },
          hierarchicalInfo: hierarchicalAccess
        }
      });

    } catch (error) {
      console.error('Error creating hierarchical proposal:', error);
      return res.status(500).json({
        success: false,
        message: 'Error creating proposal',
        error: error.message
      });
    }
  }
);

/**
 * Example: Update proposal with hierarchical validation
 * PUT /api/hierarchical-rbac/proposals/:id
 */
router.put(
  '/proposals/:id',
  ...authenticatedRoute(),
  strictHierarchicalControl('update'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const updatedData = req.body;
      const hierarchicalAccess = req.hierarchicalAccess || {};

      // Simulate database update
      const updatedProposal = {
        id,
        ...updatedData,
        updatedBy: req.user.id,
        updatedAt: new Date()
      };

      return res.status(200).json({
        success: true,
        message: 'Proposal updated with hierarchical validation',
        data: {
          proposal: updatedProposal,
          hierarchicalInfo: hierarchicalAccess
        }
      });

    } catch (error) {
      console.error('Error updating hierarchical proposal:', error);
      return res.status(500).json({
        success: false,
        message: 'Error updating proposal',
        error: error.message
      });
    }
  }
);

// =============================================================================
// HIERARCHICAL REPORTING ROUTES
// =============================================================================

/**
 * Get hierarchical organization structure
 * GET /api/hierarchical-rbac/organization-structure
 */
router.get(
  '/organization-structure',
  ...authenticatedRoute(),
  async (req, res) => {
    try {
      console.log('🔍 Getting organization structure...');
      
      const mongoose = require('mongoose');
      
      // Get data directly from collections to avoid model issues
      const mappingsCollection = mongoose.connection.db.collection('departmentdivisionmappings');
      const regionsCollection = mongoose.connection.db.collection('regions');
      const departmentsCollection = mongoose.connection.db.collection('departments');
      
      // Get all collections data
      const [mappings, regions, departments] = await Promise.all([
        mappingsCollection.find({}).toArray(),
        regionsCollection.find({}).toArray(),
        departmentsCollection.find({}).toArray()
      ]);
      
      console.log(`📊 Found: ${mappings.length} mappings, ${regions.length} regions, ${departments.length} departments`);
      
      // Format the data
      const formattedRegions = regions.map(region => ({
        id: region._id,
        name: region.Region || region.name || region.regionName,
        code: region.RegionCode || region.code || region.regionCode
      }));
      
      const formattedDepartments = departments.map(dept => ({
        id: dept._id,
        name: dept.Department || dept.name || dept.departmentName,
        code: dept.DepartmentCode || dept.code || dept.departmentCode
      }));
      
      const formattedMappings = mappings.map(mapping => ({
        departmentId: mapping.departmentId,
        departmentName: mapping.departmentName,
        divisions: mapping.divisions ? mapping.divisions.filter(div => div.isActive !== false) : [],
        hasSubDivisions: mapping.hasSubDivisions || false
      }));
      
      // Get departments with divisions
      const departmentsWithDivisions = formattedMappings.filter(mapping => 
        mapping.hasSubDivisions && mapping.divisions.length > 0
      );

      const response = {
        hierarchy: 'Division → Department → Region',
        consolidationFlow: {
          'DIVISION': 'Proposals consolidate to Department level',
          'DEPARTMENT': 'Proposals consolidate to Region level',
          'REGION': 'Proposals remain at Region level',
          'FULL': 'Can access all organizational levels',
          'OWN_ONLY': 'Access limited to own records only'
        },
        availableUnits: {
          regions: formattedRegions,
          departments: formattedDepartments,
          departmentsWithDivisions: departmentsWithDivisions,
          allDivisions: departmentsWithDivisions.reduce((divisions, dept) => {
            dept.divisions.forEach(div => {
              divisions.push({
                name: div.name,
                code: div.code,
                departmentId: dept.departmentId,
                departmentName: dept.departmentName
              });
            });
            return divisions;
          }, [])
        },
        mappings: formattedMappings,
        validationRules: {
          division: 'Division assignments require Department with existing divisions',
          department: 'Department assignments require valid Department',
          region: 'Region assignments require valid Region',
          divisionValidation: 'Division name must exist in selected Department'
        }
      };

      console.log('✅ Returning organization structure with:', {
        regions: formattedRegions.length,
        departments: formattedDepartments.length,
        departmentsWithDivisions: departmentsWithDivisions.length,
        mappings: formattedMappings.length
      });

      return res.status(200).json({
        success: true,
        message: 'Organization structure retrieved successfully',
        data: response
      });

    } catch (error) {
      console.error('Error getting organization structure:', error);
      return res.status(500).json({
        success: false,
        message: 'Error retrieving organization structure',
        error: error.message
      });
    }
  }
);

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getAccessExplanation(scope) {
  switch (scope) {
    case 'DIVISION':
      return 'You can create and edit records for your assigned division. Your submissions will be consolidated to your department for regional reporting.';
    case 'DEPARTMENT':
      return 'You can create and edit records for your assigned department. Your submissions will be consolidated to your region for centralized reporting.';
    case 'REGION':
      return 'You can create and edit records for your assigned region. You have full access to all data within your region.';
    case 'FULL':
      return 'You have full access to all organizational units and can perform any operation without restrictions.';
    case 'OWN_ONLY':
      return 'You can only create and edit your own records. You cannot access data from other users.';
    default:
      return 'Your access level is not recognized. Please contact your administrator.';
  }
}

function getConsolidationExplanation(scope) {
  switch (scope) {
    case 'DIVISION':
      return 'When you submit a proposal, it will be saved under your Department records and counted towards your Region totals for reporting purposes.';
    case 'DEPARTMENT':
      return 'When you submit a proposal, it will be saved under your Region records for centralized regional reporting and analysis.';
    case 'REGION':
      return 'Your proposals are saved directly to your Region records with no consolidation needed.';
    case 'FULL':
      return 'As a full access user, you can choose the organizational level for your submissions without automatic consolidation.';
    case 'OWN_ONLY':
      return 'Your records are saved individually without any organizational consolidation.';
    default:
      return 'Consolidation behavior is not defined for your access level.';
  }
}

module.exports = router;
