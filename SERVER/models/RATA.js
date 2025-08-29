const mongoose = require("mongoose");

const RATASchema = new mongoose.Schema(
  {
    SG:   { type: String, required: true },
    RA:   { type: Number, required: true }, // Representation Allowance
    TA:   { type: Number, required: true }, // Transportation Allowance
    RATA: { type: Number, required: true }, // monthly rate (RA + TA)
  },
  { timestamps: true }
);

module.exports = mongoose.model("RATA", RATASchema);