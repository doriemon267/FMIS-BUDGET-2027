const mongoose = require('mongoose');
const setupSchema = new mongoose.Schema({
  deadlines: [
    {
      fromDate: {
        type: Date,
        required: true
      },
      toDate: {
        type: Date,
        required: true
      },
      isFinished: {
        type: Boolean,
        default: false
      }
    }
  ],
  proposalType: {
    type: String,
    enum: ['Initial', 'NEP', 'GAA'],
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  currentYear: {
    type: Boolean,
    default: false
  }
});
module.exports = mongoose.model('Setup', setupSchema);