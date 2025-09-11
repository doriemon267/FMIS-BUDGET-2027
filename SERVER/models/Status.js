const mongoose = require("mongoose");
const StatusSchema = mongoose.Schema(
  {
    Status: {
      type: String,
      required: true,
    },
    description: String,
  },
  {
    timestamps: true,
  }
);
const Status = mongoose.model("Status", StatusSchema);
module.exports = Status;