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
      unique: true, // unique already creates an index; no need for index: true or schema.index()
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

module.exports = mongoose.model('UserPreferences', userPreferencesSchema);
