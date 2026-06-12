const mongoose = require('mongoose');
const BudgetarySupportSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true,
    default: 0
  },
  description: {
    type: String,
    default: 'Operating Requirements'
  },
  fiscalYear: {
    type: String,
    required: true
  },
  budgetType: {
    type: String,
    required: true
  },
  processBy: {
    type: String,
    required: true
  },
  processDate: {
    type: Date,
    default: Date.now
  },
  region: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ["Submitted", "Not Submitted", "Approved", "Returned", "Draft"],
    default: "Not Submitted"
  },
  createdBy: {
    type: String,
    required: false
  },
  updatedBy: {
    type: String,
    required: false
  }
}, { 
  timestamps: true,
  strict: false
});
module.exports = mongoose.model('BudgetarySupport', BudgetarySupportSchema);