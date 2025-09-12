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
    const query = {};
    if (fiscalYear) query.fiscalYear = fiscalYear;
    if (budgetType) query.budgetType = budgetType;
    // Apply submission workflow filtering - this ensures proper data isolation
    // Division users: only their own data
    // Department users: only SUBMITTED division data + their own department data  
    // Region users: only SUBMITTED department data + their own region data
    
    // Apply hierarchical filtering with basic department-division isolation
    // For now, use simple hierarchical filtering until submission workflow is fully implemented
    if (req.hierarchicalAccess) {
      const accessInfo = req.hierarchicalAccess;
      
      if (accessInfo?.scope === 'DIVISION') {
        // Division users: only their division data
        if (accessInfo.accessibleRegions?.[0]?.regionName) query.region = accessInfo.accessibleRegions[0].regionName;
        if (accessInfo.accessibleDepartments?.[0]?.departmentName) query.department = accessInfo.accessibleDepartments[0].departmentName;
        if (accessInfo.accessibleDivisions?.[0]) query.division = accessInfo.accessibleDivisions[0];
      } else if (accessInfo?.scope === 'DEPARTMENT') {
        // Department users: can see their department data + SUBMITTED division data ONLY
        if (accessInfo.accessibleRegions?.[0]?.regionName) query.region = accessInfo.accessibleRegions[0].regionName;
        if (accessInfo.accessibleDepartments?.[0]?.departmentName) query.department = accessInfo.accessibleDepartments[0].departmentName;
        
        // CRITICAL SUBMISSION WORKFLOW LOGIC:
        // Department users can only see division data that has been SUBMITTED
        const baseQuery = {
          region: accessInfo.accessibleRegions[0]?.regionName,
          department: accessInfo.accessibleDepartments[0]?.departmentName
        };
        
        query = {
          $and: [
            baseQuery,
            {
              $or: [
                // 1. Department-level data (no division or by department user)
                {
                  $and: [
                    { $or: [{ division: { $exists: false } }, { division: null }, { division: "" }] }
                  ]
                },
                // 2. Division data that has been SUBMITTED only
                {
                  $and: [
                    { division: { $exists: true, $ne: null, $ne: "" } },
                    { status: { $in: ["Submitted", "Approved", "Completed"] } }
                  ]
                }
              ]
            }
          ]
        };
      } else if (accessInfo?.scope === 'REGION') {
        // Region users: only see department-level consolidated data (no division data)
        if (accessInfo.accessibleRegions?.[0]?.regionName) query.region = accessInfo.accessibleRegions[0].regionName;
        
        // CRITICAL: Only show consolidated data without department/division details
        query.$and = [
          { region: accessInfo.accessibleRegions[0].regionName },
          {
            $or: [
              { department: { $exists: false } },
              { department: null },
              { department: "" }
            ]
          }
        ];
      } else if (accessInfo?.accessibleRegions?.[0]?.regionName) {
        query.region = accessInfo.accessibleRegions[0].regionName;
      }
    }
    
    // Fallback region filter if provided and not already constrained
    if (region && !query.region) {
      query.region = region;
    }
    const data = await BudgetarySupport.find(query);
    return res.json(data);
  } catch (error) {
    console.error('Error in getAllBudgetarySupport:', error);
    res.status(500).json({ message: error.message });
  }
};
// Get budgetary support by ID
const getBudgetarySupportById = async (req, res) => {
  try {
    const { id } = req.params;
    // const data = await BudgetarySupport.findById(id);
    if (!data) {
      return res.status(404).json({ message: 'Budgetary support entry not found' });
    }
    // res.json(data);
  } catch (error) {
    console.error('Error in getBudgetarySupportById:', error);
    res.status(500).json({ message: error.message });
  }
};
// Create new budgetary support entry
const createBudgetarySupport = async (req, res) => {
  try {
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
    const deletedEntry = await BudgetarySupport.findByIdAndDelete(id);
    if (!deletedEntry) {
      return res.status(404).json({ message: 'Entry not found' });
    }
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
    let totalSubsidy = 0;
    let breakdown = [];
    // Build base query conditions
    const queryConditions = {};
    if (fiscalYear) queryConditions.fiscalYear = fiscalYear;
    if (budgetType) queryConditions.budgetType = budgetType;
    
    // Apply submission workflow filtering for proper data isolation
    // This ensures department users only see SUBMITTED division data, not draft data
    if (req.submissionWorkflowFilters) {
      // Use submission workflow filters (preferred approach)
      Object.assign(queryConditions, req.submissionWorkflowFilters);
    } else {
      // Fallback to hierarchical access info with submission workflow logic
      const accessInfo = req.hierarchicalAccessInfo;
      if (accessInfo?.scope === 'DIVISION') {
        // Division users: only their division data
        if (accessInfo.accessibleRegions?.[0]?.regionName) queryConditions.region = accessInfo.accessibleRegions[0].regionName;
        if (accessInfo.accessibleDepartments?.[0]?.departmentName) queryConditions.department = accessInfo.accessibleDepartments[0].departmentName;
        if (accessInfo.accessibleDivisions?.[0]) queryConditions.division = accessInfo.accessibleDivisions[0];
      } else if (accessInfo?.scope === 'DEPARTMENT') {
        // Department users: ONLY submitted division data + own department data
        if (accessInfo.accessibleRegions?.[0]?.regionName) queryConditions.region = accessInfo.accessibleRegions[0].regionName;
        if (accessInfo.accessibleDepartments?.[0]?.departmentName) queryConditions.department = accessInfo.accessibleDepartments[0].departmentName;
        // CRITICAL FIX: Add submission workflow filtering for department users
        queryConditions.$or = [
          { originalLevel: 'DEPARTMENT' }, // Own department-level data
          { 
            $and: [
              { originalLevel: 'DIVISION' },
              { status: { $in: ['Submitted', 'Approved'] } } // Only SUBMITTED division data
            ]
          }
        ];
      } else if (accessInfo?.scope === 'REGION') {
        // Region users: only submitted department/division data + own region data
        if (accessInfo.accessibleRegions?.[0]?.regionName) queryConditions.region = accessInfo.accessibleRegions[0].regionName;
        queryConditions.$or = [
          { originalLevel: 'REGION' }, // Own region-level data
          { 
            $and: [
              { originalLevel: { $in: ['DEPARTMENT', 'DIVISION'] } },
              { status: { $in: ['Submitted', 'Approved'] } } // Only submitted lower-level data
            ]
          }
        ];
      } else if (accessInfo?.accessibleRegions?.[0]?.regionName) {
        queryConditions.region = accessInfo.accessibleRegions[0].regionName;
      }
    }
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
      }
    } catch (error) {
      console.warn('Capital Outlay not available:', error.message);
    }
    // 3. MOOE Data (B.1.2) - Use subsidy field with simplified hierarchical filtering
    try {
      // Build MOOE-specific query conditions with submission workflow filtering
      const mooeQueryConditions = {};
      if (fiscalYear) mooeQueryConditions.fiscalYear = fiscalYear;
      if (budgetType) mooeQueryConditions.budgetType = budgetType;
      
      // Apply same submission workflow filtering for MOOE data
      if (req.submissionWorkflowFilters) {
        Object.assign(mooeQueryConditions, req.submissionWorkflowFilters);
      } else {
        const accessInfo = req.hierarchicalAccessInfo;
        if (accessInfo?.scope === 'DIVISION') {
          // Division users: only their division MOOE data
          if (accessInfo.accessibleRegions?.[0]?.regionName) mooeQueryConditions.region = accessInfo.accessibleRegions[0].regionName;
          if (accessInfo.accessibleDepartments?.[0]?.departmentName) mooeQueryConditions.department = accessInfo.accessibleDepartments[0].departmentName;
          if (accessInfo.accessibleDivisions?.[0]) mooeQueryConditions.division = accessInfo.accessibleDivisions[0];
        } else if (accessInfo?.scope === 'DEPARTMENT') {
          // Department users: ONLY submitted division MOOE data + own department MOOE data
          if (accessInfo.accessibleRegions?.[0]?.regionName) mooeQueryConditions.region = accessInfo.accessibleRegions[0].regionName;
          if (accessInfo.accessibleDepartments?.[0]?.departmentName) mooeQueryConditions.department = accessInfo.accessibleDepartments[0].departmentName;
          // CRITICAL FIX: Apply submission workflow to MOOE as well
          mooeQueryConditions.$or = [
            { originalLevel: 'DEPARTMENT' }, // Own department MOOE data
            { 
              $and: [
                { originalLevel: 'DIVISION' },
                { status: { $in: ['Submitted', 'Approved'] } } // Only SUBMITTED division MOOE data
              ]
            }
          ];
        } else if (accessInfo?.scope === 'REGION') {
          // Region users: only submitted MOOE data from departments/divisions
          if (accessInfo.accessibleRegions?.[0]?.regionName) mooeQueryConditions.region = accessInfo.accessibleRegions[0].regionName;
          mooeQueryConditions.$or = [
            { originalLevel: 'REGION' }, // Own region MOOE data
            { 
              $and: [
                { originalLevel: { $in: ['DEPARTMENT', 'DIVISION'] } },
                { status: { $in: ['Submitted', 'Approved'] } } // Only submitted lower-level MOOE data
              ]
            }
          ];
        } else if (accessInfo?.accessibleRegions?.[0]?.regionName) {
          mooeQueryConditions.region = accessInfo.accessibleRegions[0].regionName;
        }
      }
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
      } else {
        // No MOOE data available
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
        }
      }
    } catch (error) {
      console.warn('IAs O&M Cost not available:', error.message);
    }
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
