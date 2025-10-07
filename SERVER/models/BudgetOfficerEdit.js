const mongoose = require('mongoose');

/**
 * Schema for storing Budget Officer edits to proposals
 * This stores the modified versions of Income, Personnel Services, MOOE, and Capital Outlay
 * before they are approved and merged back to the original collections
 */
const budgetOfficerEditSchema = new mongoose.Schema({
  // Reference to the original proposal
  proposalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Proposal',
    required: true
  },
  
  // Proposal identification fields
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
  department: String,
  division: String,
  processBy: {
    type: String,
    required: true
  },
  cobExpenditures: {
    type: String,
    required: true
  },
  
  // Status of the edit
  status: {
    type: String,
    enum: ['Draft', 'Submitted', 'Approved', 'Rejected'],
    default: 'Draft'
  },
  
  // Edited data for each expenditure type
  // These will store the modified records
  editedIncome: [{
    originalId: mongoose.Schema.Types.ObjectId,
    category: String,
    subcategory: String,
    amount: Number,
    description: String,
    // Track if this is a new entry, modified, or deleted
    changeType: {
      type: String,
      enum: ['added', 'modified', 'deleted', 'unchanged'],
      default: 'modified'
    },
    // Store original values for comparison
    originalValues: mongoose.Schema.Types.Mixed
  }],
  
  editedPersonnelServices: [{
    originalId: mongoose.Schema.Types.ObjectId,
    employeeNumber: String,
    employeeFullName: String,
    positionTitle: String,
    statusOfAppointment: String,
    monthlySalary: Number,
    annualSalary: Number,
    RATA: Number,
    PERA: Number,
    uniformALLOWANCE: Number,
    productivityIncentive: Number,
    medical: Number,
    childrenAllowance: Number,
    meal: Number,
    cashGift: Number,
    subsistenceAllowanceMDS: Number,
    subsistenceAllowanceST: Number,
    midyearBonus: Number,
    yearEndBonus: Number,
    gsisPremium: Number,
    philhealthPremium: Number,
    pagibigPremium: Number,
    employeeCompensation: Number,
    loyaltyAward: Number,
    overtimePay: Number,
    earnedLeaves: Number,
    retirementBenefits: Number,
    terminalLeave: Number,
    courtAppearance: Number,
    Total: Number,
    changeType: {
      type: String,
      enum: ['added', 'modified', 'deleted', 'unchanged'],
      default: 'modified'
    },
    originalValues: mongoose.Schema.Types.Mixed
  }],
  
  editedMOOE: [{
    originalId: mongoose.Schema.Types.ObjectId,
    uacsCode: String,
    description: String,
    amount: Number,
    income: Number,
    subsidy: Number,
    department: String,
    changeType: {
      type: String,
      enum: ['added', 'modified', 'deleted', 'unchanged'],
      default: 'modified'
    },
    originalValues: mongoose.Schema.Types.Mixed
  }],
  
  editedCapitalOutlay: [{
    originalId: mongoose.Schema.Types.ObjectId,
    particulars: String,
    quantity: Number,
    unitCost: Number,
    cost: Number,
    income: Number,
    subsidy: Number,
    department: String,
    changeType: {
      type: String,
      enum: ['added', 'modified', 'deleted', 'unchanged'],
      default: 'modified'
    },
    originalValues: mongoose.Schema.Types.Mixed
  }],
  
  // Budget Officer who made the edits
  editedBy: {
    userId: {
      type: String,
      required: true
    },
    userName: {
      type: String,
      required: true
    },
    email: String
  },
  
  // Comments from Budget Officer
  comments: String,
  
  // Approval information
  approvedBy: {
    userId: String,
    userName: String,
    email: String,
    date: Date,
    comments: String
  },
  
  // Rejection information
  rejectedBy: {
    userId: String,
    userName: String,
    email: String,
    date: Date,
    reason: String
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  submittedAt: Date,
  approvedAt: Date,
  rejectedAt: Date
}, {
  timestamps: true
});

// Indexes for efficient querying
budgetOfficerEditSchema.index({ proposalId: 1 });
budgetOfficerEditSchema.index({ fiscalYear: 1, budgetType: 1, region: 1 });
budgetOfficerEditSchema.index({ status: 1 });
budgetOfficerEditSchema.index({ 'editedBy.userId': 1 });

// Method to get summary of changes
budgetOfficerEditSchema.methods.getChangeSummary = function() {
  const summary = {
    income: {
      added: this.editedIncome.filter(i => i.changeType === 'added').length,
      modified: this.editedIncome.filter(i => i.changeType === 'modified').length,
      deleted: this.editedIncome.filter(i => i.changeType === 'deleted').length
    },
    personnelServices: {
      added: this.editedPersonnelServices.filter(i => i.changeType === 'added').length,
      modified: this.editedPersonnelServices.filter(i => i.changeType === 'modified').length,
      deleted: this.editedPersonnelServices.filter(i => i.changeType === 'deleted').length
    },
    mooe: {
      added: this.editedMOOE.filter(i => i.changeType === 'added').length,
      modified: this.editedMOOE.filter(i => i.changeType === 'modified').length,
      deleted: this.editedMOOE.filter(i => i.changeType === 'deleted').length
    },
    capitalOutlay: {
      added: this.editedCapitalOutlay.filter(i => i.changeType === 'added').length,
      modified: this.editedCapitalOutlay.filter(i => i.changeType === 'modified').length,
      deleted: this.editedCapitalOutlay.filter(i => i.changeType === 'deleted').length
    }
  };
  
  return summary;
};

module.exports = mongoose.model('BudgetOfficerEdit', budgetOfficerEditSchema);