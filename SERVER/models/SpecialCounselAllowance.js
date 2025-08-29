const mongoose = require('mongoose');

const SpecialCounselAllowanceSchema = new mongoose.Schema({
  nameOfEmployee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PersonnelService',
    required: true,
  },
  positionTitle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PersonnelService',
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
});

module.exports = mongoose.model('specialCounselAllowance', SpecialCounselAllowanceSchema);