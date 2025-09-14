const SpecialCounselAllowance = require('../models/SpecialCounselAllowance');
exports.getAllSpecialCounselAllowances = async (req, res) => {
  try {
    let query = {};
    
    // Get filters from middleware - prioritize submission workflow filters over hardcoded logic
    const submissionWorkflowFilters = req.submissionWorkflowFilters || {};
    
    // Apply middleware filters if available (they include proper status filtering)
    if (Object.keys(submissionWorkflowFilters).length > 0) {
      // Use the filters from the submission workflow middleware
      if (submissionWorkflowFilters.$and || submissionWorkflowFilters.$or) {
        query = { ...query, ...submissionWorkflowFilters };
      } else {
        // Simple key-value filters
        Object.assign(query, submissionWorkflowFilters);
      }
    } else {
      // Fallback to hardcoded logic for backward compatibility
      if (req.user && req.user.assignment) {
        const userLevel = req.user.level;
        const userRegion = req.user.region;
        const userDepartment = req.user.department;
        const userDivision = req.user.division;

        let filterCriteria = {};

        if (userLevel === "Division") {
          filterCriteria.division = userDivision;
          filterCriteria.department = userDepartment;
          filterCriteria.region = userRegion;
        } else if (userLevel === "Department") {
          filterCriteria.department = userDepartment;
          filterCriteria.region = userRegion;
        } else if (userLevel === "Region") {
          filterCriteria.region = userRegion;
        }

        Object.assign(query, filterCriteria);
      }
    }
    const specialCounselAllowances = await SpecialCounselAllowance.find(query).populate('nameOfEmployee positionTitle');
    res.status(200).json({ specialCounselAllowances });
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while fetching special counsel allowances.' });
  }
};
// Get SpecialCounselAllowance by ID
exports.getSpecialCounselAllowanceById = async (req, res) => {
  try {
    const specialCounselAllowance = await SpecialCounselAllowance.findById(req.params.id).populate('nameOfEmployee positionTitle');
    if (!specialCounselAllowance) {
      return res.status(404).json({ error: 'Special Counsel Allowance not found' });
    }
    res.status(200).json(specialCounselAllowance);
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while fetching the special counsel allowance.' });
  }
};
// Create a new SpecialCounselAllowance
exports.createSpecialCounselAllowance = async (req, res) => {
  try {
    const newSpecialCounselAllowance = new SpecialCounselAllowance(req.body);
    const savedSpecialCounselAllowance = await newSpecialCounselAllowance.save();
    res.status(201).json(savedSpecialCounselAllowance);
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while creating the special counsel allowance.' });
  }
};
// Update a SpecialCounselAllowance by ID
exports.updateSpecialCounselAllowance = async (req, res) => {
  try {
    const updatedSpecialCounselAllowance = await SpecialCounselAllowance.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).populate('nameOfEmployee positionTitle');
    if (!updatedSpecialCounselAllowance) {
      return res.status(404).json({ error: 'Special Counsel Allowance not found' });
    }
    res.status(200).json(updatedSpecialCounselAllowance);
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while updating the special counsel allowance.' });
  }
};
// Delete a SpecialCounselAllowance by ID
exports.deleteSpecialCounselAllowance = async (req, res) => {
  try {
    const deletedSpecialCounselAllowance = await SpecialCounselAllowance.findByIdAndDelete(req.params.id);
    if (!deletedSpecialCounselAllowance) {
      return res.status(404).json({ error: 'Special Counsel Allowance not found' });
    }
    res.status(200).json({ message: 'Special Counsel Allowance deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while deleting the special counsel allowance.' });
  }
};