const Personnel = require('../models/Personnel');
// Get all personnel
const getAllPersonnel = async (req, res) => {
  try {
    const personnel = await Personnel.find();
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