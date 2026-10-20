const OrganizationStructure = require('../models/OrganizationStructure');
const mongoose = require('mongoose');

// Get all mappings with populated region and department
exports.getMappings = async (req, res) => {
  try {
    const mappings = await OrganizationStructure.find()
      .populate('regionId', 'Region RegionCode Code')
      .populate('regionIds', 'Region RegionCode Code')
      .populate('departmentId', 'Department DepartmentCode Code');
    
    // Fallback: If regionIds is empty but regionId exists, inject it into regionIds
    const normalizedMappings = mappings.map(m => {
      const doc = m.toObject();
      if ((!doc.regionIds || doc.regionIds.length === 0) && doc.regionId) {
        doc.regionIds = [doc.regionId];
      }
      return doc;
    });

    res.status(200).json(normalizedMappings);
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

    const mapping = await OrganizationStructure.findOne({ regionIds: regionId, departmentId })
      .populate('regionIds', 'Region RegionCode Code')
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
    const { regionIds, departmentId, departmentName, divisions, hasSubDivisions } = req.body;

    if (!departmentId || !departmentName) {
      return res.status(400).json({ error: 'departmentId and departmentName are required' });
    }

    // Prepare mapping data
    const mappingData = {
      departmentId,
      departmentName,
      divisions: divisions || [],
      hasSubDivisions: hasSubDivisions !== undefined ? hasSubDivisions : (divisions && divisions.length > 0),
      regionIds: regionIds && Array.isArray(regionIds) ? regionIds : (req.body.regionId ? [req.body.regionId] : []),
      updatedAt: Date.now()
    };

    let updatedMapping;
    if (req.body._id) {
       // If frontend passes _id, use it directly
       updatedMapping = await OrganizationStructure.findByIdAndUpdate(
         req.body._id,
         { $set: mappingData },
         { new: true, runValidators: true }
       );
    } else {
       // Fallback for creation if no _id is present (though we should ideally always have it on edit)
       // We'll upsert by departmentId to ensure uniqueness for now, or just create it
       updatedMapping = await OrganizationStructure.findOneAndUpdate(
         { departmentId },
         { $set: mappingData },
         { new: true, upsert: true, runValidators: true }
       );
    }

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
