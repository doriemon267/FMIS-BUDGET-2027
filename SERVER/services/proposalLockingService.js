// Use NewProposalWorkflow - the active model used by the new proposal system
// The frontend stores the NewProposalWorkflow._id in sessionStorage as "activeWorkflowRef"
const NewProposalWorkflow = require('../models/NewProposalWorkflow');
const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
const Department = require('../models/Department');
const Region = require('../models/Region');

class ProposalLockingService {
  /**
   * Helper: Get user's organizational scope (region, department, division) from their assignment
   * Returns an object with the scope levels the user has access to
   */
  static async getUserOrgScope(userId) {
    try {
      const assignment = await HierarchicalUserAssignment.findOne({ userId })
        .populate('regionId', 'regionName Region')
        .populate('departmentId', 'Department departmentName');

      if (!assignment) {
        return { isUnrestricted: true }; // No assignment = no scope restrictions
      }

      const scope = { isUnrestricted: false };

      // Extract region from assignment
      if (assignment.regionId) {
        const regionName = assignment.regionId.regionName || assignment.regionId.Region;
        if (regionName) scope.region = regionName;
        scope.regionId = assignment.regionId._id.toString();
      }

      // Extract department from assignment
      if (assignment.departmentId) {
        const deptName = assignment.departmentId.Department || assignment.departmentId.departmentName;
        if (deptName) scope.department = deptName;
      }

      // Extract division from assignment
      if (assignment.divisionName) {
        scope.division = assignment.divisionName;
      }

      return scope;
    } catch (error) {
      console.error('Error getting user org scope:', error.message);
      return {};
    }
  }

  /**
   * Helper: Check if two organizational scopes have overlap
   * Returns true only if both users can access the same proposal
   */
  static scopesOverlap(scope1, scope2) {
    if (!scope1 || !scope2) return true; // No restrictions = overlap
    
    // If both are unrestricted, they overlap with each other
    if (scope1.isUnrestricted && scope2.isUnrestricted) return true;
    
    // If one is unrestricted and the other is restricted, they are considered 
    // "Different Scopes" (different levels of authority/access)
    if (scope1.isUnrestricted !== scope2.isUnrestricted) return false;

    // Check region (most restrictive level)
    if (scope1.regionId && scope2.regionId) {
      if (scope1.regionId !== scope2.regionId) return false;
    } else if (scope1.region && scope2.region && scope1.region !== scope2.region) {
      return false;
    }
    
    if (scope1.region && !scope2.region) return false; // scope1 is restricted, scope2 is not
    if (!scope1.region && scope2.region) return false; // vice versa

    // Check department
    if (scope1.department && scope2.department && scope1.department !== scope2.department) return false;
    if (scope1.department && !scope2.department) return false;
    if (!scope1.department && scope2.department) return false;

    // Check division
    if (scope1.division && scope2.division && scope1.division !== scope2.division) return false;
    if (scope1.division && !scope2.division) return false;
    if (!scope1.division && scope2.division) return false;

    return true; // All levels match or are unrestricted
  }

