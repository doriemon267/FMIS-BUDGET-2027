const OrganizationStructure = require('../models/OrganizationStructure');
const mongoose = require('mongoose');

// Get all mappings with populated region and department
exports.getMappings = async (req, res) => {
  try {
    const mappings = await OrganizationStructure.find()
      .populate('regionId', 'Region RegionCode Code')
      .populate('departmentId', 'Department DepartmentCode Code');
    
    res.status(200).json(mappings);
  } catch (error) {
    console.error('Error fetching organization structure mappings:', error);
    res.status(500).json({ error: 'An error occurred while fetching mappings.' });
  }
};

// Get a single mapping by region and department
exports.getMappingByRegionAndDepartment = async (req, res) => {
  try {
    const { regionId, departmentId } = req.query;
    
    if (!regionId || !departmentId) {
      return res.status(400).json({ error: 'regionId and departmentId are required' });
    }

    const mapping = await OrganizationStructure.findOne({ regionId, departmentId })
      .populate('regionId', 'Region RegionCode Code')
      .populate('departmentId', 'Department DepartmentCode Code');

    if (!mapping) {
      return res.status(404).json({ message: 'Mapping not found' });
    }

    res.status(200).json(mapping);
  } catch (error) {
    console.error('Error fetching mapping:', error);
    res.status(500).json({ error: 'An error occurred while fetching the mapping.' });
  }
};

// Create or update a mapping
exports.saveMapping = async (req, res) => {
  try {
    const { regionId, departmentId, departmentName, divisions, hasSubDivisions } = req.body;

    if (!departmentId || !departmentName) {
      return res.status(400).json({ error: 'departmentId and departmentName are required' });
    }

    // Prepare mapping data
    const mappingData = {
      departmentId,
      departmentName,
      divisions: divisions || [],
      hasSubDivisions: hasSubDivisions !== undefined ? hasSubDivisions : (divisions && divisions.length > 0),
      regionId: regionId || null,
      updatedAt: Date.now()
    };

    // Upsert the mapping based on regionId and departmentId
    const query = regionId ? { regionId, departmentId } : { departmentId, regionId: { $exists: false } };
    
    const updatedMapping = await OrganizationStructure.findOneAndUpdate(
      query,
      { $set: mappingData },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json(updatedMapping);
  } catch (error) {
    console.error('Error saving mapping:', error);
    res.status(500).json({ error: 'An error occurred while saving the mapping.' });
  }
};

// Delete a mapping
exports.deleteMapping = async (req, res) => {
  try {
    const deletedMapping = await OrganizationStructure.findByIdAndDelete(req.params.id);
    if (!deletedMapping) {
      return res.status(404).json({ error: 'Mapping not found' });
    }
    res.status(200).json({ message: 'Mapping deleted successfully' });
  } catch (error) {
    console.error('Error deleting mapping:', error);
    res.status(500).json({ error: 'An error occurred while deleting the mapping.' });
  }
};
