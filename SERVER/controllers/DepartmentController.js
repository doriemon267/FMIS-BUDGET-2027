const Department = require('../models/Department');
const mongoose = require('mongoose');

exports.getAllDepartment = async (req, res) => {
  try {
    const { region } = req.query;

    if (region) {
      const Region = require('../models/Region');
      let regionDoc = null;
      if (typeof region === 'string' && mongoose.Types.ObjectId.isValid(region)) {
        try {
          if (String(new mongoose.Types.ObjectId(region)) === region) {
            regionDoc = await Region.findById(region);
          }
        } catch (_) { /* not a valid ObjectId string */ }
      }
      if (!regionDoc) {
        regionDoc = await Region.findOne({ Region: region });
      }

      if (!regionDoc) {
        return res.status(404).json({ error: 'Region not found' });
      }

      // Filter departments by region using OrganizationStructure
      const OrganizationStructure = require('../models/OrganizationStructure');
      const mappings = await OrganizationStructure.find({ 
        $or: [
          { regionId: regionDoc._id },
          { regionId: regionDoc._id.toString() }
        ]
      });

      // Get unique department IDs
      const departmentIds = [...new Set(mappings.map(mapping => mapping.departmentId))];

      // Fetch departments by IDs
      const departments = await Department.find({ _id: { $in: departmentIds } });
      res.status(200).json({departments});
    } else {
      // Return all departments if no region filter
      const departments = await Department.find();
      res.status(200).json({departments});
    }
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ error: 'An error occurred while fetching departments.' });
  }
};
// Get PositionTitle by ID
exports.getDepartmentById = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }
    res.status(200).json(department);
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while fetching the department.' });
  }
};