  /**
   * Helper: Check if proposal matches user's organizational scope
   */
  static proposalMatchesScope(proposal, userScope) {
    if (!userScope || userScope.isUnrestricted) return true;

    // Check region
    if (userScope.region && proposal.region) {
      const pRegionId = proposal.region._id ? proposal.region._id.toString() : proposal.region.toString();
      if (userScope.regionId) {
        if (pRegionId !== userScope.regionId) return false;
      } else if (proposal.region !== userScope.region && pRegionId !== userScope.region) {
        return false;
      }
    }
    if (userScope.region && !proposal.region) return false;

    // Check department
    if (userScope.department && proposal.department && proposal.department !== userScope.department) return false;
    if (userScope.department && !proposal.department) return false;

    // Check division
    if (userScope.division && proposal.division && proposal.division !== userScope.division) return false;
    if (userScope.division && !proposal.division) return false;

    return true;
  }
  /**
   * Acquire a lock on a proposal for editing
   * Scope-aware: Only blocks if lock owner has overlapping scope with current user
   */
  static async acquireLock(proposalId, userId, userName, userRole, userEmail) {
    try {
      // Find by _id (NewProposalWorkflow._id is what the frontend sends)
      const proposal = await NewProposalWorkflow.findById(proposalId);

      if (!proposal) {
        return { success: false, error: 'Proposal not found' };
      }

      // If locked and lock hasn't expired, check if it's the same user or different scope
      if (proposal.isLocked && proposal.lockExpiry) {
        if (new Date() < proposal.lockExpiry) {
          // Lock is still valid
          if (proposal.lockedBy && proposal.lockedBy.userId !== userId) {
            // Different user - check if they have scope overlap
            const lockedByScope = await this.getUserOrgScope(proposal.lockedBy.userId);
            const currentUserScope = await this.getUserOrgScope(userId);

            // Only block if scopes overlap (meaning they can access the same proposal)
            const scopesOverlap = this.scopesOverlap(lockedByScope, currentUserScope);
            const proposalMatchesLockedByScope = this.proposalMatchesScope(proposal, lockedByScope);
            
            console.log(`[LockDebug] Proposal ${proposalId}: Locked by ${proposal.lockedBy.userId}, requested by ${userId}`);
            console.log(`[LockDebug] Scopes overlap: ${scopesOverlap}, Proposal matches lockedByScope: ${proposalMatchesLockedByScope}`);

            if (scopesOverlap && proposalMatchesLockedByScope) {
              return {
                success: false,
                error: `Proposal is currently being edited by ${proposal.lockedBy.userName || 'another user'} (${proposal.lockedBy.userRole || ''})`,
                lockedBy: proposal.lockedBy,
                lockedAt: proposal.lockedAt,
                differentScope: false
              };
            } else {
              // Different scope - allow lock acquisition (they shouldn't conflict anyway)
              // But first clean up the old lock since it's from a different scope
              proposal.isLocked = false;
              proposal.lockedBy = null;
              proposal.lockedAt = null;
              proposal.lockExpiry = null;
            }
          }
          // Same user trying to renew lock - allow it (fall through to re-acquire)
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
      // Silent - avoid polluting logs with expected lock conflicts
      return { success: false, error: error.message };
    }
  }

  /**
   * Release a lock on a proposal
   */
  static async releaseLock(proposalId, userId) {
    try {
      const proposal = await NewProposalWorkflow.findById(proposalId);

      if (!proposal) {
        return { success: false, error: 'Proposal not found' };
      }

      // Only the user who locked it can unlock it (or if it's expired, anyone can clear it)
      if (proposal.isLocked && proposal.lockedBy && proposal.lockedBy.userId !== userId) {
        // Allow clearing if the lock is expired
        if (proposal.lockExpiry && new Date() < proposal.lockExpiry) {
          return {
            success: false,
            error: 'You do not have permission to release this lock'
          };
        }
      }

      proposal.isLocked = false;
      proposal.lockedBy = null;
      proposal.lockedAt = null;
      proposal.lockExpiry = null;

      await proposal.save();

      return { success: true, message: 'Lock released successfully' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Renew/extend lock expiry time
   */
  static async renewLock(proposalId, userId) {
    try {
      const proposal = await NewProposalWorkflow.findById(proposalId);

      if (!proposal) {
        return { success: false, error: 'Proposal not found' };
      }

      if (!proposal.isLocked || !proposal.lockedBy || proposal.lockedBy.userId !== userId) {
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
      return { success: false, error: error.message };
    }
  }

  /**
   * Get lock status of a proposal
   */
  static async getLockStatus(proposalId) {
    try {
      const proposal = await NewProposalWorkflow.findById(proposalId).select(
        'isLocked lockedBy lockedAt lockExpiry lockTimeout'
      );

      if (!proposal) {
        return { success: false, error: 'Proposal not found' };
      }

      // Check if lock has expired
      if (proposal.isLocked && proposal.lockExpiry) {
        if (new Date() >= proposal.lockExpiry) {
          // Lock expired, clean it up
          await NewProposalWorkflow.findByIdAndUpdate(proposalId, {
            isLocked: false,
            lockedBy: null,
            lockedAt: null,
            lockExpiry: null
          });

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
      return { success: false, error: error.message };
    }
  }

  /**
   * Clean up expired locks (background task)
   */
  static async cleanupExpiredLocks() {
    try {
      const now = new Date();
      const result = await NewProposalWorkflow.updateMany(
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

      return { success: true, cleanedCount: result.modifiedCount };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Check for version conflict (optimistic locking)
   */
  static async checkVersionConflict(proposalId, currentVersion) {
    try {
      const proposal = await NewProposalWorkflow.findById(proposalId).select('__v');

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
      return { conflict: false, error: error.message };
    }
  }
}

module.exports = ProposalLockingService;
