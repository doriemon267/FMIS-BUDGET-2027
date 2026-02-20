const mongoose = require('mongoose');

/**
 * Snapshot of the initial budget proposal as first received at BRD (Budget and Revenue Division).
 * Used to show "original vs revised" version history for Budget Officer and Budget Manager.
 * One snapshot per proposal, captured when the proposal first reaches BRD (e.g. Forwarded to Budget Planning Analyst / Officer).
 */
const proposalBudgetSnapshotSchema = new mongoose.Schema({
  proposalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Proposal',
    required: true,
    unique: true
  },
  capturedAt: {
    type: Date,
    default: Date.now
  },
  capturedWhen: {
    type: String,
    default: 'BRD_RECEIPT'
  },
  proposalStatusAtCapture: {
    type: String
  },
  proposalMeta: {
    fiscalYear: String,
    budgetType: String,
    region: String,
    processBy: String,
    title: String,
    department: String,
    division: String
  },
  snapshot: {
    income: { type: Array, default: [] },
    personnelServices: { type: Array, default: [] },
    mooe: { type: Array, default: [] },
    capitalOutlay: { type: Array, default: [] }
  },
  totals: {
    totalIncome: Number,
    totalPersonnel: Number,
    totalMOOE: Number,
    totalCapitalOutlay: Number
  }
}, {
  timestamps: true
});

proposalBudgetSnapshotSchema.index({ proposalId: 1 });

module.exports = mongoose.model('ProposalBudgetSnapshot', proposalBudgetSnapshotSchema);
