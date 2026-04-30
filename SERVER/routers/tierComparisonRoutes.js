const express = require('express');
const router = express.Router();
const Tier2Proposal = require('../models/Tier2Proposal');
const PersonnelService = require('../models/PersonnelServices');
const MooeProposal = require('../models/mooeProposals');
const CapitalOutlay = require('../models/CapitalOutlay');
const Income = require('../models/Income');
const BudgetarySupport = require('../models/BudgetarySupport');
const checkToken = require('../middleware/check_token');
const check_token_dev = require("../middleware/check_token_dev");
const check_token_prod = require("../middleware/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;


/**
 * GET /api/tier-comparison/tier1/finalized
 * Fetch all finalized Tier 1 proposals for a specific region
 */


router.get('/tier1/finalized', tokenMiddleware, async (req, res) => {
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
router.get('/tier2', tokenMiddleware, async (req, res) => {
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
router.post('/tier2/copy-from-tier1', tokenMiddleware, async (req, res) => {
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
router.put('/tier2/:id', tokenMiddleware, async (req, res) => {
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
router.delete('/tier2/:id', tokenMiddleware, async (req, res) => {
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
router.get('/regions', tokenMiddleware, async (req, res) => {
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
router.get('/fiscal-years', tokenMiddleware, async (req, res) => {
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

/**
 * GET /api/tier-comparison/comparative-report
 * Get comparative report data for a region showing current proposals vs historical GAA
 */
router.get('/comparative-report', tokenMiddleware, async (req, res) => {
  try {
    const { region, currentFiscalYear } = req.query;

    if (!region || !currentFiscalYear) {
      return res.status(400).json({
        success: false,
        message: 'Region and currentFiscalYear parameters are required'
      });
    }

    const currentYear = parseInt(currentFiscalYear);
    const pastYears = [currentYear - 3, currentYear - 2, currentYear - 1]; // 3 years back

    // Fetch current proposals (Initial budget type, finalized)
    const currentQuery = {
      region,
      fiscalYear: currentFiscalYear,
      budgetType: 'Initial',
      status: 'Finalized'
    };

    // Fetch historical GAA data
    const gaaQueries = pastYears.map(year => ({
      region,
      fiscalYear: year.toString(),
      budgetType: 'GAA'
    }));

    // Fetch all data concurrently
    const [
      currentPersonnel, currentMooe, currentCapital, currentIncome, currentBudgetarySupport,
      gaaDataYear1, gaaDataYear2, gaaDataYear3
    ] = await Promise.all([
      // Current data
      PersonnelService.find(currentQuery).lean(),
      MooeProposal.find(currentQuery).lean(),
      CapitalOutlay.find(currentQuery).lean(),
      Income.find(currentQuery).lean(),
      BudgetarySupport.find(currentQuery).lean(),
      // Historical GAA data
      Promise.all([
        PersonnelService.find(gaaQueries[0]).lean(),
        MooeProposal.find(gaaQueries[0]).lean(),
        CapitalOutlay.find(gaaQueries[0]).lean(),
        Income.find(gaaQueries[0]).lean(),
        BudgetarySupport.find(gaaQueries[0]).lean()
      ]),
      Promise.all([
        PersonnelService.find(gaaQueries[1]).lean(),
        MooeProposal.find(gaaQueries[1]).lean(),
        CapitalOutlay.find(gaaQueries[1]).lean(),
        Income.find(gaaQueries[1]).lean(),
        BudgetarySupport.find(gaaQueries[1]).lean()
      ]),
      Promise.all([
        PersonnelService.find(gaaQueries[2]).lean(),
        MooeProposal.find(gaaQueries[2]).lean(),
        CapitalOutlay.find(gaaQueries[2]).lean(),
        Income.find(gaaQueries[2]).lean(),
        BudgetarySupport.find(gaaQueries[2]).lean()
      ])
    ]);

    // Helper function to calculate total amount
    const calculateTotal = (items) => items.reduce((sum, item) => {
      const amount = item.Total || item.total || item.amount || item.cost || item.grandTotal || 0;
      return sum + Number(amount);
    }, 0);

    // Structure the data according to user requirements
    const buildComparativeData = () => {
      // Current proposal totals
      const current = {
        personnel: calculateTotal(currentPersonnel),
        mooe: calculateTotal(currentMooe),
        capital: calculateTotal(currentCapital),
        income: calculateTotal(currentIncome),
        budgetarySupport: calculateTotal(currentBudgetarySupport)
      };

      // Historical GAA data
      const gaa = pastYears.map((year, index) => {
        const yearData = [gaaDataYear1, gaaDataYear2, gaaDataYear3][index];
        return {
          year: year.toString(),
          personnel: calculateTotal(yearData[0] || []),
          mooe: calculateTotal(yearData[1] || []),
          capital: calculateTotal(yearData[2] || []),
          income: calculateTotal(yearData[3] || []),
          budgetarySupport: calculateTotal(yearData[4] || [])
        };
      });

      // Calculate 3-year average GAA
      const avgGaa = {
        personnel: gaa.reduce((sum, y) => sum + y.personnel, 0) / 3,
        mooe: gaa.reduce((sum, y) => sum + y.mooe, 0) / 3,
        capital: gaa.reduce((sum, y) => sum + y.capital, 0) / 3,
        income: gaa.reduce((sum, y) => sum + y.income, 0) / 3,
        budgetarySupport: gaa.reduce((sum, y) => sum + y.budgetarySupport, 0) / 3
      };

      // Calculate 120% of 3-year average
      const ceiling120 = {
        personnel: avgGaa.personnel * 1.2,
        mooe: avgGaa.mooe * 1.2,
        capital: avgGaa.capital * 1.2,
        income: avgGaa.income * 1.2,
        budgetarySupport: avgGaa.budgetarySupport * 1.2
      };

      // Build the table structure
      const tableData = [
        // A. SOURCE OF FUNDS
        {
          particular: 'A. SOURCE OF FUNDS',
          isHeader: true
        },
        {
          particular: '1. CORPORATE INCOME',
          [`${pastYears[2]} GAA`]: gaa[2].income,
          [`${pastYears[2]} OBLIGATION`]: gaa[2].income, // Assuming obligation = GAA for now
          [`${pastYears[1]} GAA`]: gaa[1].income,
          [`${pastYears[1]} OBLIGATION`]: gaa[1].income,
          [`${pastYears[0]} GAA`]: gaa[0].income,
          [`${pastYears[0]} OBLIGATION`]: gaa[0].income,
          '120% OF 3 YEARS AVERAGE GAA': ceiling120.income,
          'WHICHEVER IS LOWER BETWEEN PROPOSAL AND AVERAGE': Math.min(current.income, avgGaa.income),
          'OBLIGATION': current.income
        },
        {
          particular: '2. BUDGETARY SUPPORT',
          [`${pastYears[2]} GAA`]: gaa[2].budgetarySupport,
          [`${pastYears[2]} OBLIGATION`]: gaa[2].budgetarySupport,
          [`${pastYears[1]} GAA`]: gaa[1].budgetarySupport,
          [`${pastYears[1]} OBLIGATION`]: gaa[1].budgetarySupport,
          [`${pastYears[0]} GAA`]: gaa[0].budgetarySupport,
          [`${pastYears[0]} OBLIGATION`]: gaa[0].budgetarySupport,
          '120% OF 3 YEARS AVERAGE GAA': ceiling120.budgetarySupport,
          'WHICHEVER IS LOWER BETWEEN PROPOSAL AND AVERAGE': Math.min(current.budgetarySupport, avgGaa.budgetarySupport),
          'OBLIGATION': current.budgetarySupport
        },
        {
          particular: 'TOTAL SOURCES OF FUNDS',
          [`${pastYears[2]} GAA`]: gaa[2].income + gaa[2].budgetarySupport,
          [`${pastYears[2]} OBLIGATION`]: gaa[2].income + gaa[2].budgetarySupport,
          [`${pastYears[1]} GAA`]: gaa[1].income + gaa[1].budgetarySupport,
          [`${pastYears[1]} OBLIGATION`]: gaa[1].income + gaa[1].budgetarySupport,
          [`${pastYears[0]} GAA`]: gaa[0].income + gaa[0].budgetarySupport,
          [`${pastYears[0]} OBLIGATION`]: gaa[0].income + gaa[0].budgetarySupport,
          '120% OF 3 YEARS AVERAGE GAA': ceiling120.income + ceiling120.budgetarySupport,
          'WHICHEVER IS LOWER BETWEEN PROPOSAL AND AVERAGE': Math.min(current.income + current.budgetarySupport, avgGaa.income + avgGaa.budgetarySupport),
          'OBLIGATION': current.income + current.budgetarySupport
        },
        // B. USES OF FUNDS
        {
          particular: 'B. USES OF FUNDS CURRENT OPERATING EXPENDITURES',
          isHeader: true
        },
        {
          particular: '1. PERSONNEL SERVICES',
          [`${pastYears[2]} GAA`]: gaa[2].personnel,
          [`${pastYears[2]} OBLIGATION`]: gaa[2].personnel,
          [`${pastYears[1]} GAA`]: gaa[1].personnel,
          [`${pastYears[1]} OBLIGATION`]: gaa[1].personnel,
          [`${pastYears[0]} GAA`]: gaa[0].personnel,
          [`${pastYears[0]} OBLIGATION`]: gaa[0].personnel,
          '120% OF 3 YEARS AVERAGE GAA': ceiling120.personnel,
          'WHICHEVER IS LOWER BETWEEN PROPOSAL AND AVERAGE': Math.min(current.personnel, avgGaa.personnel),
          'OBLIGATION': current.personnel
        },
        {
          particular: '2. MOOE',
          [`${pastYears[2]} GAA`]: gaa[2].mooe,
          [`${pastYears[2]} OBLIGATION`]: gaa[2].mooe,
          [`${pastYears[1]} GAA`]: gaa[1].mooe,
          [`${pastYears[1]} OBLIGATION`]: gaa[1].mooe,
          [`${pastYears[0]} GAA`]: gaa[0].mooe,
          [`${pastYears[0]} OBLIGATION`]: gaa[0].mooe,
          '120% OF 3 YEARS AVERAGE GAA': ceiling120.mooe,
          'WHICHEVER IS LOWER BETWEEN PROPOSAL AND AVERAGE': Math.min(current.mooe, avgGaa.mooe),
          'OBLIGATION': current.mooe
        },
        {
          particular: '3. CAPITAL OUTLAY',
          [`${pastYears[2]} GAA`]: gaa[2].capital,
          [`${pastYears[2]} OBLIGATION`]: gaa[2].capital,
          [`${pastYears[1]} GAA`]: gaa[1].capital,
          [`${pastYears[1]} OBLIGATION`]: gaa[1].capital,
          [`${pastYears[0]} GAA`]: gaa[0].capital,
          [`${pastYears[0]} OBLIGATION`]: gaa[0].capital,
          '120% OF 3 YEARS AVERAGE GAA': ceiling120.capital,
          'WHICHEVER IS LOWER BETWEEN PROPOSAL AND AVERAGE': Math.min(current.capital, avgGaa.capital),
          'OBLIGATION': current.capital
        },
        {
          particular: 'TOTAL USES OF FUNDS',
          [`${pastYears[2]} GAA`]: gaa[2].personnel + gaa[2].mooe + gaa[2].capital,
          [`${pastYears[2]} OBLIGATION`]: gaa[2].personnel + gaa[2].mooe + gaa[2].capital,
          [`${pastYears[1]} GAA`]: gaa[1].personnel + gaa[1].mooe + gaa[1].capital,
          [`${pastYears[1]} OBLIGATION`]: gaa[1].personnel + gaa[1].mooe + gaa[1].capital,
          [`${pastYears[0]} GAA`]: gaa[0].personnel + gaa[0].mooe + gaa[0].capital,
          [`${pastYears[0]} OBLIGATION`]: gaa[0].personnel + gaa[0].mooe + gaa[0].capital,
          '120% OF 3 YEARS AVERAGE GAA': ceiling120.personnel + ceiling120.mooe + ceiling120.capital,
          'WHICHEVER IS LOWER BETWEEN PROPOSAL AND AVERAGE': Math.min(current.personnel + current.mooe + current.capital, avgGaa.personnel + avgGaa.mooe + avgGaa.capital),
          'OBLIGATION': current.personnel + current.mooe + current.capital
        },
        // SURPLUS/DEFECIT
        {
          particular: 'SURPLUS/DEFECIT',
          [`${pastYears[2]} GAA`]: (gaa[2].income + gaa[2].budgetarySupport) - (gaa[2].personnel + gaa[2].mooe + gaa[2].capital),
          [`${pastYears[2]} OBLIGATION`]: (gaa[2].income + gaa[2].budgetarySupport) - (gaa[2].personnel + gaa[2].mooe + gaa[2].capital),
          [`${pastYears[1]} GAA`]: (gaa[1].income + gaa[1].budgetarySupport) - (gaa[1].personnel + gaa[1].mooe + gaa[1].capital),
          [`${pastYears[1]} OBLIGATION`]: (gaa[1].income + gaa[1].budgetarySupport) - (gaa[1].personnel + gaa[1].mooe + gaa[1].capital),
          [`${pastYears[0]} GAA`]: (gaa[0].income + gaa[0].budgetarySupport) - (gaa[0].personnel + gaa[0].mooe + gaa[0].capital),
          [`${pastYears[0]} OBLIGATION`]: (gaa[0].income + gaa[0].budgetarySupport) - (gaa[0].personnel + gaa[0].mooe + gaa[0].capital),
          '120% OF 3 YEARS AVERAGE GAA': (ceiling120.income + ceiling120.budgetarySupport) - (ceiling120.personnel + ceiling120.mooe + ceiling120.capital),
          'WHICHEVER IS LOWER BETWEEN PROPOSAL AND AVERAGE': Math.min((current.income + current.budgetarySupport) - (current.personnel + current.mooe + current.capital), (avgGaa.income + avgGaa.budgetarySupport) - (avgGaa.personnel + avgGaa.mooe + avgGaa.capital)),
          'OBLIGATION': (current.income + current.budgetarySupport) - (current.personnel + current.mooe + current.capital)
        }
      ];

      return tableData;
    };

    const comparativeData = buildComparativeData();

    res.json({
      success: true,
      data: comparativeData,
      metadata: {
        region,
        currentFiscalYear,
        pastYears,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching comparative report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch comparative report',
      error: error.message
    });
  }
});

module.exports = router;
