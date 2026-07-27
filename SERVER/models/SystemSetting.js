const mongoose = require("mongoose");

/**
 * SystemSetting Schema
 * Stores global system key-value configurations (e.g. maintenance_mode, system_announcements)
 */
const systemSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    description: {
      type: String,
      default: "",
    },
    updatedBy: {
      type: String,
      default: "SYSTEM",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SystemSetting", systemSettingSchema);
