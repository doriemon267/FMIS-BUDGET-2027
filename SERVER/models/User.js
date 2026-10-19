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
    required: false,
    unique: true,
    sparse: true
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
  photo: {
    type: String,
    default: null
  },
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
  },
  activeSessionId: {
    type: String,
    default: null
  },
  lastLoginIat: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Hash password before saving
UserSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// Method to validate password
UserSchema.methods.isValidPassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', UserSchema);
