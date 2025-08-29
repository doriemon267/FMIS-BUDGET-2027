const mongoose = require('mongoose');

const SalaryGradeSchema = new mongoose.Schema({
  salary_grade: String,
  job_grade: String,
  steps: [Number],
  rates: { type: Map, of: Number }
});

module.exports = mongoose.model('SalaryGrade', SalaryGradeSchema);
