const mongoose = require('mongoose');
const fiscalYearSchema = new mongoose.Schema({
  year: {
    type: String,
    required: true,
    validate: {
      validator: function (value) {
        // Validate format "FY-YYYY"
        return /^FY-\d{4}$/.test(value);
      },
      message: (props) => `${props.value} is not a valid fiscal year format!`,
    },
  },
  budgetType: {
    type: String,
    required: true,
    enum: ["Initial", "NEP", "GAA"], // adjust as needed
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
});
fiscalYearSchema.index({ year: 1, budgetType: 1 }, { unique: true });
const FiscalYear = mongoose.model('FiscalYear', fiscalYearSchema);
module.exports = FiscalYear;