const mongoose = require('mongoose');
const DepartmentSchema = new mongoose.Schema({
  Department: {
    type: String,
    required: true,
  },
  displayOrder: {
    type: Number,
    default: 999, // Default high number for non-central offices
  },
});
module.exports = mongoose.model('department', DepartmentSchema);