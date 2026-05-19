const Proposal = require('../models/Proposal');

class ProposalLockingService {
  /**
   * Acquire a lock on a proposal for editing
   */
  static async acquireLock(proposalId, userId, userName, userRole, userEmail) {
    try {
      // First, check if there's an existing lock
      const proposal = await Proposal.findById(proposalId);
      
      if (!proposal) {
        return { success: false, error: 'Proposal not found' };
      }

      // If locked and lock hasn't expired, check if it's the same user
      if (proposal.isLocked && proposal.lockExpiry) {
        if (new Date() < proposal.lockExpiry) {
          // Lock is still valid
          if (proposal.lockedBy.userId !== userId) {
            return {
              success: false,
              error: `Proposal is currently being edited by ${proposal.lockedBy.userName} (${proposal.lockedBy.userRole})`,
              lockedBy: proposal.lockedBy,
              lockedAt: proposal.lockedAt
            };
          }
          // Same user trying to renew lock - allow it
        } else {
          // Lock has expired, remove it
          proposal.isLocked = false;
          proposal.lockedBy = null;
          proposal.lockedAt = null;
          proposal.lockExpiry = null;
        }
      }

      // Acquire the lock
      const now = new Date();
      const lockDuration = proposal.lockTimeout || 900000; // 15 minutes default
      
      proposal.isLocked = true;
      proposal.lockedBy = {
        userId,
        userName,
        userRole,
        userEmail
      };
      proposal.lockedAt = now;
      proposal.lockExpiry = new Date(now.getTime() + lockDuration);

      await proposal.save();

      return {
        success: true,
        message: 'Lock acquired successfully',
        lockExpiry: proposal.lockExpiry,
        lockTimeout: lockDuration
      };
    } catch (error) {
      console.error('Error acquiring lock:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Release a lock on a proposal
   */
  static async releaseLock(proposalId, userId) {
    try {
      const proposal = await Proposal.findById(proposalId);

      if (!proposal) {
        return { success: false, error: 'Proposal not found' };
      }

      // Only the user who locked it can unlock it
      if (proposal.isLocked && proposal.lockedBy.userId !== userId) {
        return {
          success: false,
          error: 'You do not have permission to release this lock'
        };
      }

      proposal.isLocked = false;
      proposal.lockedBy = null;
      proposal.lockedAt = null;
      proposal.lockExpiry = null;

      await proposal.save();

      return { success: true, message: 'Lock released successfully' };
    } catch (error) {
      console.error('Error releasing lock:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Renew/extend lock expiry time
   */
  static async renewLock(proposalId, userId) {
    try {
      const proposal = await Proposal.findById(proposalId);

      if (!proposal) {
        return { success: false, error: 'Proposal not found' };
      }

      if (!proposal.isLocked || proposal.lockedBy.userId !== userId) {
        return { success: false, error: 'No active lock for this user' };
      }

      const now = new Date();
      const lockDuration = proposal.lockTimeout || 900000;
      proposal.lockExpiry = new Date(now.getTime() + lockDuration);

      await proposal.save();

      return {
        success: true,
        message: 'Lock renewed successfully',
        lockExpiry: proposal.lockExpiry
      };
    } catch (error) {
      console.error('Error renewing lock:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get lock status of a proposal
   */
  static async getLockStatus(proposalId) {
    try {
      const proposal = await Proposal.findById(proposalId).select(
        'isLocked lockedBy lockedAt lockExpiry'
      );

      if (!proposal) {
        return { success: false, error: 'Proposal not found' };
      }

      // Check if lock has expired
      if (proposal.isLocked && proposal.lockExpiry) {
        if (new Date() >= proposal.lockExpiry) {
          // Lock expired, clean it up
          proposal.isLocked = false;
          proposal.lockedBy = null;
          proposal.lockedAt = null;
          proposal.lockExpiry = null;
          await proposal.save();

          return {
            isLocked: false,
            message: 'Previous lock has expired'
          };
        }
      }

      return {
        isLocked: proposal.isLocked,
        lockedBy: proposal.isLocked ? proposal.lockedBy : null,
        lockedAt: proposal.isLocked ? proposal.lockedAt : null,
        lockExpiry: proposal.isLocked ? proposal.lockExpiry : null,
        timeRemaining: proposal.isLocked ? proposal.lockExpiry - new Date() : null
      };
    } catch (error) {
      console.error('Error getting lock status:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clean up expired locks (background task)
   */
  static async cleanupExpiredLocks() {
    try {
      const now = new Date();
      const result = await Proposal.updateMany(
        {
          isLocked: true,
          lockExpiry: { $lt: now }
        },
        {
          isLocked: false,
          lockedBy: null,
          lockedAt: null,
          lockExpiry: null
        }
      );

      console.log(`Cleaned up ${result.modifiedCount} expired locks`);
      return { success: true, cleanedCount: result.modifiedCount };
    } catch (error) {
      console.error('Error cleaning up expired locks:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check for version conflict (optimistic locking)
   */
  static async checkVersionConflict(proposalId, currentVersion) {
    try {
      const proposal = await Proposal.findById(proposalId).select('__v');

      if (!proposal) {
        return { conflict: false, reason: 'Proposal not found' };
      }

      if (proposal.__v !== currentVersion) {
        return {
          conflict: true,
          currentVersion: proposal.__v,
          clientVersion: currentVersion,
          reason: 'Version mismatch detected - proposal has been modified by another user'
        };
      }

      return { conflict: false };
    } catch (error) {
      console.error('Error checking version conflict:', error);
      return { conflict: false, error: error.message };
    }
  }
}

module.exports = ProposalLockingService;
