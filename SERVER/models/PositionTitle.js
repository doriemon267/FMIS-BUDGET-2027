const mongoose = require('mongoose');
const PositionTitleSchema = new mongoose.Schema({
  PositionTitle: {
    type: String,
    required: true,
  },
});
module.exports = mongoose.model('position_title', PositionTitleSchema);