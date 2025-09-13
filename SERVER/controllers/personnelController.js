const Personnel = require('../models/Personnel');
// Get all personnel
const getAllPersonnel = async (req, res) => {
  try {
    // Get filters from middleware - prioritize submission workflow filters over hierarchical filters
    const submissionWorkflowFilters = req.submissionWorkflowFilters || {};
    const hierarchicalFilters = req.hierarchicalFilters || {};
    
    // Use submission workflow filters if available (they include status filtering), otherwise use hierarchical filters
    const activeFilters = Object.keys(submissionWorkflowFilters).length > 0 ? submissionWorkflowFilters : hierarchicalFilters;
    
    // Map filters to database field names
    const mapFiltersToDb = (filters) => {
      const mapped = {};

      // Handle $and conditions from middleware
      if (filters.$and && Array.isArray(filters.$and)) {
        mapped.$and = filters.$and.map(condition => {
          const conditionMapped = {};
          if (condition.region) conditionMapped.region = condition.region;
          if (condition.department) conditionMapped.department = condition.department;
          if (condition.division) conditionMapped.division = condition.division;
          if (condition.status) conditionMapped.status = condition.status;
          return conditionMapped;
        });
        return mapped;
      }

      // Handle simple key-value filters
      if (filters.region) mapped.region = filters.region;
      if (filters.department) mapped.department = filters.department;
      if (filters.division) mapped.division = filters.division;
      if (filters.status) mapped.status = filters.status;
      return mapped;
    };
    
    const dbFilters = mapFiltersToDb(activeFilters);
    
    // Apply filters to the query
    let query = {};
    if (Object.keys(dbFilters).length > 0) {
      query = dbFilters;
    }
    
    const personnel = await Personnel.find(query);
    res.json(personnel);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
// Add new personnel
const addPersonnel = async (req, res) => {
  const personnel = new Personnel({
    name: req.body.name,
    position: req.body.position,
    salary: req.body.salary,
  });
  try {
    const newPersonnel = await personnel.save();
    res.status(201).json(newPersonnel);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
module.exports = {
  getAllPersonnel,
  addPersonnel,
};