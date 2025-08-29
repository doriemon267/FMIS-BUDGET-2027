const mongoose = require('mongoose');

const DepartmentSchema = new mongoose.Schema({
  Department: {
    type: String,
    required: true,
  },
});

module.exports = mongoose.model('department', DepartmentSchema);