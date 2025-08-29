const mongoose = require('mongoose');

const RegionSchema = new mongoose.Schema({
  Region: {
    type: String,
    required: true,
  },
});

module.exports = mongoose.model('region', RegionSchema);