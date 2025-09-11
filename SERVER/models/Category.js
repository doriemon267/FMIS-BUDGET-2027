const mongoose = require("mongoose");
const categorySchema = new mongoose.Schema({
  categoryName: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  description: {
    type: String,
  },
  sublineItems: {
    type: [String], // ✅ Add this line
    default: [],
  },
});
module.exports = mongoose.model("Category", categorySchema);