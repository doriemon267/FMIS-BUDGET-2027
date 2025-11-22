const mongoose = require('mongoose');
const SalaryGradeSchema = new mongoose.Schema({
  salary_grade: {
    type: String,
    required: true
  },
  job_grade: {
    type: String,
    required: true
  },
  steps: [Number],
  rates: { type: Map, of: Number },

  // CPSC Template linking
  cpscTemplate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CPSCTemplate',
    required: true
  },
  templateName: {
    type: String,
    enum: ['CPSC 1', 'CPSC 2', 'CPSC 3', 'CPSC 4', 'CPSC 5'],
    default: 'CPSC 1'
  },
  fiscalYear: {
    type: Number,
    required: true
  },
  budgetType: {
    type: String,
    required: true,
    enum: ['Initial', 'NEP', 'GAA'] // Initial Budget, New Economic Policy, General Appropriations Act
  },

  // Metadata
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index for efficient querying
SalaryGradeSchema.index({ cpscTemplate: 1, salary_grade: 1 });
SalaryGradeSchema.index({ fiscalYear: 1, budgetType: 1, templateName: 1 });

// Update the updatedAt field before saving
SalaryGradeSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('SalaryGrade', SalaryGradeSchema);
