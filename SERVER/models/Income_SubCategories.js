const mongoose = require('mongoose');

const IncomeSubCategoriesSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  category:{
    type:String,
    required:true
  }
});

module.exports = mongoose.model('income_subcategories', IncomeSubCategoriesSchema);