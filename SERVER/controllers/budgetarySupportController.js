const mongoose = require('mongoose');
const BudgetarySupport = require('../models/BudgetarySupport');
const PersonnelServices = require('../models/personnelServices');
const CapitalOutlay = require('../models/CapitalOutlay');
const mooeProposals = require('../models/mooeProposals');
const IAsOMCost = require('../models/IAsOMCost');

// Get all budgetary support entries
const getAllBudgetarySupport = async (req, res) => {
  try {
    const { fiscalYear, budgetType, region } = req.query;
    // console.log('Fetching budgetary support with params:', { fiscalYear, budgetType, region });

    const query = {};
    if (fiscalYear) query.fiscalYear = fiscalYear;
    if (budgetType) query.budgetType = budgetType;
    if (region) query.region = region;

    const data = await BudgetarySupport.find(query);
    // console.log('Found data:', data);
    
    res.json(data);
  } catch (error) {
    console.error('Error in getAllBudgetarySupport:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get budgetary support by ID
const getBudgetarySupportById = async (req, res) => {
  try {
    const { id } = req.params;
    // console.log('Fetching budgetary support with ID:', id);

    const data = await BudgetarySupport.findById(id);
    if (!data) {
      return res.status(404).json({ message: 'Budgetary support entry not found' });
    }

    // console.log('Found data:', data);
    res.json(data);
  } catch (error) {
    console.error('Error in getBudgetarySupportById:', error);
    res.status(500).json({ message: error.message });
  }
};

// Create new budgetary support entry
const createBudgetarySupport = async (req, res) => {
  try {
    console.log('Creating budgetary support with data:', req.body);
    
    // Create entry data with required fields
    const entryData = { 
      ...req.body,
      processDate: new Date(),
      status: req.body.status || "Not Submitted"
    };
    
    // Only add createdBy if req.user exists and has a valid id
    if (req.user && req.user.id && mongoose.Types.ObjectId.isValid(req.user.id)) {
      entryData.createdBy = req.user.id;
    }
    
    const newEntry = new BudgetarySupport(entryData);
    const savedEntry = await newEntry.save();
    
    console.log('Created entry:', savedEntry);
    res.status(201).json(savedEntry);
  } catch (error) {
    console.error('Error in createBudgetarySupport:', error);
    res.status(400).json({ message: error.message });
  }
};

// Update budgetary support entry
const updateBudgetarySupport = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Updating budgetary support with ID:', id, 'Data:', req.body);
    
    // Create update data
    const updateData = { 
      ...req.body,
      processDate: req.body.processDate || new Date()
    };
    
    // Only add updatedBy if req.user exists and has a valid id
    if (req.user && req.user.id && mongoose.Types.ObjectId.isValid(req.user.id)) {
      updateData.updatedBy = req.user.id;
    }
    
    const updatedEntry = await BudgetarySupport.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );
    
    if (!updatedEntry) {
      return res.status(404).json({ message: 'Entry not found' });
    }
    
    console.log('Updated entry:', updatedEntry);
    res.json(updatedEntry);
  } catch (error) {
    console.error('Error in updateBudgetarySupport:', error);
    res.status(400).json({ message: error.message });
  }
};

// Delete budgetary support entry
const deleteBudgetarySupport = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Deleting budgetary support with ID:', id);
    
    const deletedEntry = await BudgetarySupport.findByIdAndDelete(id);
    
    if (!deletedEntry) {
      return res.status(404).json({ message: 'Entry not found' });
    }
    
    console.log('Deleted entry:', deletedEntry);
    res.json({ message: 'Entry deleted successfully' });
  } catch (error) {
    console.error('Error in deleteBudgetarySupport:', error);
    res.status(500).json({ message: error.message });
  }
};

