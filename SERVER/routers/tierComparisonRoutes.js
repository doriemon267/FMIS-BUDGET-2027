const express = require('express');
const router = express.Router();
const Tier2Proposal = require('../models/Tier2Proposal');
const PersonnelService = require('../models/PersonnelServices');
const MooeProposal = require('../models/mooeProposals');
const CapitalOutlay = require('../models/CapitalOutlay');
const Income = require('../models/Income');
const BudgetarySupport = require('../models/BudgetarySupport');
const checkToken = require('../middleware/check_token');

/**
 * GET /api/tier-comparison/tier1/finalized
 * Fetch all finalized Tier 1 proposals for a specific region
 */
router.get('/tier1/finalized', checkToken, async (req, res) => {
  try {
    const { region, fiscalYear, budgetType } = req.query;

    if (!region) {
      return res.status(400).json({ 
        success: false, 
        message: 'Region parameter is required' 
      });
    }

    // Build query filter
    const query = { 
      region,
      status: 'Finalized',
      budgetType: 'Initial' // Always filter for Initial budget type
    };
    
    // fiscalYear is stored as string in the database
    if (fiscalYear) {
      query.fiscalYear = String(fiscalYear);
    }

    // Fetch finalized proposals from all categories
    const [personnel, mooe, capital, income, budgetarySupport] = await Promise.all([
      PersonnelService.find(query).lean(),
      MooeProposal.find(query).lean(),
      CapitalOutlay.find(query).lean(),
      Income.find(query).lean(),
      BudgetarySupport.find(query).lean()
    ]);

    // Format data with type identifiers
    const formatData = (items, type) => items.map(item => ({
      ...item,
      sourceType: type,
      sourceId: item._id
    }));

    const tier1Data = {
      personnel: formatData(personnel, 'personnel'),
      mooe: formatData(mooe, 'mooe'),
      capital: formatData(capital, 'capital'),
      income: formatData(income, 'income'),
      budgetarySupport: formatData(budgetarySupport, 'budgetarySupport')
    };

    // Calculate totals
    const calculateTotal = (items) => items.reduce((sum, item) => {
      // Handle different field names across models:
      // - PersonnelServices uses: Total (capital T)
      // - MOOE/CapitalOutlay uses: cost or amount
      // - Income/BudgetarySupport uses: amount or total
      const amount = item.Total || item.total || item.amount || item.cost || item.grandTotal || 0;
      return sum + Number(amount);
    }, 0);

    const totals = {
      personnel: calculateTotal(personnel),
      mooe: calculateTotal(mooe),
      capital: calculateTotal(capital),
      income: calculateTotal(income),
      budgetarySupport: calculateTotal(budgetarySupport)
    };

    totals.grandTotal = Object.values(totals).reduce((sum, val) => sum + val, 0);

    res.json({
      success: true,
      data: tier1Data,
      totals,
      metadata: {
        region,
        fiscalYear: fiscalYear || 'All',
        budgetType: budgetType || 'All',
        totalRecords: personnel.length + mooe.length + capital.length + income.length + budgetarySupport.length
      }
    });

  } catch (error) {
    console.error('Error fetching Tier 1 finalized proposals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch Tier 1 proposals',
      error: error.message
    });
  }
});

/**
 * GET /api/tier-comparison/tier2
 * Fetch all Tier 2 proposals for a specific region
 */
router.get('/tier2', checkToken, async (req, res) => {
  try {
    const { region, fiscalYear, tier2Status } = req.query;

    if (!region) {
      return res.status(400).json({ 
        success: false, 
        message: 'Region parameter is required' 
      });
    }

    const query = { 
      region,
      budgetType: 'Initial' // Always filter for Initial budget type
    };
    if (fiscalYear) query.fiscalYear = String(fiscalYear);
    if (tier2Status) query.tier2Status = tier2Status;

    const tier2Proposals = await Tier2Proposal.find(query)
      .sort({ createdAt: -1 })
      .lean();

    // Calculate totals
    const totals = {
      tier1Amount: 0,
      tier2Amount: 0,
      adjustmentAmount: 0
    };

    tier2Proposals.forEach(proposal => {
      totals.tier1Amount += proposal.tier1Amount || 0;
      totals.tier2Amount += proposal.tier2Amount || 0;
      totals.adjustmentAmount += proposal.adjustmentAmount || 0;
    });

    res.json({
      success: true,
      data: tier2Proposals,
      totals,
      metadata: {
        region,
        fiscalYear: fiscalYear || 'All',
        budgetType: 'Initial',
        totalRecords: tier2Proposals.length
      }
    });

  } catch (error) {
    console.error('Error fetching Tier 2 proposals:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch Tier 2 proposals',
      error: error.message
    });
  }
});

/**
 * POST /api/tier-comparison/tier2/copy-from-tier1
 * Copy finalized Tier 1 proposals to Tier 2 for editing
 */
