const { hasFullAccess } = require('./securityMiddleware');
const Region = require('../models/Region');
const Department = require('../models/Department');

// Middleware to handle Budget Manager organizational unit selection
const budgetManagerOrgSelection = () => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const userRoles = req.user.Roles;
      
      // Only apply to Budget Managers and Super Admins
      if (!hasFullAccess(userRoles)) {
        return next();
      }
      
      // Extract organizational selection from request
      const { region, department, division } = req.body;
      const queryRegion = req.query.region;
      const queryDepartment = req.query.department;
      const queryDivision = req.query.division;
      
      const selectedRegion = region || queryRegion;
      const selectedDepartment = department || queryDepartment;
      const selectedDivision = division || queryDivision;
      
      // Validate selected organizational units exist
      if (selectedRegion) {
        const regionExists = await Region.findOne({ Region: selectedRegion });
        if (!regionExists) {
          return res.status(400).json({ 
            message: `Region '${selectedRegion}' does not exist` 
          });
        }
      }
      
      if (selectedDepartment) {
        const departmentExists = await Department.findOne({ Department: selectedDepartment });
        if (!departmentExists) {
          return res.status(400).json({ 
            message: `Department '${selectedDepartment}' does not exist` 
          });
        }
      }
      
      // Add organizational context to request
      req.budgetManagerContext = {
        selectedRegion,
        selectedDepartment,
        selectedDivision,
        selectedBy: userId,
        selectedByRole: userRoles,
        selectionTimestamp: new Date(),
        canSelectAnyOrg: true
      };
      
      // For POST/PUT operations, ensure the organizational data is set in the body
      if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        if (selectedRegion && !req.body.region) {
          req.body.region = selectedRegion;
        }
        if (selectedDepartment && !req.body.department) {
          req.body.department = selectedDepartment;
        }
        if (selectedDivision && !req.body.division) {
          req.body.division = selectedDivision;
        }
        
        // Add processBy information
        req.body.processBy = req.body.processBy || userId;
        req.body.processDate = req.body.processDate || new Date();
      }
      
      next();
    } catch (error) {
      console.error('Error in budget manager org selection:', error);
      return res.status(500).json({ message: 'Server error' });
    }
  };
};

// Middleware to get available organizational units for Budget Manager selection
const getAvailableOrgUnits = async (req, res, next) => {
  try {
    const userRoles = req.user.Roles;
    
    // Only provide options to Budget Managers and Super Admins
    if (!hasFullAccess(userRoles)) {
      return res.status(403).json({ 
        message: "Access denied. Budget Manager privileges required." 
      });
    }
    
    // Get all available organizational units
    const regions = await Region.find({}).select('Region').lean();
    const departments = await Department.find({}).select('Department').lean();
    
    // For divisions, we'll get unique values from existing records
    // This is a placeholder - you can enhance this based on your division model
    const divisions = [
      'Administrative Division',
      'Finance Division', 
      'Operations Division',
      'Planning Division',
      'Engineering Division'
    ];
    
    const availableOrgUnits = {
      regions: regions.map(r => r.Region),
      departments: departments.map(d => d.Department),
      divisions: divisions,
      message: "Budget Manager can select any organizational unit for transactions"
    };
    
    // Add to request for use in controllers
    req.availableOrgUnits = availableOrgUnits;
    
    next();
  } catch (error) {
    console.error('Error getting available org units:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Middleware to log Budget Manager organizational selections for audit
const logOrgSelection = () => {
  return (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Log the organizational selection if Budget Manager context exists
      if (req.budgetManagerContext) {
        console.log('🏢 Budget Manager Organizational Selection:', {
          userId: req.budgetManagerContext.selectedBy,
          userRole: req.budgetManagerContext.selectedByRole,
          selectedRegion: req.budgetManagerContext.selectedRegion,
          selectedDepartment: req.budgetManagerContext.selectedDepartment,
          selectedDivision: req.budgetManagerContext.selectedDivision,
          operation: `${req.method} ${req.path}`,
          timestamp: req.budgetManagerContext.selectionTimestamp,
          success: res.statusCode < 400
        });
      }
      
      originalSend.call(this, data);
    };
    
    next();
  };
};

// Helper function to validate organizational unit selection
const validateOrgSelection = (requiredFields = []) => {
  return (req, res, next) => {
    const { region, department, division } = req.body;
    const queryRegion = req.query.region;
    const queryDepartment = req.query.department;
    const queryDivision = req.query.division;
    
    const selectedRegion = region || queryRegion;
    const selectedDepartment = department || queryDepartment;
    const selectedDivision = division || queryDivision;
    
    // Check if required organizational fields are provided
    const missingFields = [];
    
    if (requiredFields.includes('region') && !selectedRegion) {
      missingFields.push('region');
    }
    if (requiredFields.includes('department') && !selectedDepartment) {
      missingFields.push('department');
    }
    if (requiredFields.includes('division') && !selectedDivision) {
      missingFields.push('division');
    }
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        message: `Missing required organizational fields: ${missingFields.join(', ')}`,
        hint: "Budget Managers must specify organizational unit for transactions"
      });
    }
    
    next();
  };
};

module.exports = {
  budgetManagerOrgSelection,
  getAvailableOrgUnits,
  logOrgSelection,
  validateOrgSelection
};
