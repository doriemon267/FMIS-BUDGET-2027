const express = require('express');
const router = express.Router();
const ProposalLockingService = require('../services/ProposalLockingService');
const authMiddleware = require('../middleware/is_auth');

/**
 * POST /api/proposals/:proposalId/lock
 * Acquire a lock on a proposal
 */
router.post('/:proposalId/lock', authMiddleware, async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { userId, userName, userRole, userEmail } = req.body;

    // Validate required fields
    if (!userId || !userName || !userRole) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, userName, userRole'
      });
    }

    const result = await ProposalLockingService.acquireLock(
      proposalId,
      userId,
      userName,
      userRole,
      userEmail || ''
    );

    if (!result.success) {
      if (result.error === 'Proposal not found') {
        return res.status(404).json(result);
      }
      return res.status(409).json(result); // 409 Conflict for actual locks
    }

    res.json(result);
  } catch (error) {
    console.error('Error in lock endpoint:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/proposals/:proposalId/lock
 * Release a lock on a proposal
 */
router.delete('/:proposalId/lock', authMiddleware, async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: userId'
      });
    }

    const result = await ProposalLockingService.releaseLock(proposalId, userId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error in unlock endpoint:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/proposals/:proposalId/lock/renew
 * Renew/extend lock expiry
 */
router.post('/:proposalId/lock/renew', authMiddleware, async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: userId'
      });
    }

    const result = await ProposalLockingService.renewLock(proposalId, userId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error in renew lock endpoint:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/proposals/:proposalId/lock/status
 * Get current lock status
 */
router.get('/:proposalId/lock/status', async (req, res) => {
  try {
    const { proposalId } = req.params;

    const result = await ProposalLockingService.getLockStatus(proposalId);

    if (result.success === false && result.error) {
      return res.status(404).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error in lock status endpoint:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/proposals/lock/cleanup
 * Admin endpoint to clean up expired locks
 */
router.post('/lock/cleanup', authMiddleware, async (req, res) => {
  try {
    // Optional: Add admin check here
    const result = await ProposalLockingService.cleanupExpiredLocks();

    res.json(result);
  } catch (error) {
    console.error('Error in cleanup endpoint:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/proposals/:proposalId/check-conflict
 * Check for version conflict
 */
router.post('/:proposalId/check-conflict', async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { currentVersion } = req.body;

    if (currentVersion === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: currentVersion'
      });
    }

    const result = await ProposalLockingService.checkVersionConflict(
      proposalId,
      currentVersion
    );

    res.json(result);
  } catch (error) {
    console.error('Error in conflict check endpoint:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