router.post('/tier2/copy-from-tier1', checkToken, async (req, res) => {
  try {
    const { region, fiscalYear } = req.body;
    const user = req.user;

    if (!region) {
      return res.status(400).json({ 
        success: false, 
        message: 'Region parameter is required' 
      });
    }

    // Fetch Tier 1 finalized data (always Initial budget type)
    const query = { 
      region,
      status: 'Finalized',
      budgetType: 'Initial'
    };
    
    // fiscalYear is stored as string in the database
    if (fiscalYear) {
      query.fiscalYear = String(fiscalYear);
    }

    const [personnel, mooe, capital, income, budgetarySupport] = await Promise.all([
      PersonnelService.find(query).lean(),
      MooeProposal.find(query).lean(),
      CapitalOutlay.find(query).lean(),
      Income.find(query).lean(),
      BudgetarySupport.find(query).lean()
    ]);

    // Helper function to extract amount from various field names
    const getAmount = (item) => {
      // Check for Total field first (PersonnelServices uses this)
      return item.Total || item.total || item.amount || item.cost || item.grandTotal || 0;
    };

    // Create Tier 2 proposals grouped by category
    const tier2Proposals = [];
    const timestamp = new Date();

    // Helper to create Tier 2 entry
    const createTier2Entry = (items, sourceType, categoryName) => {
      if (items.length === 0) return null;

      const tier1Amount = items.reduce((sum, item) => sum + Number(getAmount(item)), 0);
      const tier1References = items.map(item => ({
        sourceType,
        sourceId: item._id
      }));

      return {
        title: `${categoryName} - ${region}`,
        description: `Tier 2 copy of finalized ${categoryName} proposals for ${region}`,
        region,
        fiscalYear: fiscalYear || items[0]?.fiscalYear,
        budgetType: 'Initial', // Always Initial budget type
        tier1References,
        tier1Amount,
        tier2Amount: tier1Amount, // Initially same as Tier 1
        adjustmentAmount: 0,
        adjustmentPercentage: 0,
        categoryBreakdown: {
          [sourceType]: tier1Amount
        },
        tier2Status: 'Draft',
        createdBy: {
          userId: user.id || user._id,
          userName: user.Name || user.username || 'Unknown',
          userRole: user.Roles?.[0] || 'BRD User'
        },
        tier2Metadata: {
          copiedFromTier1At: timestamp,
          isDraft: true,
          isLocked: false
        }
      };
    };

    // Create entries for each category
    const personnelEntry = createTier2Entry(personnel, 'personnel', 'Personnel Services');
    const mooeEntry = createTier2Entry(mooe, 'mooe', 'MOOE');
    const capitalEntry = createTier2Entry(capital, 'capital', 'Capital Outlay');
    const incomeEntry = createTier2Entry(income, 'income', 'Income');
    const budgetarySupportEntry = createTier2Entry(budgetarySupport, 'budgetarySupport', 'Budgetary Support');

    // Filter out null entries and add to array
    [personnelEntry, mooeEntry, capitalEntry, incomeEntry, budgetarySupportEntry]
      .filter(entry => entry !== null)
      .forEach(entry => tier2Proposals.push(entry));

    if (tier2Proposals.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No finalized Tier 1 proposals found to copy'
      });
    }

    // Check if Tier 2 already exists for this region/fiscal year/budget type
    const existingTier2 = await Tier2Proposal.findOne({
      region,
      fiscalYear: fiscalYear || tier2Proposals[0].fiscalYear,
      budgetType: 'Initial'
    });

    if (existingTier2) {
      return res.status(409).json({
        success: false,
        message: 'Tier 2 proposals already exist for this region and fiscal year. Please update existing records instead.'
      });
    }

    // Insert Tier 2 proposals
    const result = await Tier2Proposal.insertMany(tier2Proposals);

    res.status(201).json({
      success: true,
      message: 'Successfully copied Tier 1 proposals to Tier 2',
      data: result,
      metadata: {
        totalCreated: result.length,
        region,
        fiscalYear: fiscalYear || 'Current',
        budgetType: 'Initial'
      }
    });

  } catch (error) {
    console.error('Error copying Tier 1 to Tier 2:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({
      success: false,
      message: 'Failed to copy Tier 1 proposals to Tier 2',
      error: error.message,
      details: error.stack
    });
  }
});

/**
 * PUT /api/tier-comparison/tier2/:id
 * Update a specific Tier 2 proposal
 */
