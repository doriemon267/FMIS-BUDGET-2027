const mongoose = require('mongoose');
const BudgetarySupport = require('../models/BudgetarySupport');
const PersonnelServices = require('../models/PersonnelServices');
const CapitalOutlay = require('../models/CapitalOutlay');
const mooeProposals = require('../models/mooeProposals');
const IAsOMCost = require('../models/IAsOMCost');
const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
// Get all budgetary support entries
const getAllBudgetarySupport = async (req, res) => {
  try {
    const { fiscalYear, budgetType, region } = req.query;
    let query = {};
    if (fiscalYear) query.fiscalYear = fiscalYear;
    if (budgetType) query.budgetType = budgetType;
    // Apply submission workflow filtering - this ensures proper data isolation
    // Division users: only their own data
    // Department users: only SUBMITTED division data + their own department data  
    // Region users: only SUBMITTED department data + their own region data
    
    // Apply hierarchical filtering with basic department-division isolation
    // For now, use simple hierarchical filtering until submission workflow is fully implemented
    if (req.submissionWorkflowFilters) {
      // Use submission workflow filters (preferred approach)
      // Properly merge with existing query conditions
      const existingConditions = { ...query };
      const submissionFilters = req.submissionWorkflowFilters;

      console.log('Budgetary Support Debug - Using submission workflow filters:', {
        existingConditions,
        submissionFilters,
        userLevel: req.hierarchicalAccessInfo?.scope
      });

      // If submission filters have $and, merge properly
      if (submissionFilters.$and) {
        // Create proper $and array by combining existing conditions with submission filters
        const conditions = [];

        // Add existing conditions if they exist - properly expand them
        if (Object.keys(existingConditions).length > 0) {
          // Convert existing conditions to individual condition objects
          Object.entries(existingConditions).forEach(([key, value]) => {
            conditions.push({ [key]: value });
          });
        }

        // Add submission workflow conditions
        conditions.push(...submissionFilters.$and);

        query = { $and: conditions };
      } else {
        // Simple merge for non-$and filters
        query = { ...existingConditions, ...submissionFilters };
      }

      console.log('Budgetary Support Debug - Final query:', query);
    } else if (req.hierarchicalAccess) {
      const accessInfo = req.hierarchicalAccess;
      
      if (accessInfo?.scope === 'DIVISION') {
        // Division users: only their division data
        if (accessInfo.accessibleRegions?.[0]?.regionName) query.region = accessInfo.accessibleRegions[0].regionName;
        if (accessInfo.accessibleDepartments?.[0]?.departmentName) query.department = accessInfo.accessibleDepartments[0].departmentName;
        if (accessInfo.accessibleDivisions?.[0]) query.division = accessInfo.accessibleDivisions[0];
      } else if (accessInfo?.scope === 'DEPARTMENT') {
        // Department users: can see their department data + SUBMITTED division data ONLY
        if (accessInfo.accessibleRegions?.[0]?.regionName) {
          query = {
            $and: [
              { region: accessInfo.accessibleRegions[0].regionName },
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
        } else {
          // Fallback if no region info
          query = {
            $or: [
              {
                $and: [
                  { $or: [{ division: { $exists: false } }, { division: null }, { division: "" }] }
                ]
              },
              {
                $and: [
                  { division: { $exists: true, $ne: null, $ne: "" } },
                  { status: { $in: ["Submitted", "Approved", "Completed"] } }
                ]
              }
            ]
          };
        }
        if (accessInfo.accessibleDepartments?.[0]?.departmentName) {
          // Add department constraint to existing query
          if (query.$and) {
            query.$and.push({ department: accessInfo.accessibleDepartments[0].departmentName });
          } else {
            query = { ...query, department: accessInfo.accessibleDepartments[0].departmentName };
          }
        }
      } else if (accessInfo?.scope === 'REGION') {
        // Region users: only see department-level consolidated data (no division data)
        if (accessInfo.accessibleRegions?.[0]?.regionName) {
          query = {
            $and: [
              { region: accessInfo.accessibleRegions[0].regionName },
              {
                $or: [
                  { department: { $exists: false } },
                  { department: null },
                  { department: "" }
                ]
              }
            ]
          };
        } else {
          query = {
            $or: [
              { department: { $exists: false } },
              { department: null },
              { department: "" }
            ]
          };
        }
      } else if (accessInfo?.accessibleRegions?.[0]?.regionName) {
        query.region = accessInfo.accessibleRegions[0].regionName;
      }
    }
    
    // Fallback region filter if provided and not already constrained
    if (region && !query.region) {
      query.region = region;
    }

    try {
      const data = await BudgetarySupport.find(query);
      return res.json(data);
    } catch (dbError) {
      console.error('Database query error in getAllBudgetarySupport:', {
        error: dbError.message,
        query: JSON.stringify(query, null, 2),
        stack: dbError.stack
      });
      return res.status(500).json({ 
        message: 'Database query failed', 
        error: dbError.message,
        query: query
      });
    }
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
    // Use submission workflow data if present
    const workflowData = req.submissionWorkflowData || {};
    const userLevel = workflowData.userLevel;
    // Normalize org fields; clear division for department-origin
    const region = workflowData.region ?? req.body.region;
    const department = workflowData.department ?? req.body.department;
    const division = userLevel === 'DEPARTMENT' ? null : (workflowData.division ?? req.body.division ?? null);
    // Determine level tagging
    const originalLevel = workflowData.originalLevel || (userLevel === 'DIVISION' ? 'DIVISION' : userLevel === 'DEPARTMENT' ? 'DEPARTMENT' : userLevel === 'REGION' ? 'REGION' : undefined);
    const workflowLevel = workflowData.workflowLevel || originalLevel;
    // Create entry data with required fields
    const entryData = { 
      ...req.body,
      region,
      department,
      division,
      originalLevel,
      workflowLevel,
      processDate: new Date(),
      status: req.body.status || "Draft"
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
    const workflowData = req.submissionWorkflowData || {};
    const userLevel = workflowData.userLevel;
    const region = workflowData.region ?? req.body.region;
    const department = workflowData.department ?? req.body.department;
    const division = userLevel === 'DEPARTMENT' ? null : (workflowData.division ?? req.body.division ?? null);
    const updateData = { 
      ...req.body,
      region,
      department,
      division,
      ...(workflowData.originalLevel ? { originalLevel: workflowData.originalLevel } : {}),
      ...(workflowData.workflowLevel ? { workflowLevel: workflowData.workflowLevel } : {}),
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
    let queryConditions = {};
    if (fiscalYear) queryConditions.fiscalYear = fiscalYear;
    if (budgetType) queryConditions.budgetType = budgetType;
    
    // Apply submission workflow filtering for proper data isolation
    // This ensures department users only see SUBMITTED division data, not draft data
    if (req.submissionWorkflowFilters) {
      // Use submission workflow filters (preferred approach)
      // Properly merge with existing query conditions
      const existingConditions = { ...queryConditions };
      const submissionFilters = req.submissionWorkflowFilters;

      // If submission filters have $and, merge properly
      if (submissionFilters.$and) {
        // Create proper $and array by combining existing conditions with submission filters
        const conditions = [];

        // Add existing conditions if they exist - properly expand them
        if (Object.keys(existingConditions).length > 0) {
          // Convert existing conditions to individual condition objects
          Object.entries(existingConditions).forEach(([key, value]) => {
            conditions.push({ [key]: value });
          });
        }

        // Add submission workflow conditions
        conditions.push(...submissionFilters.$and);

        queryConditions = { $and: conditions };
      } else {
        // Simple merge for non-$and filters
        queryConditions = { ...existingConditions, ...submissionFilters };
      }

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
        if (accessInfo.accessibleRegions?.[0]?.regionName) {
          queryConditions.$and = [
            { region: accessInfo.accessibleRegions[0].regionName },
            {
              $or: [
                { originalLevel: 'DEPARTMENT' }, // Own department-level data
                {
                  $and: [
                    { originalLevel: 'DIVISION' },
                    { status: { $in: ['Submitted', 'Approved'] } } // Only SUBMITTED division data
                  ]
                }
              ]
            }
          ];
        } else {
          // Fallback if no region info
          queryConditions.$or = [
            { originalLevel: 'DEPARTMENT' },
            {
              $and: [
                { originalLevel: 'DIVISION' },
                { status: { $in: ['Submitted', 'Approved'] } }
              ]
            }
          ];
        }
        if (accessInfo.accessibleDepartments?.[0]?.departmentName) queryConditions.department = accessInfo.accessibleDepartments[0].departmentName;
      } else if (accessInfo?.scope === 'REGION') {
        // Region users: only submitted department/division data + own region data
        if (accessInfo.accessibleRegions?.[0]?.regionName) {
          queryConditions.$and = [
            { region: accessInfo.accessibleRegions[0].regionName },
            {
              $or: [
                { originalLevel: 'REGION' }, // Own region-level data
                {
                  $and: [
                    { originalLevel: { $in: ['DEPARTMENT', 'DIVISION'] } },
                    { status: { $in: ['Submitted', 'Approved'] } } // Only submitted lower-level data
                  ]
                }
              ]
            }
          ];
        } else {
          // Fallback if no region info
          queryConditions.$or = [
            { originalLevel: 'REGION' },
            {
              $and: [
                { originalLevel: { $in: ['DEPARTMENT', 'DIVISION'] } },
                { status: { $in: ['Submitted', 'Approved'] } }
              ]
            }
          ];
        }
      } else if (accessInfo?.accessibleRegions?.[0]?.regionName) {
        queryConditions.region = accessInfo.accessibleRegions[0].regionName;
      }
    }
    // Personnel Services: use SAME scope as Comprehensive Reports / Personnel Services table
    // (Same query logic as buildComprehensiveReportData PS query - no budgetType, no submission status)
    const personnelQueryConditions = {};
    if (fiscalYear) personnelQueryConditions.fiscalYear = String(fiscalYear);
    personnelQueryConditions.chargedToIncomeEligible = false;

    // Region/scope: mirror Comprehensive Reports - support regions or region from query, then hierarchical
    const regionsParam = req.query.regions ?? req.query.region;
    let regionList = [];
    if (regionsParam) {
      regionList = Array.isArray(regionsParam) ? regionsParam : [regionsParam];
      regionList = regionList.map(r => (r && String(r).trim())).filter(Boolean);
    }
    if (regionList.length > 0) {
      personnelQueryConditions.region = regionList.length === 1 ? regionList[0] : { $in: regionList };
    } else {
      const accessInfo = req.hierarchicalAccessInfo;
      if (accessInfo?.accessibleRegions?.length) {
        const names = accessInfo.accessibleRegions.map(r => r.regionName || r).filter(Boolean);
        if (names.length === 1) personnelQueryConditions.region = names[0];
        else if (names.length > 1) personnelQueryConditions.region = { $in: names };
      }
      if (accessInfo?.scope === 'DIVISION') {
        if (accessInfo.accessibleDepartments?.[0]?.departmentName) personnelQueryConditions.department = accessInfo.accessibleDepartments[0].departmentName;
        if (accessInfo.accessibleDivisions?.[0]) personnelQueryConditions.division = accessInfo.accessibleDivisions[0];
      } else if (accessInfo?.scope === 'DEPARTMENT' && accessInfo.accessibleDepartments?.[0]?.departmentName) {
        personnelQueryConditions.department = accessInfo.accessibleDepartments[0].departmentName;
      }
    }

    // Preparer scope: same as Comprehensive Reports - restrict to assigned division/department
    const userRoles = req.user?.Roles || [];
    const isPreparer = userRoles.some(r => (r && String(r).replace(/\s+/g, '_')) === 'BUDGET_PREPARER') ||
      userRoles.some(r => (r && String(r).replace(/\s+/g, ' ').trim()) === 'BUDGET PREPARER');
    if (isPreparer && req.user?.id) {
      try {
        const hua = await HierarchicalUserAssignment.findOne({ userId: String(req.user.id), isActive: true })
          .populate('departmentId', 'Department departmentName DepartmentName')
          .lean();
        if (hua) {
          const level = String(hua.assignmentLevel || '').toUpperCase();
          const dept = hua.departmentId?.Department || hua.departmentId?.departmentName || hua.departmentId?.DepartmentName || '';
          if (level === 'DIVISION' && (hua.divisionName || hua.division)) {
            personnelQueryConditions.division = hua.divisionName || hua.division;
          } else if ((level === 'DEPARTMENT' || level === 'OFFICE') && dept) {
            personnelQueryConditions.department = dept;
          }
        }
      } catch (_) { /* ignore */ }
    }

    // 1. Personnel Services (B.1.1) - SPLIT: GOVERNMENT SUBSIDY vs CHARGED TO INCOME
    let totalChargedToIncome = 0;
    try {
      const personnelServices = await PersonnelServices.find(personnelQueryConditions);

      const { roundTo2Decimals } = require('../utils/roundCurrency');
      const personnelTotal = roundTo2Decimals(personnelServices.reduce((sum, item) => {
        // CRITICAL: Only count PS that are NOT charged to income
        if (item.chargedToIncomeEligible === true) {
          totalChargedToIncome += (Number(item.Total) || 0);
          return sum; // Skip - this is charged to income
        }
        return sum + (Number(item.Total) || Number(item.annualSalary) || Number(item.total) || 0);
      }, 0));

      if (personnelTotal > 0) {
        totalSubsidy += personnelTotal;
        breakdown.push({
          source: 'B.1.1 - Personnel Services',
          amount: personnelTotal,
          description: 'Government funding for personnel services (subsidy portion)'
        });
      } else {
      }
    } catch (error) {
      console.error('Personnel Services query error:', {
        error: error.message,
        stack: error.stack,
        query: JSON.stringify(personnelQueryConditions, null, 2)
      });
      console.warn('Personnel Services not available, continuing with other sources');
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
      } else {
      }
    } catch (error) {
      console.error('Capital Outlay query error:', {
        error: error.message,
        stack: error.stack,
        query: JSON.stringify(queryConditions, null, 2)
      });
      console.warn('Capital Outlay not available, continuing with other sources');
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
        // Add to income tracking
        totalChargedToIncome += (Number(item.income) || 0);
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
      }
    } catch (error) {
      console.error('MOOE Data query error:', {
        error: error.message,
        stack: error.stack,
        query: JSON.stringify(mooeQueryConditions, null, 2)
      });
      console.warn('MOOE Data not available, continuing with other sources');
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
        } else {
        }
      } else {
      }
    } catch (error) {
      console.error('IAs O&M Cost query error:', {
        error: error.message,
        stack: error.stack,
        query: JSON.stringify(queryConditions, null, 2)
      });
      console.warn('IAs O&M Cost not available, continuing with other sources');
    }

    // Log detailed subsidy composition
    console.log(`📊 [calculateBudgetarySupport] Subsidy Composition for FY=${fiscalYear}, BudgetType=${budgetType}:`, {
      'B.1.1 Personnel Services (non-charged)': breakdown.find(b => b.source.includes('Personnel Services'))?.amount || 0,
      'B.1.2 MOOE Subsidy': breakdown.find(b => b.source.includes('MOOE'))?.amount || 0,
      'B.2 Capital Outlay': breakdown.find(b => b.source.includes('Capital Outlay'))?.amount || 0,
      'Charged-to-Income Amount': totalChargedToIncome,
      '─────────────────────────': '',
      'TOTAL PROJECTED SUBSIDY': totalSubsidy,
      'TOTAL CHARGED TO INCOME': totalChargedToIncome,
      'TOTAL BUDGET': totalSubsidy + totalChargedToIncome
    });

    res.json({
      totalSubsidy,
      totalChargedToIncome,
      totalBudget: totalSubsidy + totalChargedToIncome,
      breakdown,
      fiscalYear,
      budgetType,
      region,
      calculatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('=== CALCULATE BUDGETARY SUPPORT ERROR ===');
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
