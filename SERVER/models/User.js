const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UserSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  roles: [{
    type: String,
    required: true
  }],
  emailPreferences: {
    enabled: {
      type: Boolean,
      default: true
    },
    mutedProposals: [{
      type: String // proposal IDs that user doesn't want email notifications for
    }],
    notificationTypes: {
      workflow: { type: Boolean, default: true },
      security: { type: Boolean, default: true },
      system: { type: Boolean, default: false }
    }
  }
}, {
  timestamps: true
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Method to validate password
UserSchema.methods.isValidPassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', UserSchema);