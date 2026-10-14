const express = require('express');
const router = express.Router();
const isAuth = require('../middleware/is_auth');

const { strictHierarchicalControl, hierarchicalAccessControl } = require('../middleware/hierarchicalAccessControl');
const { submissionWorkflowControl } = require('../middleware/submissionWorkflowControl');
// Import your controller (adjust the path as needed).
const mooeController = require('../controllers/mooeController');

// Apply authentication to all MOOE routes
router.use(isAuth);

// Define routes to match the front-end requests with SUBMISSION WORKFLOW CONTROL
router.get('/mooe-data', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), mooeController.getMOOEData);
router.get('/mooe-entries', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), mooeController.getMOOEEntries);
router.get('/mooe-status', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), mooeController.getMOOEStatus);
router.post('/mooe-save', submissionWorkflowControl('create', { strictMode: false }), mooeController.bulkSaveMOOE);
router.post('/mooe-data', submissionWorkflowControl('create', { strictMode: false }), mooeController.bulkSaveMOOE); // <-- Added for frontend compatibility
router.get('/mooe-list', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), mooeController.getMooeList);
// Add /mooe route for SubsidyBalanceMonitor compatibility
router.get('/mooe', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), mooeController.getMOOEData);
router.delete('/mooe-delete', mooeController.deleteAllMooeProposals);
// Optional: If your ProposalCustomPage is calling GET /MOOEProposal,
// you can map that route to the appropriate controller function.
router.get('/MOOEProposal', hierarchicalAccessControl('read'), mooeController.getMOOEData);
// Get MOOE by parameters - FIXED to use proper submission workflow filtering
router.get("/mooe/getByParams", submissionWorkflowControl('read'), mooeController.getMOOEByParams);
// Bulk update MOOE entries
router.put("/mooe/bulk-update", submissionWorkflowControl('update', { strictMode: true, enableConsolidation: true }), mooeController.bulkUpdateMOOE);
// Admin endpoint to fix database indexes
router.post('/mooe-fix-index', mooeController.fixDatabaseIndex);

router.get('/cleanup-mooe', async (req, res) => {
  try {
    const MooeProposal = require('../models/MooeProposal');
    // Find all 5-02-99-990 entries
    const entries = await MooeProposal.find({ uacsCode: "5-02-99-990" }).lean();
    
    // Group by region, department, division, fiscalYear
    const groups = {};
    for (const e of entries) {
      const key = `${e.region}_${e.department}_${e.division}_${e.fiscalYear}_${e.proposalId}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    }
    
    let deletedCount = 0;
    for (const key in groups) {
      const group = groups[key];
      if (group.length > 1) {
        // Sort to keep the one that looks least like a generic duplicate
        group.sort((a, b) => {
          if (a.amount !== b.amount) return b.amount - a.amount;
          return 0;
        });
        
        // Keep the first one, delete the rest
        for (let i = 1; i < group.length; i++) {
          await MooeProposal.findByIdAndDelete(group[i]._id);
          deletedCount++;
        }
        
        // Zero out the amount of the kept 5-02-99-990 row to remove the bugged injected value
        const keptRow = group[0];
        if (keptRow.amount || keptRow.income || keptRow.subsidy) {
          await MooeProposal.findByIdAndUpdate(keptRow._id, { amount: "0", income: "0", subsidy: "0" });
        }
      } else if (group.length === 1) {
        // Even if no duplicates, zero it out to fix the bugged injected value
        const keptRow = group[0];
        if (keptRow.amount || keptRow.income || keptRow.subsidy) {
          await MooeProposal.findByIdAndUpdate(keptRow._id, { amount: "0", income: "0", subsidy: "0" });
        }
      }
    }
    
    // After cleaning up, trigger recalculation
    const { recalculateAndSaveProposalTotals } = require('../utils/recalculateProposalTotals');
    const proposals = await require('../models/Proposal').find({}).select('_id').lean();
    for (const p of proposals) {
      await recalculateAndSaveProposalTotals({ proposalId: p._id }).catch(e => console.log("Skipped a recalculation"));
    }
    // Fix custom UACS codes that should be standard
    const customEntries = await MooeProposal.find({ uacsCode: { $regex: /^5-02-99-990-/ } }).lean();
    const ChartOfAccounts = require('../models/chartOfAccounts');
    let fixedCustomCount = 0;
    
    for (const e of customEntries) {
      if (e.accountingTitle) {
        // Look for exact match in ChartOfAccounts
        const stdAccount = await ChartOfAccounts.findOne({ accountingTitle: e.accountingTitle }).lean();
        if (stdAccount && stdAccount.uacsCode) {
          // It's a standard account! Fix it!
          await MooeProposal.findByIdAndUpdate(e._id, {
            uacsCode: stdAccount.uacsCode,
            sublineItem: stdAccount.sublineItem
          });
          fixedCustomCount++;
        }
      }
    }

    res.status(200).json({ message: `Cleanup successful. Deleted ${deletedCount} duplicate entries. Fixed ${fixedCustomCount} incorrectly placed standard items.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
