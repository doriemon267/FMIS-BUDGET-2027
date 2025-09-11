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
    
    // Apply sophisticated hierarchical filtering based on user access scope
    const accessScope = req.hierarchicalAccess?.scope;
    const accessibleRegionName = req.hierarchicalAccess?.accessibleRegions?.[0]?.regionName;

    // Add region filter based on access scope
    if (accessScope && accessScope !== 'FULL' && accessibleRegionName) {
      query.region = accessibleRegionName;
    }

    // Add finer filters based on access scope
    if (accessScope === 'DIVISION') {
      // Division users: only their division within their department and region
      const deptName = req.hierarchicalAccess?.accessibleDepartments?.[0]?.departmentName;
      const divName = req.hierarchicalAccess?.accessibleDivisions?.[0];
      if (deptName) query.department = deptName;
      if (divName) query.division = divName;
    } else if (accessScope === 'DEPARTMENT') {
      // Department users: all divisions within their department in the region
      const deptName = req.hierarchicalAccess?.accessibleDepartments?.[0]?.departmentName;
      if (deptName) query.department = deptName;
    } else if (accessScope === 'REGION') {
      // Region-level users should ONLY see:
      // 1. Records that don't have department field (already consolidated to region level)
      // 2. Department records that are properly submitted/approved ONLY
      // BUT NOT current working drafts of departments
      query.$or = [
        // Option 1: Consolidated records (no department info)
        { 'department': { $exists: false } },
        { 'department': null },
        { 'department': '' },
        // Option 2: Department records that are submitted/approved ONLY
        { 
          $and: [
            { 'department': { $exists: true, $ne: null, $ne: '' } },
            { 'status': { $in: ['Department Submitted', 'Region Verified', 'Approved', 'Finalized'] } }
          ]
        }
      ];
    }
    
    // Fallback region filter if provided and not already constrained
    if (region && !query.region) {
      query.region = region;
    }

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
    console.log('Calculating budgetary support with params:', { fiscalYear, budgetType });
    console.log('User hierarchical access:', req.hierarchicalAccess);

    let totalSubsidy = 0;
    let breakdown = [];

    // Apply hierarchical filtering based on user access scope
    const accessScope = req.hierarchicalAccess?.scope;
    const accessibleRegionName = req.hierarchicalAccess?.accessibleRegions?.[0]?.regionName;

    // Build query conditions with hierarchical filtering
    const queryConditions = {};
    if (fiscalYear) queryConditions.fiscalYear = fiscalYear;
    if (budgetType) queryConditions.budgetType = budgetType;

    // Add hierarchical filters based on access scope
    if (accessScope === 'DIVISION') {
      // Division users: only their division within their department and region
      const deptName = req.hierarchicalAccess?.accessibleDepartments?.[0]?.departmentName;
      const divName = req.hierarchicalAccess?.accessibleDivisions?.[0];
      queryConditions.region = accessibleRegionName;
      if (deptName) queryConditions.department = deptName;
      if (divName) queryConditions.division = divName;
    } else if (accessScope === 'DEPARTMENT') {
      // Department users: all divisions within their department in the region (ALL STATUSES)
      const deptName = req.hierarchicalAccess?.accessibleDepartments?.[0]?.departmentName;
      queryConditions.region = accessibleRegionName;
      if (deptName) queryConditions.department = deptName;
      // Department users see ALL their data regardless of status (working data)
    } else if (accessScope === 'REGION') {
      // Region users: only properly submitted/approved data from departments
      queryConditions.$and = [
        { region: accessibleRegionName },
        {
          $or: [
            // Option 1: Consolidated records (no department info)
            { department: { $exists: false } },
            { department: null },
            { department: "" },
            // Option 2: Department records that are submitted/approved ONLY
            { 
              $and: [
                { department: { $exists: true, $ne: null, $ne: "" } },
                { status: { $in: ['Department Submitted', 'Region Verified', 'Approved', 'Finalized'] } }
              ]
            }
          ]
        }
      ];
    } else if (accessScope && accessScope !== 'FULL' && accessibleRegionName) {
      queryConditions.region = accessibleRegionName;
    }

    console.log('Applied query conditions:', JSON.stringify(queryConditions, null, 2));

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

    // 3. MOOE Data (B.1.2) - Use subsidy field with simplified hierarchical filtering
    try {
      // Build MOOE-specific query conditions
      const mooeQueryConditions = {};
      if (fiscalYear) mooeQueryConditions.fiscalYear = fiscalYear;
      if (budgetType) mooeQueryConditions.budgetType = budgetType;

      // Apply MOOE-specific hierarchical filters
      if (accessScope === 'DIVISION') {
        const deptName = req.hierarchicalAccess?.accessibleDepartments?.[0]?.departmentName;
        const divName = req.hierarchicalAccess?.accessibleDivisions?.[0];
        mooeQueryConditions.region = accessibleRegionName;
        if (deptName) mooeQueryConditions.department = deptName;
        if (divName) mooeQueryConditions.division = divName;
      } else if (accessScope === 'DEPARTMENT') {
        const deptName = req.hierarchicalAccess?.accessibleDepartments?.[0]?.departmentName;
        mooeQueryConditions.region = accessibleRegionName;
        if (deptName) mooeQueryConditions.department = deptName;
        // Department users see ALL their MOOE data regardless of status
      } else if (accessScope === 'REGION') {
        mooeQueryConditions.region = accessibleRegionName;
        // Region users only see submitted/approved MOOE data
        mooeQueryConditions.status = { $in: ['Department Submitted', 'Region Verified', 'Approved', 'Finalized'] };
      } else if (accessScope && accessScope !== 'FULL' && accessibleRegionName) {
        mooeQueryConditions.region = accessibleRegionName;
      }

      console.log('MOOE query conditions:', JSON.stringify(mooeQueryConditions, null, 2));

      const mooeData = await mooeProposals.find(mooeQueryConditions);
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
        console.log(`✅ MOOE subsidy: ₱${mooeTotal.toLocaleString()} (${mooeData.length} records)`);
      } else {
        console.log(`❌ No MOOE subsidy found (${mooeData.length} records found but total=0)`);
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


