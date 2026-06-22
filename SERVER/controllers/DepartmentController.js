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

      const regionName = (regionDoc.Region || regionDoc.regionName || regionDoc.RegionName || '').trim().toUpperCase();
      const regionParam = (typeof region === 'string' ? region : '').trim().toUpperCase();
      const excludeROandIMO = regionName === 'CENTRAL OFFICE' || regionName === 'MARIIS' || regionName === 'UPRIIS' ||
        regionParam === 'CENTRAL OFFICE' || regionParam === 'MARIIS' || regionParam === 'UPRIIS';

      let departments;

      if (excludeROandIMO) {
        // Central Office: get ALL departments and exclude REGIONAL OFFICE and IMO (these are regional-only)
        const all = await Department.find({}).lean();
        departments = all.filter(d => {
          const name = (d.Department || d.name || d.departmentName || '').trim().toUpperCase();
          return name !== 'REGIONAL OFFICE' && name !== 'IRRIGATION MANAGEMENT OFFICE';
        });
        // Fallback: if departments collection is empty, get from departmentdivisionmappings (regionId for Central Office)
        if (departments.length === 0) {
          try {
            const mongooseConn = mongoose.connection;
            if (mongooseConn && mongooseConn.db) {
              const mappingsCol = mongooseConn.db.collection('departmentdivisionmappings');
              const regionsCol = mongooseConn.db.collection('regions');
              const coRegion = await regionsCol.findOne({
                $or: [
                  { Region: { $regex: /^central\s*office$/i } },
                  { Region: 'CENTRAL OFFICE' },
                  { Region: 'Central Office' }
                ]
              });
              if (coRegion) {
                const coMappings = await mappingsCol.find({ regionIds: coRegion._id }).toArray();
                const seen = new Set();
                const exclude = ['REGIONAL OFFICE', 'IRRIGATION MANAGEMENT OFFICE'];
                const fromMappings = coMappings
                  .filter(m => {
                    const name = (m.departmentName || '').trim().toUpperCase();
                    return name && !exclude.includes(name) && !seen.has(String(m.departmentId));
                  })
                  .map(m => {
                    seen.add(String(m.departmentId));
                    return { _id: m.departmentId, Department: m.departmentName || '' };
                  });
                if (fromMappings.length > 0) departments = fromMappings;
              }
            }
          } catch (err) {
            console.error('[DepartmentController] Central Office mappings fallback error:', err.message);
          }
        }
      } else {
        const OrganizationStructure = require('../models/OrganizationStructure');
        const mappings = await OrganizationStructure.find({
          regionIds: { $in: [regionDoc._id, regionDoc._id.toString()] }
        });
        const departmentIds = [...new Set(mappings.map(m => m.departmentId && m.departmentId.toString()).filter(Boolean))];
        if (departmentIds.length > 0) {
          const objectIds = departmentIds.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));
          if (objectIds.length > 0) {
            departments = await Department.find({ _id: { $in: objectIds } });
          } else {
            departments = [];
          }
        } else {
          departments = [];
        }
      }

      res.status(200).json({ departments });
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

// Create a new Department
exports.createDepartment = async (req, res) => {
  try {
    const newDepartment = new Department(req.body);
    const savedDepartment = await newDepartment.save();
    res.status(201).json(savedDepartment);
  } catch (error) {
    console.error('Error creating department:', error);
    res.status(500).json({ error: 'An error occurred while creating the department.' });
  }
};

// Update a Department by ID
exports.updateDepartment = async (req, res) => {
  try {
    const updatedDepartment = await Department.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!updatedDepartment) {
      return res.status(404).json({ error: 'Department not found' });
    }
    res.status(200).json(updatedDepartment);
  } catch (error) {
    console.error('Error updating department:', error);
    res.status(500).json({ error: 'An error occurred while updating the department.' });
  }
};

// Delete a Department by ID
exports.deleteDepartment = async (req, res) => {
  try {
    const deletedDepartment = await Department.findByIdAndDelete(req.params.id);
    if (!deletedDepartment) {
      return res.status(404).json({ error: 'Department not found' });
    }
    res.status(200).json({ message: 'Department deleted successfully' });
  } catch (error) {
    console.error('Error deleting department:', error);
    res.status(500).json({ error: 'An error occurred while deleting the department.' });
  }
};