router.put('/tier2/:id', checkToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const user = req.user;

    // Find and update the Tier 2 proposal
    const tier2Proposal = await Tier2Proposal.findById(id);

    if (!tier2Proposal) {
      return res.status(404).json({
        success: false,
        message: 'Tier 2 proposal not found'
      });
    }

    // Check if proposal is locked
    if (tier2Proposal.tier2Metadata?.isLocked) {
      return res.status(403).json({
        success: false,
        message: 'This Tier 2 proposal is locked and cannot be edited'
      });
    }

    // Update allowed fields
    const allowedFields = [
      'title', 'description', 'tier2Amount', 'tier2Remarks', 'priority',
      'categoryBreakdown', 'tier2Status'
    ];

    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        tier2Proposal[field] = updateData[field];
      }
    });

    // Update modification tracking
    tier2Proposal.lastModifiedBy = {
      userId: user.id || user._id,
      userName: user.Name || user.username || 'Unknown',
      userRole: user.Roles?.[0] || 'BRD User',
      modifiedAt: new Date()
    };

    // Add to approval history
    tier2Proposal.tier2ApprovalHistory.push({
      action: 'Edited',
      userId: user.id || user._id,
      userName: user.Name || user.username || 'Unknown',
      userRole: user.Roles?.[0] || 'BRD User',
      comment: updateData.editComment || 'Updated Tier 2 proposal',
      timestamp: new Date()
    });

    await tier2Proposal.save();

    res.json({
      success: true,
      message: 'Tier 2 proposal updated successfully',
      data: tier2Proposal
    });

  } catch (error) {
    console.error('Error updating Tier 2 proposal:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update Tier 2 proposal',
      error: error.message
    });
  }
});

/**
 * DELETE /api/tier-comparison/tier2/:id
 * Delete a specific Tier 2 proposal
 */
router.delete('/tier2/:id', checkToken, async (req, res) => {
  try {
    const { id } = req.params;

    const tier2Proposal = await Tier2Proposal.findById(id);

    if (!tier2Proposal) {
      return res.status(404).json({
        success: false,
        message: 'Tier 2 proposal not found'
      });
    }

    // Check if proposal is locked or finalized
    if (tier2Proposal.tier2Status === 'Finalized' || tier2Proposal.tier2Metadata?.isLocked) {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete a finalized or locked Tier 2 proposal'
      });
    }

    await Tier2Proposal.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Tier 2 proposal deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting Tier 2 proposal:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete Tier 2 proposal',
      error: error.message
    });
  }
});

/**
 * GET /api/tier-comparison/regions
 * Get list of regions with finalized Tier 1 proposals
 */
router.get('/regions', checkToken, async (req, res) => {
  try {
    const { fiscalYear } = req.query;
    
    const query = { 
      status: 'Finalized',
      budgetType: 'Initial' // Always filter for Initial budget type only
    };
    // fiscalYear is stored as string in the database
    if (fiscalYear) {
      query.fiscalYear = String(fiscalYear);
    }

    // Get unique regions from all proposal types
    const [personnelRegions, mooeRegions, capitalRegions, incomeRegions, budgetarySupportRegions] = await Promise.all([
      PersonnelService.distinct('region', query),
      MooeProposal.distinct('region', query),
      CapitalOutlay.distinct('region', query),
      Income.distinct('region', query),
      BudgetarySupport.distinct('region', query)
    ]);

    // Combine and deduplicate regions
    const allRegions = [...new Set([
      ...personnelRegions,
      ...mooeRegions,
      ...capitalRegions,
      ...incomeRegions,
      ...budgetarySupportRegions
    ])].filter(region => region); // Filter out null/undefined

    res.json({
      success: true,
      data: allRegions.sort(),
      metadata: {
        totalRegions: allRegions.length,
        fiscalYear: fiscalYear || 'All',
        budgetType: 'Initial'
      }
    });

  } catch (error) {
    console.error('Error fetching regions:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch regions',
      error: error.message
    });
  }
});

/**
 * GET /api/tier-comparison/fiscal-years
 * Get list of available fiscal years with finalized Tier 1 proposals
 */
router.get('/fiscal-years', checkToken, async (req, res) => {
  try {
    const { region } = req.query;
    
    const query = { 
      status: 'Finalized',
      budgetType: 'Initial' // Always filter for Initial budget type only
    };
    if (region) query.region = region;

    // Get unique fiscal years from all proposal types (fiscalYear is stored as string)
    const [personnelYears, mooeYears, capitalYears, incomeYears, budgetarySupportYears] = await Promise.all([
      PersonnelService.distinct('fiscalYear', query),
      MooeProposal.distinct('fiscalYear', query),
      CapitalOutlay.distinct('fiscalYear', query),
      Income.distinct('fiscalYear', query),
      BudgetarySupport.distinct('fiscalYear', query)
    ]);

    // Combine and deduplicate fiscal years (keep as strings, sort numerically)
    const allFiscalYears = [...new Set([
      ...personnelYears,
      ...mooeYears,
      ...capitalYears,
      ...incomeYears,
      ...budgetarySupportYears
    ])].filter(year => year).sort((a, b) => parseInt(b) - parseInt(a)); // Filter and sort descending

    res.json({
      success: true,
      data: allFiscalYears,
      metadata: {
        totalYears: allFiscalYears.length,
        region: region || 'All',
        budgetType: 'Initial'
      }
    });

  } catch (error) {
    console.error('Error fetching fiscal years:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fiscal years',
      error: error.message
    });
  }
});

module.exports = router;
