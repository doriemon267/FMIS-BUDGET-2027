const mongoose = require("mongoose");
const annexSchema = new mongoose.Schema({
  AnnexName: { type: String, required: true, unique: true, trim: true },
  description: { type: String }
});
module.exports = mongoose.model("Annex", annexSchema);