const os = require('os');
const path = require('path');
const fs = require('fs');

/**
 * Extracts standard signatories from a workflow object
 */
const extractSignatoriesFromWorkflow = (workflow, currentUser = null) => {
  const result = {
    preparer: { name: workflow?.createdByName || '', title: 'Budget Preparer' },
    reviewer: { name: '', title: 'Budget Reviewer' },
    approver: { name: '', title: 'Budget Approver' }
  };

  if (workflow && Array.isArray(workflow.workflowHistory)) {
    const history = workflow.workflowHistory.slice().reverse();

    const notedEntry = history.find(h => 
      h.toStatus === 'FORWARDED_TO_APPROVER' || 
      h.action === 'submit-to-approver'
    );
    if (notedEntry) {
      result.reviewer.name = notedEntry.performedByName || '';
    }

    const approvedEntry = history.find(h => 
      h.toStatus === 'FORWARDED_TO_BRD_ANALYST' || 
      h.action === 'submit-to-analyst' ||
      h.toStatus === 'FORWARDED_TO_BRD_OFFICER' ||
      h.action === 'merge' ||
      h.toStatus === 'MERGED'
    );
    
    if (approvedEntry) {
      result.approver.name = approvedEntry.performedByName || '';
    } else {
      const finalizedEntry = history.find(h => h.toStatus === 'FINALIZED' || h.action === 'finalize');
      if (finalizedEntry) {
        result.approver.name = finalizedEntry.performedByName || '';
      } else if (workflow.consolidatedByName) {
        result.approver.name = workflow.consolidatedByName;
      }
    }
  }

  // Fallback to current user if they are an approver and name is still blank
  if (!result.approver.name && currentUser) {
    const roles = currentUser.roles || currentUser.Roles || [];
    const isApprover = roles.some(r => r === 'BUDGET_APPROVER' || r === 'BUDGET APPROVER');
    if (isApprover) {
      result.approver.name = currentUser.name || currentUser.UserName || currentUser.username || '';
    }
  }
  
  return result;
};

/**
 * Draws the 3-column signature block at the current Y position.
 */
const drawWorkflowSignatureBlock = (context, signatories, currentY, startX, totalWidth, tempImagePaths) => {
  const sigWidth = 140;
  const sigSpacing = (totalWidth - (sigWidth * 3)) / 2;
  const sig1X = startX;
  const sig2X = sig1X + sigWidth + sigSpacing;
  const sig3X = sig2X + sigWidth + sigSpacing;

  const textOpt = (opts = {}) => ({ color: '#000000', ...opts });
  const sigLineY = currentY + 15;

  const renderBlock = (x, roleInfo) => {
    let label = roleInfo.label;
    if (!label) {
      const baseRole = String(roleInfo.title || '').trim();
      if (baseRole.includes('Preparer')) label = 'Prepared by:';
      else if (baseRole.includes('Reviewer')) label = 'Reviewed by:';
      else if (baseRole.includes('Approver')) label = 'Approved by:';
      else if (baseRole.includes('Verifier')) label = 'Verified by:';
      else if (baseRole) label = `${baseRole} by:`;
      else label = 'Signature:';
    }
    context.text(label, x, currentY, textOpt({ fontSize: 8, font: 'Helvetica' }));
    
    context.text(roleInfo.name || '________________________', x, sigLineY + 15, textOpt({ fontSize: 9, font: 'Helvetica-Bold' }));
    context.text(roleInfo.title, x, sigLineY + 25, textOpt({ fontSize: 8, font: 'Helvetica' }));
  };

  renderBlock(sig1X, signatories.preparer);
  renderBlock(sig2X, signatories.reviewer);
  renderBlock(sig3X, signatories.approver);

  return currentY + 45;
};

/**
 * Clean up temporary signature images
 */
const cleanupTempImages = (tempImagePaths) => {
  if (!Array.isArray(tempImagePaths)) return;
  tempImagePaths.forEach(path => {
    try {
      if (fs.existsSync(path)) {
        fs.unlinkSync(path);
      }
    } catch (err) {}
  });
};

module.exports = {
  extractSignatoriesFromWorkflow,
  drawWorkflowSignatureBlock,
  cleanupTempImages
};
