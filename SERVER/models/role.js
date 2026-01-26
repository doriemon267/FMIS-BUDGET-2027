const mongoose = require("mongoose");

const roleSchema = mongoose.Schema({
  name: {
    type: String,
    unique: true,
  },
  label: {
    type: String,
    required: true,
  },
  enabled: {
    type: Boolean,
    default: true,
  },
  permission: {
    type: String,
    nullable: true,
  },
});

module.exports = mongoose.model("Role", roleSchema);
