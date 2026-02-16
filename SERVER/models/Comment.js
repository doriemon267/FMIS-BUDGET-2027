/**
 * Comment/Annotation Model
 */

const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    proposalId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'NewProposalWorkflow',
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    userName: {
      type: String,
      required: true,
    },
    text: {
      type: String,
      required: true,
      maxlength: 5000,
    },
    type: {
      type: String,
      enum: ['comment', 'annotation'],
      default: 'comment',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
commentSchema.index({ proposalId: 1, createdAt: -1 });
commentSchema.index({ userId: 1 });

module.exports = mongoose.model('Comment', commentSchema);