// Calculate total budgetary support based on all subsidy sources
const calculateBudgetarySupport = async (req, res) => {
  try {
    const { fiscalYear, budgetType, region } = req.query;
    console.log('Calculating budgetary support with params:', { fiscalYear, budgetType, region });

    let totalSubsidy = 0;
    let breakdown = [];

    // Query conditions
    const queryConditions = {};
    if (fiscalYear) queryConditions.fiscalYear = fiscalYear;
    if (budgetType) queryConditions.budgetType = budgetType;
    if (region) queryConditions.region = region;

    // For PersonnelServices, use fiscal_year field as well
    const personnelQueryConditions = { ...queryConditions };
    if (fiscalYear) {
      personnelQueryConditions.fiscal_year = Number(fiscalYear);
    }

    // 1. Personnel Services (B.1.1) - ENTIRE AMOUNT IS GOVERNMENT SUBSIDY
    try {
      const personnelServices = await PersonnelServices.find(personnelQueryConditions);
      const personnelTotal = personnelServices.reduce((sum, item) => {
        return sum + (Number(item.Total) || Number(item.annualSalary) || Number(item.total) || 0);
      }, 0);
      
      if (personnelTotal > 0) {
        totalSubsidy += personnelTotal;
        breakdown.push({
          source: 'B.1.1 - Personnel Services',
          amount: personnelTotal,
          description: 'Government funding for all personnel services'
        });
        console.log(`✅ Personnel Services subsidy: ₱${personnelTotal.toLocaleString()}`);
      }
    } catch (error) {
      console.warn('Personnel Services not available:', error.message);
    }

    // 2. Capital Outlay (B.2) - ENTIRE AMOUNT IS TYPICALLY GOVERNMENT FUNDED
    try {
      const capitalOutlays = await CapitalOutlay.find(queryConditions);
      const capitalTotal = capitalOutlays.reduce((sum, item) => {
        return sum + (Number(item.subsidy) || Number(item.amount) || 0);
      }, 0);
      
      if (capitalTotal > 0) {
        totalSubsidy += capitalTotal;
        breakdown.push({
          source: 'B.2 - Capital Outlay',
          amount: capitalTotal,
          description: 'Government funding for capital expenditures'
        });
        console.log(`✅ Capital Outlay subsidy: ₱${capitalTotal.toLocaleString()}`);
      }
    } catch (error) {
      console.warn('Capital Outlay not available:', error.message);
    }

    // 3. MOOE Data (B.1.2) - Use subsidy field
    try {
      const mooeData = await mooeProposals.find(queryConditions);
      const mooeTotal = mooeData.reduce((sum, item) => {
        return sum + (Number(item.subsidy) || Number(item.totalSubsidy) || 0);
      }, 0);
      
      if (mooeTotal > 0) {
        totalSubsidy += mooeTotal;
        breakdown.push({
          source: 'B.1.2 - MOOE Regular',
          amount: mooeTotal,
          description: 'Government subsidy for maintenance and operating expenses'
        });
        console.log(`✅ MOOE subsidy: ₱${mooeTotal.toLocaleString()}`);
      }
    } catch (error) {
      console.warn('MOOE Data not available:', error.message);
    }

    // 4. IAs O&M Cost - Use subsidy fields
    try {
      const iasOMCost = await IAsOMCost.findOne(queryConditions);
      if (iasOMCost) {
        const iasTotal = (Number(iasOMCost.nisSubsidy) || 0) + (Number(iasOMCost.cisSubsidy) || 0);
        if (iasTotal > 0) {
          totalSubsidy += iasTotal;
          breakdown.push({
            source: 'IAs O&M Cost',
            amount: iasTotal,
            description: 'Government subsidy for Irrigation Associations O&M'
          });
          console.log(`✅ IAs O&M subsidy: ₱${iasTotal.toLocaleString()}`);
        }
      }
    } catch (error) {
      console.warn('IAs O&M Cost not available:', error.message);
    }

    console.log(`💰 Total Budgetary Support calculated: ₱${totalSubsidy.toLocaleString()}`);

    res.json({
      totalSubsidy,
      breakdown,
      fiscalYear,
      budgetType,
      region,
      calculatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in calculateBudgetarySupport:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAllBudgetarySupport,
  getBudgetarySupportById,
  createBudgetarySupport,
  updateBudgetarySupport,
  deleteBudgetarySupport,
  calculateBudgetarySupport
};


