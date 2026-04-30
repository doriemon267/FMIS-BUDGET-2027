const express = require('express');
const router = express.Router();
// Test endpoint to check organization structure without auth
router.get('/test-org-structure', async (req, res) => {
  try {
    const DepartmentDivisionMapping = require('../models/OrganizationStructure');
    // Test basic queries
    const mappingCount = await DepartmentDivisionMapping.countDocuments();
    if (mappingCount === 0) {
      return res.json({
        success: false,
        message: 'No department-division mappings found. Run setup script first.',
        data: { mappingCount: 0 }
      });
    }
    // Get complete organization structure
    const organizationStructure = await DepartmentDivisionMapping.getCompleteOrganizationStructure();
    // Get departments with divisions
    const departmentsWithDivisions = await DepartmentDivisionMapping.getDepartmentsWithDivisions();
    const response = {
      success: true,
      message: 'Organization structure retrieved successfully',
      data: {
        hierarchy: 'Division → Department → Region',
        availableUnits: {
          regions: organizationStructure.regions,
          departments: organizationStructure.departments,
          departmentsWithDivisions: departmentsWithDivisions,
        },
        stats: {
          totalMappings: mappingCount,
          regionsCount: organizationStructure.regions.length,
          departmentsCount: organizationStructure.departments.length,
          departmentsWithDivisionsCount: departmentsWithDivisions.length,
          totalDivisions: organizationStructure.departments.reduce((sum, dept) => sum + dept.divisions.length, 0)
        }
      }
    };
    res.json(response);
  } catch (error) {
    console.error('❌ Error testing organization structure:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving organization structure',
      error: error.message,
      stack: error.stack
    });
  }
});
module.exports = router;
