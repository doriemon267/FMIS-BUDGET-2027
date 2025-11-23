/**
 * 🏢 Hierarchical Access Control Routes
 *
 * Routes for managing the hierarchical RBAC system with:
 * - NEW: Responsibility Center → Office consolidation
 * - OLD: Division → Department → Region consolidation (backward compatibility)
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
  updateWorkflowRoles,
  deleteHierarchicalAssignment,
  testHierarchicalConsolidation,
  lookupUserFromMainDB
} = require('../controllers/HierarchicalUserAssignmentController');

// NEW: Import new organizational assignment controller
let newOrgAssignmentController = null;
try {
  newOrgAssignmentController = require('../controllers/UserOrganizationalAssignmentController');
} catch (error) {
  console.log('New organizational assignment controller not available, using backward compatibility mode');
}
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
 * Lookup user information from fmis_main database
 * GET /api/hierarchical-rbac/user-lookup/:userId
 */
router.get(
  '/user-lookup/:userId',
  ...authenticatedRoute(),
  lookupUserFromMainDB
);

/**
 * Update workflow roles for a user (Admin only)
 * POST /api/hierarchical-rbac/assignments/:userId/workflow-roles
 */
router.post(
  '/assignments/:userId/workflow-roles',
  ...adminRoute(),
  updateWorkflowRoles
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
// NEW ORGANIZATIONAL ASSIGNMENT ROUTES (Responsibility Center → Office)
// =============================================================================

/**
 * Create or update organizational assignment (NEW STRUCTURE)
 * POST /api/hierarchical-rbac/organizational-assignments
 * NOTE: Redirecting to hierarchical assignments to focus on hierarchical system
 */
router.post(
  '/organizational-assignments',
  ...adminRoute(),
  async (req, res) => {
    try {
      // Redirect to hierarchical assignments controller to focus on hierarchical system
      const hierarchicalController = require('../controllers/HierarchicalUserAssignmentController');
      return await hierarchicalController.createOrUpdateHierarchicalAssignment(req, res);
    } catch (error) {
      console.error('Error in organizational assignment creation:', error);
      return res.status(500).json({
        success: false,
        message: 'Error creating organizational assignment',
        error: error.message
      });
    }
  }
);

/**
 * Get organizational assignment for a specific user (NEW STRUCTURE)
 * GET /api/hierarchical-rbac/organizational-assignments/:userId
 * NOTE: Redirecting to hierarchical assignments to focus on hierarchical system
 */
router.get(
  '/organizational-assignments/:userId',
  ...authenticatedRoute(),
  async (req, res) => {
    try {
      // Redirect to hierarchical assignments controller to focus on hierarchical system
      const hierarchicalController = require('../controllers/HierarchicalUserAssignmentController');
      return await hierarchicalController.getHierarchicalAssignment(req, res);
    } catch (error) {
      console.error('Error getting organizational assignment:', error);
      return res.status(500).json({
        success: false,
        message: 'Error retrieving organizational assignment',
        error: error.message
      });
    }
  }
);

/**
 * Get all organizational assignments (Admin only) (NEW STRUCTURE)
 * GET /api/hierarchical-rbac/organizational-assignments
 * NOTE: Redirecting to hierarchical assignments to focus on hierarchical system
 */
router.get(
  '/organizational-assignments',
  ...adminRoute(),
  async (req, res) => {
    try {
      // Redirect to hierarchical assignments controller to focus on hierarchical system
      const hierarchicalController = require('../controllers/HierarchicalUserAssignmentController');
      return await hierarchicalController.getAllHierarchicalAssignments(req, res);
    } catch (error) {
      console.error('Error getting all organizational assignments:', error);
      return res.status(500).json({
        success: false,
        message: 'Error retrieving organizational assignments',
        error: error.message
      });
    }
  }
);

/**
 * Delete organizational assignment (NEW STRUCTURE)
 * DELETE /api/hierarchical-rbac/organizational-assignments/:userId
 * NOTE: Redirecting to hierarchical assignments to focus on hierarchical system
 */
router.delete(
  '/organizational-assignments/:userId',
  ...adminRoute(),
  async (req, res) => {
    try {
      // Redirect to hierarchical assignments controller to focus on hierarchical system
      const hierarchicalController = require('../controllers/HierarchicalUserAssignmentController');
      return await hierarchicalController.deleteHierarchicalAssignment(req, res);
    } catch (error) {
      console.error('Error deleting organizational assignment:', error);
      return res.status(500).json({
        success: false,
        message: 'Error deleting organizational assignment',
        error: error.message
      });
    }
  }
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
 * Get hierarchical organization structure (SUPPORTS BOTH OLD AND NEW STRUCTURES)
 * GET /api/hierarchical-rbac/organization-structure
 */
router.get(
  '/organization-structure',
  ...authenticatedRoute(),
  async (req, res) => {
    try {
      const mongoose = require('mongoose');
      const { structure = 'new' } = req.query; // 'new' or 'old'

      if (structure === 'new') {
        // NEW STRUCTURE: Convert old NIA structure to new format
        // Get data from existing collections first
        const mappingsCollection = mongoose.connection.db.collection('departmentdivisionmappings');
        const regionsCollection = mongoose.connection.db.collection('regions');
        const departmentsCollection = mongoose.connection.db.collection('departments');

        const [mappings, regions, departments] = await Promise.all([
          mappingsCollection.find({}).toArray(),
          regionsCollection.find({}).toArray(),
          departmentsCollection.find({}).toArray()
        ]);

        const officesMap = new Map();
        const responsibilityCentersMap = new Map();

        // Convert departments/divisions to offices
        if (departments && departments.length > 0) {
          departments.forEach((dept, index) => {
            // Use actual department _id as officeId instead of fabricated string
            const officeId = dept._id;

            // Find region information for this department from mappings
            const deptMappings = mappings.filter(m =>
              m.departmentId && m.departmentId.toString() === dept._id.toString()
            );

            // Check if this is a central office (displayOrder < 100)
            const isCentralOffice = deptMappings.length > 1 && (dept.displayOrder < 100);

            if (isCentralOffice) {
              // Central offices that serve multiple regions → Create ONE office with "All Regions"
              officesMap.set(officeId.toString(), {
                id: officeId,
                name: dept.Department || dept.name || `Office ${index + 1}`,
                code: dept.DepartmentCode || dept.code || `O${index + 1}`,
                region: 'All Regions',
                regionId: null,
                departmentId: dept._id
              });
            } else if (deptMappings.length > 1) {
              // Regional departments with multiple regional mappings → Create SEPARATE office for each region
              deptMappings.forEach((mapping, mappingIndex) => {
                const region = regions.find(r => r._id.toString() === mapping.regionId.toString());
                if (region) {
                  const regionName = region.Region || region.name || region.regionName;
                  const officeId = `${dept._id}_${mapping.regionId}`; // Create unique ID for each regional office

                  officesMap.set(officeId, {
                    id: officeId,
                    name: dept.Department,
                    code: dept.DepartmentCode || `${dept.Department.substring(0, 2)}${mappingIndex + 1}`,
                    region: regionName,
                    regionId: region._id,
                    departmentId: dept._id,
                    originalDepartmentId: dept._id // Keep reference to original department
                  });
                }
              });
            } else if (deptMappings.length === 1) {
              // Single region mapping → Create office for that specific region
              const mapping = deptMappings[0];
              const region = regions.find(r => r._id.toString() === mapping.regionId.toString());
              let regionName = null;
              let regionId = null;
              
              if (region) {
                regionName = region.Region || region.name || region.regionName;
                regionId = region._id;
              }

              officesMap.set(officeId.toString(), {
                id: officeId,
                name: dept.Department || dept.name || `Office ${index + 1}`,
                code: dept.DepartmentCode || dept.code || `O${index + 1}`,
                region: regionName,
                regionId: regionId,
                departmentId: dept._id
              });
            }
          });
        }

                // Convert divisions/sections to responsibility centers
                if (mappings && mappings.length > 0) {
                  // First, handle central offices specially
                  const centralOfficeDivisions = new Map();

                  mappings.forEach((mapping) => {
                    if (mapping.divisions && mapping.divisions.length > 0) {
                      // Check if this department is split by region
                      const dept = departments.find(d => d._id.toString() === mapping.departmentId.toString());
                      const deptMappings = mappings.filter(m => m.departmentId.toString() === mapping.departmentId.toString());
                      
                      let isCentralOffice = deptMappings.length > 1 && dept && (dept.displayOrder < 100);
                      const shouldSplitByRegion = deptMappings.length > 1 && !isCentralOffice;
                      
                      // For departments with multiple regions (except central offices), use composite officeId; otherwise use departmentId
                      let officeId = shouldSplitByRegion && mapping.regionId 
                        ? `${mapping.departmentId}_${mapping.regionId}` 
                        : mapping.departmentId;
                      let office = officesMap.get(officeId?.toString());

                      // Check if this is a central office
                      isCentralOffice = office && office.region === 'All Regions';

                      if (isCentralOffice) {
                        // For central offices, create provincial IMO entries based on region
                        const region = regions.find(r => r._id.toString() === mapping.regionId.toString());
                        const regionName = region ? region.Region : 'Unknown';
                        
                        // If office is not found, create a default office for this central department
                        let officeForRC = office;
                        if (!office || !office.name) {
                          const dept = departments.find(d => d._id.toString() === mapping.departmentId.toString());
                          if (dept) {
                            const defaultOfficeId = `${mapping.departmentId}`;
                            officeForRC = {
                              id: defaultOfficeId,
                              name: dept.Department || 'Central Office',
                              code: dept.DepartmentCode || 'CO',
                              region: 'All Regions',
                              regionId: null,
                              departmentId: mapping.departmentId
                            };
                            if (!officesMap.has(defaultOfficeId.toString())) {
                              officesMap.set(defaultOfficeId.toString(), officeForRC);
                            }
                            officeId = defaultOfficeId;
                            office = officeForRC;
                          }
                        }

                        // Define provincial IMOs for each region
                        const provincialIMOs = {
                          'REGION I': [
                            { name: 'ILOCOS NORTE IMO', sections: ['Administrative and Finance Section', 'Engineering, Operation and Maintenance Section'] },
                            { name: 'ILOCOS SUR IMO', sections: ['Operation Section', 'Engineering Section', 'Administrative and Finance Section'] },
                            { name: 'LA UNION IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operations Section'] },
                            { name: 'PANGASINAN IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation & Maintenance Section'] }
                          ],
                          'REGION II': [
                            { name: 'ISABELA IMO', sections: ['Engineering - Construction', 'Engineering - Planning and Design', 'Engineering - Operations', 'Engineering - Equipment', 'Engineering - Institutional Development', 'Administrative and Finance Section'] },
                            { name: 'QUIRINO IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] },
                            { name: 'NUEVA VIZCAYA IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] },
                            { name: 'CAGAYAN-BATANES IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] }
                          ],
                          'REGION III': [
                            { name: 'BATAAN-ZAMBALES IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] },
                            { name: 'PAMPANGA IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] },
                            { name: 'BULACAN-AURORA IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] },
                            { name: 'TARLAC IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] }
                          ],
                          'REGION IV-A': [
                            { name: 'LAGUNA-RIZAL IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] },
                            { name: 'BATANGAS IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] },
                            { name: 'QUEZON IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] },
                            { name: 'CAVITE IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] }
                          ],
                          'REGION IV-B': [
                            { name: 'MINDORO ORIENTAL-MARINDUQUE IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] },
                            { name: 'MINDORO OCCIDENTAL IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] },
                            { name: 'PALAWAN IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] },
                            { name: 'ROMBLON IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] }
                          ],
                          'REGION V': [
                            { name: 'CAMARINES SUR IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] },
                            { name: 'CAMARINES NORTE IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] },
                            { name: 'ALBAY-CATANDUANES IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] },
                            { name: 'SORSOGON-MASBATE IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] }
                          ],
                          'REGION VI': [
                            { name: 'ILOILO-GUIMARAS IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] },
                            { name: 'AKLAN-CAPIZ IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] },
                            { name: 'NEGROS OCCIDENTAL IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] },
                            { name: 'ANTIQUE IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] }
                          ],
                          'REGION VII': [
                            { name: 'BOHOL IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] },
                            { name: 'CEBU IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] },
                            { name: 'NEGROS ORIENTAL-SIQUIJOR IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] }
                          ],
                          'REGION VIII': [
                            { name: 'LEYTE-BILIRAN IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] },
                            { name: 'SAMAR-NORTHERN SAMAR IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] },
                            { name: 'EASTERN SAMAR IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] },
                            { name: 'SOUTHERN LEYTE IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] }
                          ],
                          'REGION IX': [
                            { name: 'ZAMBOANGA DEL SUR IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] },
                            { name: 'ZAMBOANGA DEL NORTE IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] },
                            { name: 'ZAMBOANGA-SIBUGAY IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] }
                          ],
                          'REGION X': [
                            { name: 'BUKIDNON IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] },
                            { name: 'LANAO DEL NORTE-MISAMIS OCCIDENTAL IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] },
                            { name: 'MISAMIS ORIENTAL-CAMIGUIN IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] }
                          ],
                          'REGION XI': [
                            { name: 'DAVAO DEL SUR-DAVAO OCCIDENTAL IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] },
                            { name: 'DAVAO DEL NORTE-DAVAO DE ORO IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] },
                            { name: 'DAVAO ORIENTAL IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] }
                          ],
                          'REGION XII': [
                            { name: 'SOUTH COTABATO-SARANGANI IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] },
                            { name: 'SULTAN KUDARAT IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] },
                            { name: 'NORTH COTABATO IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] }
                          ],
                          'CAR': [
                            { name: 'KALINGA-APAYAO IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] },
                            { name: 'MT. PROVINCE-IFUGAO IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] },
                            { name: 'ABRA-BENGUET IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] }
                          ],
                          'CARAGA': [
                            { name: 'AGUSAN DEL SUR IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] },
                            { name: 'AGUSAN DEL NORTE-SURIGAO DEL NORTE IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] },
                            { name: 'SURIGAO DEL SUR IMO', sections: ['Engineering Section', 'Administrative and Finance Section', 'Operation and Maintenance Section'] }
                          ]
                        };

                        const regionIMOs = provincialIMOs[regionName] || [];

                        regionIMOs.forEach((provincialIMO, imoIndex) => {
                          // Skip if office is not found (prevents "Unknown Office" entries)
                          if (!officeForRC || !officeForRC.name) {
                            return;
                          }

                          const rcId = `rc_${officeId}_${mapping.regionId}_${imoIndex}`;
                          const rcName = provincialIMO.name;

                          const rcData = {
                            id: rcId,
                            name: rcName,
                            code: `RC${imoIndex + 1}`,
                            officeId: officeId,
                            officeName: officeForRC.name,
                            region: regionName,
                            regionId: mapping.regionId,
                            departmentId: mapping.departmentId,
                            departmentName: mapping.departmentName,
                            provincialIMO: provincialIMO.name
                          };
                          
                          console.log('📍 Creating RC for central office (Provincial IMO):', {
                            rcName: rcData.name,
                            officeId: rcData.officeId,
                            officeName: rcData.officeName,
                            region: rcData.region,
                            isCentral: true
                          });
                          
                          responsibilityCentersMap.set(rcId, rcData);
                        });
                      } else {
                        // For regular offices, create responsibility centers as before
                        mapping.divisions.forEach((division, divIndex) => {
                          // If office is not found, create a default office for this department
                          let officeForRC = office;
                          if (!office || !office.name) {
                            // Create a default office for this department/region combination
                            const dept = departments.find(d => d._id.toString() === mapping.departmentId.toString());
                            if (dept) {
                              const defaultOfficeId = `${mapping.departmentId}`;
                              const defaultRegion = regions.find(r => r._id.toString() === mapping.regionId.toString());
                              const defaultRegionName = defaultRegion ? (defaultRegion.Region || defaultRegion.name) : null;
                              
                              officeForRC = {
                                id: defaultOfficeId,
                                name: dept.Department || `Office ${divIndex + 1}`,
                                code: dept.DepartmentCode || `O${divIndex + 1}`,
                                region: defaultRegionName,
                                regionId: mapping.regionId,
                                departmentId: mapping.departmentId
                              };
                              
                              // Add this office to the officesMap if it's not already there
                              if (!officesMap.has(defaultOfficeId.toString())) {
                                officesMap.set(defaultOfficeId.toString(), officeForRC);
                              }
                              officeId = defaultOfficeId;
                            } else {
                              // Skip if we can't create a default office
                              return;
                            }
                          }

                          const rcId = `rc_${mapping._id || mappingIndex}_${divIndex}`;

                          const rcData = {
                            id: rcId,
                            name: division.name || `Responsibility Center ${divIndex + 1}`,
                            code: division.code || `RC${divIndex + 1}`,
                            officeId: officeId,
                            officeName: officeForRC.name,
                            region: officeForRC.region,
                            regionId: officeForRC.regionId || null,
                            departmentId: mapping.departmentId,
                            departmentName: mapping.departmentName
                          };
                          
                          responsibilityCentersMap.set(rcId, rcData);
                        });
                      }
                    }
                  });
                }        // Don't create default offices and responsibility centers if no data exists
        // This prevents showing NCR entries when there's no actual data in the database
        // if (officesMap.size === 0) {
        //   // Create default offices based on NIA structure
        //   const defaultOffices = [
        //     { id: 'office_regional', name: 'Regional Office', code: 'RO', region: 'NCR' },
        //     { id: 'office_engineering', name: 'Engineering & Operations Division', code: 'EOD', region: 'NCR' },
        //     { id: 'office_admin', name: 'Administrative & Finance Division', code: 'AFD', region: 'NCR' },
        //     { id: 'office_imo', name: 'Irrigation Management Office', code: 'IMO', region: 'NCR' }
        //   ];

        //   defaultOffices.forEach(office => officesMap.set(office.id, office));

        //   // Create default responsibility centers based on NIA divisions (NOT sections)
        //   const defaultResponsibilityCenters = [
        //     { id: 'rc_construction', name: 'Construction Management Division', code: 'CMD', officeId: 'office_engineering', officeName: 'Engineering & Operations Division' },
        //     { id: 'rc_planning', name: 'Planning & Design Division', code: 'PDD', officeId: 'office_engineering', officeName: 'Engineering & Operations Division' },
        //     { id: 'rc_operations', name: 'Operations Division', code: 'OD', officeId: 'office_engineering', officeName: 'Engineering & Operations Division' },
        //     { id: 'rc_finance', name: 'Finance Division', code: 'FD', officeId: 'office_admin', officeName: 'Administrative & Finance Division' },
        //     { id: 'rc_admin', name: 'Administrative Division', code: 'AD', officeId: 'office_admin', officeName: 'Administrative & Finance Division' },
        //     { id: 'rc_institutional', name: 'Institutional Development Division', code: 'IDD', officeId: 'office_engineering', officeName: 'Engineering & Operations Division' },
        //     { id: 'rc_equipment', name: 'Equipment Management Division', code: 'EMD', officeId: 'office_engineering', officeName: 'Engineering & Operations Division' }
        //   ];

        //   defaultResponsibilityCenters.forEach(rc => responsibilityCentersMap.set(rc.id, rc));
        // }

        const formattedOffices = Array.from(officesMap.values());
        const formattedResponsibilityCenters = Array.from(responsibilityCentersMap.values());

        // Sort offices by displayOrder (central offices first, then regional)
        formattedOffices.sort((a, b) => {
          // Find displayOrder from departments
          const deptA = departments.find(d => d._id.toString() === a.departmentId?.toString());
          const deptB = departments.find(d => d._id.toString() === b.departmentId?.toString());
          
          const orderA = deptA?.displayOrder || 999;
          const orderB = deptB?.displayOrder || 999;
          
          // If orders are different, sort by order
          if (orderA !== orderB) {
            return orderA - orderB;
          }
          
          // If same order, sort by region then name
          const regionCompare = (a.region || '').localeCompare(b.region || '');
          if (regionCompare !== 0) return regionCompare;
          
          return a.name.localeCompare(b.name);
        });

        // Create region mapping for easy lookup
        const regionMapping = {};
        formattedOffices.forEach(office => {
          if (!regionMapping[office.region]) {
            regionMapping[office.region] = {
              regionName: office.region,
              regionId: office.regionId,
              offices: [],
              responsibilityCenters: []
            };
          }
          regionMapping[office.region].offices.push({
            id: office.id,
            name: office.name,
            code: office.code
          });
        });

        formattedResponsibilityCenters.forEach(rc => {
          const regionName = rc.region;
          if (regionMapping[regionName]) {
            regionMapping[regionName].responsibilityCenters.push({
              id: rc.id,
              name: rc.name,
              code: rc.code,
              officeId: rc.officeId,
              officeName: rc.officeName
            });
          }
        });

        const response = {
          hierarchy: 'Responsibility Center → Office',
          regions: Object.values(regionMapping),
          consolidationFlow: {
            'RESPONSIBILITY_CENTER': 'Proposals consolidate to Office level',
            'OFFICE': 'Proposals remain at Office level',
            'FULL': 'Can access all organizational levels',
            'OWN_ONLY': 'Access limited to own records only'
          },
          availableUnits: {
            offices: formattedOffices,
            responsibilityCenters: formattedResponsibilityCenters,
            officeResponsibilityCenterMappings: formattedResponsibilityCenters.reduce((mappings, rc) => {
              const officeId = rc.officeId;
              if (!mappings[officeId]) {
                mappings[officeId] = [];
              }
              mappings[officeId].push({
                id: rc.id,
                name: rc.name,
                code: rc.code
              });
              return mappings;
            }, {})
          },
          mappings: formattedOffices.map(office => ({
            officeId: office.id,
            officeName: office.name,
            region: office.region,
            regionId: office.regionId,
            responsibilityCenters: formattedResponsibilityCenters
              .filter(rc => rc.officeId === office.id)
              .map(rc => ({
                id: rc.id,
                name: rc.name,
                code: rc.code
              }))
          })),
          validationRules: {
            responsibilityCenter: 'Responsibility Center assignments require valid Office',
            office: 'Office assignments require valid Office',
            responsibilityCenterValidation: 'Responsibility Center must exist in selected Office'
          }
        };

        return res.status(200).json({
          success: true,
          message: 'New organization structure retrieved successfully',
          data: response
        });
      }

      // OLD STRUCTURE: Division → Department → Region (BACKWARD COMPATIBILITY)
      const mappingsCollection = mongoose.connection.db.collection('departmentdivisionmappings');
      const regionsCollection = mongoose.connection.db.collection('regions');
      const departmentsCollection = mongoose.connection.db.collection('departments');

      // Get all collections data
      const [mappings, regions, departments] = await Promise.all([
        mappingsCollection.find({}).toArray(),
        regionsCollection.find({}).toArray(),
        departmentsCollection.find({}).toArray()
      ]);

      // Format the data
      const formattedRegions = regions.map(region => ({
        id: region._id,
        name: region.Region || region.name || region.regionName,
        code: region.RegionCode || region.code || region.regionCode
      }));

      const formattedDepartments = departments.map(dept => {
        // Check if this department has subdivisions
        const hasSubDivisions = mappings.some(mapping =>
          mapping.departmentId.toString() === dept._id.toString() &&
          mapping.hasSubDivisions &&
          mapping.divisions &&
          mapping.divisions.length > 0
        );
        return {
          id: dept._id,
          name: dept.Department || dept.name || dept.departmentName,
          code: dept.DepartmentCode || dept.code || dept.departmentCode,
          hasSubDivisions
        };
      });

      const formattedMappings = mappings.map(mapping => ({
        departmentId: mapping.departmentId,
        departmentName: mapping.departmentName,
        divisions: mapping.divisions ? mapping.divisions.filter(div => div.isActive !== false).map(div => ({
          name: div.name,
          code: div.code,
          sections: div.sections ? div.sections.filter(section => section.isActive !== false) : []
        })) : [],
        hasSubDivisions: mapping.hasSubDivisions || false,
        regionId: mapping.regionId
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
