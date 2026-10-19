const mongoose = require('mongoose');

const CPSCTemplateSchema = new mongoose.Schema({
  templateName: {
    type: String,
    required: true,
    enum: ['CPSC 1', 'CPSC 2', 'CPSC 3', 'CPSC 4', 'CPSC 5'], // Standard CPSC templates
    default: 'CPSC 1'
  },
  templateCode: {
    type: String,
    required: true,
    unique: true // e.g., 'CPSC1_2025_PS' for CPSC 1, 2025, PS budget type
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
  description: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  salaryGrades: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SalaryGrade'
  }],
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

// Compound index to ensure unique combination of template, fiscal year, and budget type
CPSCTemplateSchema.index({ templateName: 1, fiscalYear: 1, budgetType: 1 }, { unique: true });

// Update the updatedAt field before saving
CPSCTemplateSchema.pre('save', function() {
  this.updatedAt = Date.now();
  // Generate template code if not provided
  if (!this.templateCode) {
    const templateNum = this.templateName.replace('CPSC ', '');
    this.templateCode = `CPSC${templateNum}_${this.fiscalYear}_${this.budgetType}`;
  }
});

module.exports = mongoose.model('CPSCTemplate', CPSCTemplateSchema);