const mongoose = require("mongoose");

const incomeCategoryGroupSchema = new mongoose.Schema({
  groupName: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    default: "",
  },
  fiscalYears: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Settings",  // Reference Settings collection since that's where fiscal years come from
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("IncomeCategoryGroup", incomeCategoryGroupSchema);