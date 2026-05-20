const ProposalLockingService = require('../services/ProposalLockingService');
const NewProposalWorkflow = require('../models/NewProposalWorkflow');

/**
 * Middleware to verify proposal lock on update operations
 * Scope-aware: Only blocks locks from users with overlapping scope
 * If lock owner has different scope, allows the update (no conflict)
 */
async function checkProposalLockMiddleware(req, res, next) {
  try {
    const proposalId = req.body.proposalId || req.params.proposalId;

    if (!proposalId) {
      // No proposal ID, skip lock check
      return next();
    }

    const userId = req.user?.id || req.userId;
    const userName = req.user?.name || req.userName;
    const userRole = req.user?.role || req.userRole;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    // Get lock status and proposal
    const lockStatus = await ProposalLockingService.getLockStatus(proposalId);
    const proposal = await NewProposalWorkflow.findById(proposalId);

    if (!proposal) {
      return res.status(404).json({
        success: false,
        error: 'Proposal not found'
      });
    }

    if (lockStatus.success === false && lockStatus.error) {
      return res.status(404).json(lockStatus);
    }

    // If proposal is locked by another user, check scope compatibility
    if (lockStatus.isLocked && lockStatus.lockedBy && lockStatus.lockedBy.userId !== userId) {
      // Get scopes of both lock owner and current user
      const lockedByScope = await ProposalLockingService.getUserOrgScope(lockStatus.lockedBy.userId);
      const currentUserScope = await ProposalLockingService.getUserOrgScope(userId);

      // Check if scopes overlap
      const scopesOverlap = ProposalLockingService.scopesOverlap(lockedByScope, currentUserScope);
      const proposalMatchesLockedByScope = ProposalLockingService.proposalMatchesScope(proposal, lockedByScope);

      // Only block if both scopes can access this proposal (true concurrent editing conflict)
      if (scopesOverlap && proposalMatchesLockedByScope) {
        return res.status(423).json({
          success: false,
          error: `Proposal is locked for editing by ${lockStatus.lockedBy.userName} (${lockStatus.lockedBy.userRole})`,
          lockedBy: lockStatus.lockedBy,
          lockedAt: lockStatus.lockedAt,
          timeRemaining: lockStatus.timeRemaining,
          statusCode: 423,
          scopeInfo: {
            lockOwnerScope: lockedByScope,
            currentUserScope: currentUserScope,
            scopesOverlap: true
          }
        });
      }
      // Different scope - allow update (no real conflict)
    }

    // Attach lock information to request for later use
    req.proposalLock = {
      isLocked: lockStatus.isLocked,
      lockedBy: lockStatus.lockedBy,
      lockExpiry: lockStatus.lockExpiry
    };

    next();
  } catch (error) {
    console.error('Error in checkProposalLockMiddleware:', error);
    res.status(500).json({
      success: false,
      error: 'Lock verification failed'
    });
  }
}

/**
 * Middleware to automatically update the __v field for optimistic locking
 * Should be applied after a successful update
 */
async function updateVersionMiddleware(req, res, next) {
  try {
    const { updateProposal } = req;
    
    if (updateProposal && typeof updateProposal === 'function') {
      // The controller should call updateProposal after making changes
      req.updateProposal = async (proposalId, userId) => {
        const proposal = await updateProposal(proposalId);
        return proposal;
      };
    }

    next();
  } catch (error) {
    console.error('Error in updateVersionMiddleware:', error);
    next(error);
  }
}

module.exports = {
  checkProposalLockMiddleware,
  updateVersionMiddleware
};
