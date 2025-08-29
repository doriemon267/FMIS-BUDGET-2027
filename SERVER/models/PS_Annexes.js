const mongoose = require("mongoose");

const PS_AnnexesSchema = new mongoose.Schema(
  {
    employeeFullName: { type: String, required: true },
    positionTitle: { type: String, required: true },
    Department: { type: String },
    Division: { type: String },
    Amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["Submitted", "Not Submitted"],
      default: "Not Submitted"
    },
    region: { type: String, required: true },
    processBy: { type: String, required: true },
    processDate: { type: Date, required: true },
    fiscalYear: { type: String, required: true },

    // annexes: {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: "Annexes",
    //     required: true,
    //   },


  },
  { timestamps: true }
);

module.exports = mongoose.model("PS_Annexes", PS_AnnexesSchema);