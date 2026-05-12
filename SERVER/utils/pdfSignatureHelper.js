const os = require('os');
const path = require('path');
const fs = require('fs');

/**
 * Extracts standard signatories from a workflow object
 */
const extractSignatoriesFromWorkflow = (workflow) => {
  const result = {
    preparer: { name: workflow?.createdByName || '', title: 'Budget Preparer' },
    reviewer: { name: '', title: 'Budget Reviewer' },
    approver: { name: '', title: 'Budget Approver' }
  };

  if (!workflow || !Array.isArray(workflow.workflowHistory)) return result;

  const notedEntry = workflow.workflowHistory.find(h => h.toStatus === 'FORWARDED_TO_APPROVER');
  if (notedEntry) {
    result.reviewer.name = notedEntry.performedByName || '';
  }

  const approvedEntry = workflow.workflowHistory.find(h => h.toStatus === 'FINALIZED');
  if (approvedEntry) {
    result.approver.name = approvedEntry.performedByName || '';
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
