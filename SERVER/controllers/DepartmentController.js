const Department = require('../models/Department');
exports.getAllDepartment = async (req, res) => {
  try {
    const departments = await Department.find();
    res.status(200).json({departments});
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while fetching department.' });
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