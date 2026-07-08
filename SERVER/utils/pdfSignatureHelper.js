const os = require('os');
const path = require('path');
const fs = require('fs');

/**
 * Extracts standard signatories from a workflow object
 */
const extractSignatoriesFromWorkflow = (workflow, currentUser = null) => {
  const result = {
    preparer: { name: workflow?.createdByName || '', title: 'Budget Preparer', userId: workflow?.createdBy || null },
    reviewer: { name: '', title: 'Budget Reviewer', userId: null },
    approver: { name: '', title: 'Budget Approver', userId: null }
  };

  if (workflow && Array.isArray(workflow.workflowHistory)) {
    const history = workflow.workflowHistory.slice().reverse();

    const notedEntry = history.find(h => 
      h.toStatus === 'FORWARDED_TO_APPROVER' || 
      h.action === 'submit-to-approver'
    );
    if (notedEntry) {
      result.reviewer.name = notedEntry.performedByName || '';
      result.reviewer.userId = notedEntry.performedBy || null;
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
      result.approver.userId = approvedEntry.performedBy || null;
    } else {
      const finalizedEntry = history.find(h => h.toStatus === 'FINALIZED' || h.action === 'finalize');
      if (finalizedEntry) {
        result.approver.name = finalizedEntry.performedByName || '';
        result.approver.userId = finalizedEntry.performedBy || null;
      } else if (workflow.consolidatedByName) {
        result.approver.name = workflow.consolidatedByName;
        result.approver.userId = workflow.consolidatedBy || null;
      }
    }
  }

  // Fallback to current user if they are an approver and name is still blank
  if (!result.approver.name && currentUser) {
    const roles = currentUser.roles || currentUser.Roles || [];
    const isApprover = roles.some(r => r === 'BUDGET_APPROVER' || r === 'BUDGET APPROVER');
    if (isApprover) {
      result.approver.name = currentUser.name || currentUser.userName || currentUser.UserName || currentUser.username || currentUser.particular || '';
      result.approver.userId = currentUser.id || currentUser.userId || currentUser.Id || null;
    }
  }

  // Fallback for preparer if name is still blank
  if (!result.preparer.name && currentUser) {
    result.preparer.name = currentUser.name || currentUser.userName || currentUser.UserName || currentUser.username || currentUser.particular || '';
    result.preparer.userId = currentUser.id || currentUser.userId || currentUser.Id || null;
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

/**
 * Enriches the signatories object with position titles from HierarchicalUserAssignment
 * @param {Object} signatoriesInfo 
 * @param {Object} context - Optional context to look up default reviewer/approver (e.g. { region: 'REGION VI' })
 */
const enrichSignatoriesWithPositionTitle = async (signatoriesInfo, context = null) => {
  try {
    const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
    
    for (const key of ['preparer', 'reviewer', 'approver']) {
      const sig = signatoriesInfo[key];
      
      // If we have a userId or name, we fetch their exact assignment to get the position title
      if (sig && (sig.userId || sig.name)) {
        console.log(`[PDF_SIG] Enriching ${key} with userId: ${sig.userId}, name: ${sig.name}`);
        
        const queryOr = [];
        if (sig.userId) queryOr.push({ userId: String(sig.userId) });
        if (sig.name && sig.name.trim() !== '') {
          // Add case-insensitive name match
          queryOr.push({ userName: new RegExp('^' + sig.name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') });
        }
        
        if (queryOr.length > 0) {
          const assignment = await HierarchicalUserAssignment.findOne({ $or: queryOr }).lean();
          console.log(`[PDF_SIG] Assignment found for ${sig.userId || sig.name}:`, !!assignment, 'Title:', assignment?.positionTitle);
          if (assignment && assignment.positionTitle) {
            sig.title = assignment.positionTitle;
          }
        }
      } 
      // If NO userId (no workflow), try to find the designated person for this region via HierarchicalUserAssignment
      else if (sig && !sig.userId && context && context.region) {
        let targetRole = '';
        if (key === 'reviewer') targetRole = 'BUDGET_REVIEWER';
        if (key === 'approver') targetRole = 'BUDGET_APPROVER';
        
        if (targetRole) {
          // Find the user assigned to this role and region
          const assignment = await HierarchicalUserAssignment.findOne({
            $or: [{ userRoles: targetRole }, { userRole: targetRole }],
            $or: [
              { assignmentLevel: 'REGION', regionName: context.region },
              { assignmentLevel: 'FULL' } // Super admins or full access
            ]
          }).sort({ assignmentLevel: 1 }).lean(); // Prioritize REGION over FULL
          
          if (assignment) {
            console.log(`[PDF_SIG] Found default ${key} for region ${context.region}: ${assignment.userName}`);
            sig.name = assignment.userName || '';
            sig.userId = assignment.userId || null;
            if (assignment.positionTitle) {
              sig.title = assignment.positionTitle;
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn('[PDF_SIG] Failed to enrich position titles:', error.message);
  }
  return signatoriesInfo;
};

module.exports = {
  extractSignatoriesFromWorkflow,
  drawWorkflowSignatureBlock,
  cleanupTempImages,
  enrichSignatoriesWithPositionTitle
};
