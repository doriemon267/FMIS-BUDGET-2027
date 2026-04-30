/**
 * Comment/Annotation Routes for Proposals
 */

const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const authMiddleware = require("../middleware/authMiddleware");
const { logDataModification } = require('../middleware/auditLogger');

// Apply authentication
router.use(authMiddleware);

// Get comments for a proposal
router.get('/proposals/:proposalId/comments', async (req, res) => {
  try {
    const { proposalId } = req.params;
    const comments = await Comment.find({ proposalId })
      .sort({ createdAt: -1 })
      .lean();
    
    res.json({
      success: true,
      data: comments,
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch comments',
      error: error.message,
    });
  }
});

// Add comment
router.post('/proposals/:proposalId/comments', logDataModification, async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { text, type = 'comment' } = req.body;
    const userId = req.user?.Id || req.user?.id;
    const userName = req.user?.FirstName || req.user?.name || 'Unknown User';

    const comment = await Comment.create({
      proposalId,
      userId,
      userName,
      text,
      type, // 'comment' or 'annotation'
    });

    res.json({
      success: true,
      data: comment,
    });
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create comment',
      error: error.message,
    });
  }
});

// Update comment
router.put('/proposals/:proposalId/comments/:commentId', logDataModification, async (req, res) => {
  try {
    const { proposalId, commentId } = req.params;
    const { text } = req.body;
    const userId = req.user?.Id || req.user?.id;

    const comment = await Comment.findOne({ _id: commentId, proposalId });
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    // Check permission
    if (comment.userId !== userId && !req.user?.Roles?.includes('SUPER ADMIN')) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to edit this comment',
      });
    }

    comment.text = text;
    comment.updatedAt = new Date();
    await comment.save();

    res.json({
      success: true,
      data: comment,
    });
  } catch (error) {
    console.error('Error updating comment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update comment',
      error: error.message,
    });
  }
});

// Delete comment
router.delete('/proposals/:proposalId/comments/:commentId', logDataModification, async (req, res) => {
  try {
    const { proposalId, commentId } = req.params;
    const userId = req.user?.Id || req.user?.id;

    const comment = await Comment.findOne({ _id: commentId, proposalId });
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    // Check permission
    if (comment.userId !== userId && !req.user?.Roles?.includes('SUPER ADMIN')) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this comment',
      });
    }

    await Comment.deleteOne({ _id: commentId });

    res.json({
      success: true,
      message: 'Comment deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete comment',
      error: error.message,
    });
  }
});

module.exports = router;
