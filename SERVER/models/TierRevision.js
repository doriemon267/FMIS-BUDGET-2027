const mongoose = require('mongoose');

const TierRevisionItemSchema = new mongoose.Schema({
  lineItemId: { type: String, required: true },
  description: { type: String },
  category: { type: String, required: true, enum: ['Personnel', 'MOOE', 'Capital Outlay'] },
  tier1: { type: Number, default: 0 },
  tier2: { type: Number, default: 0 },
}, { _id: false });

const TierRevisionSchema = new mongoose.Schema({
  fiscalYear: { type: String, required: true },
  region: { type: String, required: true },
  department: { type: String, default: '' },
  division: { type: String, default: '' },
  version: { type: Number, required: true },
  comment: { type: String, default: '' },
  items: [TierRevisionItemSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdByName: { type: String, default: '' }, // display name when createdBy not in User collection (e.g. SSO)
}, {
  timestamps: true,
  strict: false,
});

TierRevisionSchema.index({ fiscalYear: 1, region: 1, department: 1, division: 1, version: -1 });
TierRevisionSchema.index({ fiscalYear: 1, region: 1, department: 1, division: 1 });

module.exports = mongoose.model('TierRevision', TierRevisionSchema);
