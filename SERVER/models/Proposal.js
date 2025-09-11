const mongoose = require('mongoose');
const proposalSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  fiscalYear: {
    type: String,
    required: true
  },
  budgetType: {
    type: String,
    required: true
  },
  region: {
    type: String,
    required: true
  },
  processBy: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['Draft', 'Submitted', 'Approved', 'Rejected'],
    default: 'Draft'
  },
  cobExpenditures: {
    type: String
  },
  totalExpenses: {
    type: Number,
    default: 0
  },
  totalIncome: {
    type: Number,
    default: 0
  },
  submittedDate: {
    type: Date
  },
  approvedDate: {
    type: Date
  },
  rejectedDate: {
    type: Date
  },
  rejectionReason: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });
module.exports = mongoose.model("Proposal", proposalSchema);