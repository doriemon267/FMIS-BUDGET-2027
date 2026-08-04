const mongoose = require('mongoose');
const PositionTitleSchema = new mongoose.Schema({
  PositionTitle: {
    type: String,
    required: true,
  },
  SG: {
    type: Number,
    required: false,
  },
  JG: {
    type: String,
    required: false,
  },
  PG: {
    type: String,
    required: false,
  },
});
module.exports = mongoose.model('position_title', PositionTitleSchema);