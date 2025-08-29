const express = require('express');
const router = express.Router();
const checkToken = require('../middleware/checkToken');

// Import your controller (adjust the path as needed).
const mooeController = require('../controllers/mooeController');
const MooeProposal = require('../models/mooeProposals');

// Apply authentication to all MOOE routes
router.use(checkToken);

// Define routes to match the front-end requests.
router.get('/mooe-data', mooeController.getMOOEData);
router.get('/mooe-entries', mooeController.getMOOEEntries);
router.get('/mooe-status', mooeController.getMOOEStatus);
router.post('/mooe-save', mooeController.bulkSaveMOOE);
router.post('/mooe-data', mooeController.bulkSaveMOOE); // <-- Added for frontend compatibility
router.get('/mooe-list', mooeController.getMooeList);
router.delete('/mooe-delete', mooeController.deleteAllMooeProposals);
// Optional: If your ProposalCustomPage is calling GET /MOOEProposal,
// you can map that route to the appropriate controller function.
router.get('/MOOEProposal', mooeController.getMOOEData);

// Get MOOE by parameters
router.get("/mooe/getByParams", async (req, res) => {
  try {
    const { fiscalYear, budgetType, processBy, region, status } = req.query;
    
    const query = {};
    if (fiscalYear) query.fiscalYear = fiscalYear;
    if (budgetType) query.budgetType = budgetType;
    if (processBy) query.processBy = processBy;
    if (region) query.region = region;
    if (status) query.status = status;
    
    const mooe = await MooeProposal.find(query).lean();
    
    res.status(200).json(mooe);
  } catch (error) {
    console.error("Error fetching MOOE by params:", error);
    res.status(500).json({ message: "Failed to fetch MOOE data" });
  }
});

module.exports = router;
