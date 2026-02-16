/**
 * User Preferences Model
 * 
 * Stores user-specific application preferences
 */

const mongoose = require('mongoose');

const userPreferencesSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    preferences: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient lookups
userPreferencesSchema.index({ userId: 1 });

module.exports = mongoose.model('UserPreferences', userPreferencesSchema);
