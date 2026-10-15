const mongoose = require('mongoose');
const IncomeCategoriesSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
});
module.exports = mongoose.model('income_categories', IncomeCategoriesSchema);