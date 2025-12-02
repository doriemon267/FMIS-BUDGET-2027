const mongoose = require("mongoose");
const Income = require("../models/Income");
const Settings = require("../models/Settings");
const Proposal = require('../models/Proposal');
const ProposalEditLog = require('../models/ProposalEditLog');
const { recalculateAndSaveProposalTotals } = require('../utils/recalculateProposalTotals');
// Create new income entry
exports.createIncome = async (req, res) => {
  try {
    const {
      particulars,
      cost,
      incomecategory,
      subcategory,
      category,
      amount,
      fiscalYear,
      budgetType,
      region,
      department,
      division,
      processBy,
      processDate,
      proposalId,  // CRITICAL: Link to specific proposal to prevent cross-proposal data mixing
    } = req.body;
    // Validate required fields
    if (!particulars || !incomecategory || amount === undefined || amount === null) {
      return res.status(400).json({ 
        message: "Missing required fields", 
        details: "particulars, incomecategory, and amount are required" 
      });
    }
  // Get submission workflow data from middleware
  const workflowData = req.submissionWorkflowData || {};
    
    // Create new income entry with workflow data
    // CRITICAL: Ensure proposalId is always set to prevent cross-proposal data mixing
    let finalWorkflowId = proposalId || workflowData.proposalId; // This refers to NewProposalWorkflow _id
    let legacyProposalId = null;
    if (finalWorkflowId) {
      const legacy = await Proposal.findOne({ workflowRef: finalWorkflowId }).select('_id');
      if (legacy) {
        legacyProposalId = legacy._id;
      } else {
        console.warn('[createIncome] No legacy Proposal found for workflowRef:', finalWorkflowId);
      }
    } else {
      console.warn('[createIncome] Missing workflow proposalId in request; attempting inference');
      try {
        const activeSettings = await Settings.findOne({ isActive: true });
        const inferQuery = {
          fiscalYear: activeSettings?.fiscalYear ? String(activeSettings.fiscalYear) : fiscalYear,
          budgetType: activeSettings?.budgetType || budgetType,
          region: workflowData.region || region
        };
        Object.keys(inferQuery).forEach(k => inferQuery[k] === undefined && delete inferQuery[k]);
        const inferredLegacy = await Proposal.findOne(inferQuery).select('_id');
        if (inferredLegacy) {
          legacyProposalId = inferredLegacy._id;
          console.warn('[createIncome] Inferred legacy Proposal linkage:', legacyProposalId);
        } else {
          console.warn('[createIncome] Inference failed; entry remains unlinked');
        }
      } catch (infErr) {
        console.warn('[createIncome] Inference error:', infErr.message);
      }
    }

    const newIncome = new Income({
      particulars,
      cost: cost || amount,
      incomecategory,
      subcategory,
      category,
      amount: Number(amount),
      fiscalYear: fiscalYear || new Date().getFullYear().toString(),
      budgetType: budgetType || "REGULAR",
      region: workflowData.region || region,
      department: workflowData.department || department,
      division: workflowData.division || division,
  // Respect middleware-determined levels to avoid mislabeling department as division
  originalLevel: workflowData.originalLevel || 'DIVISION',
  workflowLevel: workflowData.workflowLevel || workflowData.originalLevel || 'DIVISION',
      processBy: processBy || req.user?.userName || req.user?.id,
      processDate: processDate || new Date(),
      status: workflowData.status || "Draft", // Use new workflow status
      proposalId: legacyProposalId ? legacyProposalId : undefined, // Link to legacy Proposal for aggregation
      workflowRef: finalWorkflowId ? new mongoose.Types.ObjectId(finalWorkflowId) : undefined // Link back to workflow
    });
    await newIncome.save();
    // Direct recompute for linked legacy proposal (more precise than key-based scan)
    if (legacyProposalId) {
      try {
        const proposalDoc = await Proposal.findById(legacyProposalId);
        await proposalDoc?.recomputeTotals();
      } catch (e) {
        console.warn('[createIncome] recomputeTotals failed', e.message);
      }
    }
    // Non-blocking: trigger Proposal totals recalculation for affected proposals
    try {
      const keys = {
        fiscalYear: newIncome.fiscalYear,
        budgetType: newIncome.budgetType,
        region: newIncome.region,
        processBy: newIncome.processBy
      };
      const strictQuery = {
        fiscalYear: keys.fiscalYear,
        budgetType: keys.budgetType,
        region: keys.region,
        ...(keys.processBy ? { processBy: keys.processBy } : {})
      };
      let proposals = await Proposal.find(strictQuery).select('_id').lean();
      if (!proposals.length) {
        const relaxedQuery = { fiscalYear: keys.fiscalYear, budgetType: keys.budgetType, region: keys.region };
        proposals = await Proposal.find(relaxedQuery).select('_id').lean();
      }
      if (proposals.length) {
        await Promise.allSettled(proposals.map(p => recalculateAndSaveProposalTotals({ proposalId: p._id })));
        console.log(`🔄 [Income] Recalculated totals for ${proposals.length} proposal(s)`, keys);
      }
    } catch (recErr) {
      console.warn('⚠️ [Income] Proposal totals recalculation skipped:', recErr?.message);
    }
    res.status(201).json(newIncome);
  } catch (error) {
    console.error("Error creating income entry:", error);
    res.status(500).json({ message: "Failed to create income entry", error: error.message });
  }
};
// Update income entry
exports.updateIncome = async (req, res) => {
  try {
    const {
      particulars,
      cost,
      incomecategory,
      subcategory,
      category,
      amount,
      region,
      department,
      division,
      processBy,
      processDate,
      status
    } = req.body;
    // Find active settings; if none, keep current record's FY/BT
    const activeSettings = await Settings.findOne({ isActive: true });
    const setFY = activeSettings?.fiscalYear;
    const setBT = activeSettings?.budgetType;
    
    // Get submission workflow data from middleware
    const workflowData = req.submissionWorkflowData || {};
    
    // First, find the income entry to check its status
    const existingIncome = await Income.findById(req.params.id);
    if (!existingIncome) {
      return res.status(404).json({ message: "Income entry not found" });
    }

    // Check if the record has been submitted and prevent editing
    const submittedStatuses = ["Submitted", "Division Submitted", "Department Verified", "Department Submitted", "Region Approved", "Finalized"];
    if (submittedStatuses.includes(existingIncome.status)) {
      return res.status(403).json({
        error: "Update not allowed",
        message: "Cannot edit income record that has been submitted or approved"
      });
    }

    // Find and update the income entry
    const updatedIncome = await Income.findByIdAndUpdate(
      req.params.id,
      {
        particulars,
        cost: cost || amount,
        incomecategory,
        subcategory,
        category,
        amount,
        ...(setFY ? { fiscalYear: setFY } : {}),
        ...(setBT ? { budgetType: setBT } : {}),
        region: workflowData.region || region,
        department: workflowData.department || department,
        division: workflowData.division || division,
        processBy: processBy || req.user?.userName || req.user?.id,
        processDate: processDate || new Date(),
        status: status || workflowData.status || "Draft",
        ...(workflowData.originalLevel ? { originalLevel: workflowData.originalLevel } : {}),
        ...(workflowData.workflowLevel ? { workflowLevel: workflowData.workflowLevel } : {}),
        // Ensure proposal linkage persists
        ...(existingIncome?.proposalId ? { proposalId: existingIncome.proposalId } : {}),
        ...(existingIncome?.workflowRef ? { workflowRef: existingIncome.workflowRef } : {})
      },
      { new: true }
    );
    if (!updatedIncome) {
      return res.status(404).json({ message: "Income entry not found" });
    }
    // Non-blocking: trigger Proposal totals recalculation for affected proposals
    try {
      const keys = {
        fiscalYear: updatedIncome.fiscalYear,
        budgetType: updatedIncome.budgetType,
        region: updatedIncome.region,
        processBy: updatedIncome.processBy
      };
      const strictQuery = {
        fiscalYear: keys.fiscalYear,
        budgetType: keys.budgetType,
        region: keys.region,
        ...(keys.processBy ? { processBy: keys.processBy } : {})
      };
      let proposals = await Proposal.find(strictQuery).select('_id').lean();
      if (!proposals.length) {
        const relaxedQuery = { fiscalYear: keys.fiscalYear, budgetType: keys.budgetType, region: keys.region };
        proposals = await Proposal.find(relaxedQuery).select('_id').lean();
      }
      if (proposals.length) {
        await Promise.allSettled(proposals.map(p => recalculateAndSaveProposalTotals({ proposalId: p._id })));
        console.log(`🔄 [Income] Recalculated totals for ${proposals.length} proposal(s)`, keys);
      }
    } catch (recErr) {
      console.warn('⚠️ [Income] Proposal totals recalculation skipped:', recErr?.message);
    }
    res.status(200).json(updatedIncome);
  } catch (error) {
    console.error("Error updating income entry:", error);
    res.status(500).json({ message: "Failed to update income entry", error: error.message });
  }
};
// Delete income entry
exports.deleteIncome = async (req, res) => {
  try {
    const deletedIncome = await Income.findByIdAndDelete(req.params.id);
    if (!deletedIncome) {
      return res.status(404).json({ message: "Income entry not found" });
    }
    res.status(200).json({ message: "Income entry deleted successfully" });
  } catch (error) {
    console.error("Error deleting income entry:", error);
    res.status(500).json({ message: "Failed to delete income entry", error: error.message });
  }
};
// Calculate and save Net ISF
exports.calculateNetISF = async (req, res) => {
  try {
    const { fiscalYear, budgetType } = req.body;
    if (!fiscalYear) {
      return res.status(400).json({ message: "Fiscal year is required" });
    }
    // Get active settings
    const activeSettings = await Settings.findOne({ isActive: true });
    if (!activeSettings) {
      return res.status(404).json({ message: "No active settings found" });
    }
    // Calculate Net ISF based on income entries
    const incomeEntries = await Income.find({ 
      fiscalYear, 
      budgetType: budgetType || "Regular" 
    });
    let totalAmount = 0;
    incomeEntries.forEach(entry => {
      totalAmount += entry.amount;
    });
    // Apply any necessary calculations or formulas
    const netISF = totalAmount * (activeSettings.isfPercentage || 0.85);
    res.status(200).json({ 
      fiscalYear,
      budgetType: budgetType || "Regular",
      totalIncome: totalAmount,
      netISF,
      calculatedAt: new Date()
    });
  } catch (error) {
    console.error("Error calculating Net ISF:", error);
    res.status(500).json({ message: "Failed to calculate Net ISF", error: error.message });
  }
};
// Get all income entries (department/division aware)
exports.getAllIncome = async (req, res) => {
  try {
    const { fiscalYear, budgetType, region } = req.query;
    // // Build query object
    let query = {};
    if (fiscalYear) query.fiscalYear = fiscalYear;
    if (budgetType) query.budgetType = budgetType;
    // Add region filter if provided
    if (region) {
      query.region = region;
    }
    // Apply submission workflow filters when available; fallback to hierarchical filters
    const submissionFilters = req.submissionWorkflowFilters || {};
    const hierarchicalFilters = req.hierarchicalFilters || {};
    if (submissionFilters && Object.keys(submissionFilters).length > 0) {
      if (submissionFilters.$and) {
        const baseConditions = Object.entries(query).map(([k,v]) => ({ [k]: v }));
        query = { $and: [ ...baseConditions, ...submissionFilters.$and ] };
      } else {
        query = { ...query, ...submissionFilters };
      }
    } else if (hierarchicalFilters && Object.keys(hierarchicalFilters).length > 0) {
      if (hierarchicalFilters.$and) {
        const baseConditions = Object.entries(query).map(([k,v]) => ({ [k]: v }));
        query = { $and: [ ...baseConditions, ...hierarchicalFilters.$and ] };
      } else {
        query = { ...query, ...hierarchicalFilters };
      }
    }
    let incomeEntries = await Income.find(query)
      .populate('incomecategory')
      .sort({ createdAt: -1 });
    
    // RESPONSIBILITY CENTER FILTERING: Restrict visibility based on user's CURRENT organizational assignment
    const userId = req.user?.id || req.user?._id || req.user?.UserId || req.user?.userId;
    const userIdString = userId ? String(userId) : undefined;
    const userRoles = req.user?.Roles || [];
    
    const isSuperAdmin = userRoles.some(r => ['SUPER_ADMIN', 'SUPER ADMIN'].includes(r));
    const isBudgetManager = userRoles.some(r => ['BUDGET_MANAGER', 'BUDGET MANAGER', 'OVERALL_BUDGET_APPROVER'].includes(r));
    
    if (!isSuperAdmin && !isBudgetManager && userIdString) {
      try {
        const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
        const userAssignment = await HierarchicalUserAssignment.findOne({ userId: userIdString })
          .populate('departmentId', 'Department DepartmentName department')
          .populate('regionId', 'Region RegionName region')
          .lean();
        
        if (userAssignment) {
          const assignedDepartment = userAssignment.departmentId?.Department || 
                                    userAssignment.departmentId?.DepartmentName ||
                                    userAssignment.departmentId?.department;
          const assignedRegion = userAssignment.regionId?.Region ||
                                userAssignment.regionId?.RegionName ||
                                userAssignment.regionId?.region;
          const assignedDivision = userAssignment.divisionName;
          
          const filteredIncome = incomeEntries.filter(inc => {
            if (assignedDivision && userAssignment.assignmentLevel === 'DIVISION') {
              return inc.division === assignedDivision;
            }
            if (assignedDepartment && (userAssignment.assignmentLevel === 'DEPARTMENT' || userAssignment.assignmentLevel === 'OFFICE')) {
              return inc.department === assignedDepartment;
            }
            if (assignedRegion && userAssignment.assignmentLevel === 'REGION') {
              return inc.region === assignedRegion;
            }
            if (userAssignment.assignmentLevel === 'FULL') {
              return true;
            }
            return false;
          });
          
          if (filteredIncome.length > 0 || userAssignment.assignmentLevel !== 'FULL') {
            incomeEntries = filteredIncome;
          }
        }
      } catch (err) {
        console.error('[ORG_FILTER] Error in getAllIncome:', err.message);
      }
    }
    
    res.status(200).json(incomeEntries);
  } catch (error) {
    console.error("Error fetching income entries:", error);
    res.status(500).json({ message: "Failed to fetch income entries", error: error.message });
  }
};
// Get income by ID
exports.getIncomeById = async (req, res) => {
  try {
    const { id } = req.params;
    // Validate that id is a valid MongoDB ObjectId
    if (!id || !require('mongoose').Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        message: "Invalid ID format", 
        details: `'${id}' is not a valid MongoDB ObjectId`
      });
    }
    const income = await Income.findById(id);
    if (!income) {
      return res.status(404).json({ message: "Income entry not found" });
    }
    return res.status(200).json(income);
  } catch (error) {
    console.error("Error fetching income by ID:", error);
    return res.status(500).json({
      message: "Failed to fetch income entry",
      error: error.message
    });
  }
};
// Get income by parameters
exports.getIncomeByParams = async (req, res) => {
  try {
    const { proposalId, fiscalYear, budgetType, processBy, region, status, department, division } = req.query;
    // Base query from parameters
    const baseQuery = {};
    
    // ✅ Primary filter: if proposalId is provided, use it
    if (proposalId) {
      // Accept either legacy Proposal _id or NewProposalWorkflow _id
      // If the provided id is a workflow id, include workflowRef match and resolve legacy proposal id for proposalId match
      try {
        baseQuery.$or = [{ workflowRef: proposalId }];
        const legacy = await Proposal.findOne({ workflowRef: proposalId }).select('_id').lean();
        if (legacy?._id) {
          baseQuery.$or.push({ proposalId: legacy._id });
        }
      } catch (_e) {
        // Fallback: direct proposalId match (legacy)
        baseQuery.proposalId = proposalId;
      }
    } else {
      // Fallback: use individual parameters
      if (fiscalYear) baseQuery.fiscalYear = fiscalYear;
      if (budgetType) baseQuery.budgetType = budgetType;
      if (processBy) baseQuery.processBy = processBy;
      if (region) baseQuery.region = region;
      if (status) baseQuery.status = status;
      if (department) baseQuery.department = department;
      if (division) baseQuery.division = division;
    }

    // Merge submission workflow filters when available; fallback to hierarchical filters
    const submissionFilters = req.submissionWorkflowFilters || {};
    const hierarchicalFilters = req.hierarchicalFilters || {};
    let query = { ...baseQuery };
    if (submissionFilters && Object.keys(submissionFilters).length > 0) {
      if (submissionFilters.$and) {
        const conditions = [];
        // expand baseQuery into individual conditions
        Object.entries(baseQuery).forEach(([k, v]) => conditions.push({ [k]: v }));
        query = { $and: [ ...conditions, ...submissionFilters.$and ] };
      } else {
        query = { ...baseQuery, ...submissionFilters };
      }
    } else if (hierarchicalFilters && Object.keys(hierarchicalFilters).length > 0) {
      if (hierarchicalFilters.$and) {
        const conditions = [];
        Object.entries(baseQuery).forEach(([k, v]) => conditions.push({ [k]: v }));
        query = { $and: [ ...conditions, ...hierarchicalFilters.$and ] };
      } else {
        query = { ...baseQuery, ...hierarchicalFilters };
      }
    }

    let income = await Income.find(query).lean();
    
    // RESPONSIBILITY CENTER FILTERING: Restrict visibility based on user's CURRENT organizational assignment
    const userId = req.user?.id || req.user?._id || req.user?.UserId || req.user?.userId;
    const userIdString = userId ? String(userId) : undefined;
    const userRoles = req.user?.Roles || [];
    
    const isSuperAdmin = userRoles.some(r => ['SUPER_ADMIN', 'SUPER ADMIN'].includes(r));
    const isBudgetManager = userRoles.some(r => ['BUDGET_MANAGER', 'BUDGET MANAGER', 'OVERALL_BUDGET_APPROVER'].includes(r));
    
    if (!isSuperAdmin && !isBudgetManager && userIdString) {
      try {
        const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
        const userAssignment = await HierarchicalUserAssignment.findOne({ userId: userIdString })
          .populate('departmentId', 'Department DepartmentName department')
          .populate('regionId', 'Region RegionName region')
          .lean();
        
        if (userAssignment) {
          const assignedDepartment = userAssignment.departmentId?.Department || 
                                    userAssignment.departmentId?.DepartmentName ||
                                    userAssignment.departmentId?.department;
          const assignedRegion = userAssignment.regionId?.Region ||
                                userAssignment.regionId?.RegionName ||
                                userAssignment.regionId?.region;
          const assignedDivision = userAssignment.divisionName;
          
          const filteredIncome = income.filter(inc => {
            if (assignedDivision && userAssignment.assignmentLevel === 'DIVISION') {
              return inc.division === assignedDivision;
            }
            if (assignedDepartment && (userAssignment.assignmentLevel === 'DEPARTMENT' || userAssignment.assignmentLevel === 'OFFICE')) {
              return inc.department === assignedDepartment;
            }
            if (assignedRegion && userAssignment.assignmentLevel === 'REGION') {
              return inc.region === assignedRegion;
            }
            if (userAssignment.assignmentLevel === 'FULL') {
              return true;
            }
            return false;
          });
          
          // Always apply filter - don't show data from other responsibility centers
          income = filteredIncome;
        }
      } catch (err) {
        console.error('[ORG_FILTER] Error in getIncomeByParams:', err.message);
      }
    }
    
    res.status(200).json(income);
  } catch (error) {
    console.error("Error fetching income by params:", error);
    res.status(500).json({ message: "Failed to fetch income data" });
  }
};

exports.bulkUpdateIncome = async (req, res) => {
  try {
    const { items } = req.body;
    
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Items array is required and must not be empty" });
    }

    const activeSettings = await Settings.findOne({ isActive: true });
    const setFY = activeSettings?.fiscalYear;
    const setBT = activeSettings?.budgetType;
    const workflowData = req.submissionWorkflowData || {};

    const updates = [];
    
    for (const item of items) {
      if (!item._id) {
        return res.status(400).json({ message: "Each item must have an _id field" });
      }

      const existingIncome = await Income.findById(item._id);
      if (!existingIncome) {
        return res.status(404).json({ message: `Income entry with ID ${item._id} not found` });
      }

      const submittedStatuses = ["Submitted", "Division Submitted", "Department Verified", "Department Submitted", "Region Approved", "Finalized"];
      if (submittedStatuses.includes(existingIncome.status)) {
        return res.status(403).json({
          error: "Update not allowed",
          message: `Cannot edit income record ${item._id} that has been submitted or approved`
        });
      }

      updates.push(
        Income.findByIdAndUpdate(
          item._id,
          {
            particulars: item.particulars !== undefined ? item.particulars : existingIncome.particulars,
            cost: item.cost !== undefined ? item.cost : (item.amount !== undefined ? item.amount : existingIncome.cost),
            amount: item.amount !== undefined ? item.amount : existingIncome.amount,
            incomecategory: item.incomecategory !== undefined ? item.incomecategory : existingIncome.incomecategory,
            subcategory: item.subcategory !== undefined ? item.subcategory : existingIncome.subcategory,
            category: item.category !== undefined ? item.category : existingIncome.category,
            ...(setFY ? { fiscalYear: setFY } : {}),
            ...(setBT ? { budgetType: setBT } : {}),
            region: item.region !== undefined ? item.region : (workflowData.region || existingIncome.region),
            department: item.department !== undefined ? item.department : (workflowData.department || existingIncome.department),
            division: item.division !== undefined ? item.division : (workflowData.division || existingIncome.division),
            processBy: item.processBy !== undefined ? item.processBy : (req.user?.userName || req.user?.id || existingIncome.processBy),
            processDate: item.processDate !== undefined ? item.processDate : new Date(),
            status: item.status !== undefined ? item.status : (workflowData.status || existingIncome.status),
            ...(workflowData.originalLevel ? { originalLevel: workflowData.originalLevel } : {}),
            ...(workflowData.workflowLevel ? { workflowLevel: workflowData.workflowLevel } : {}),
          },
          { new: true }
        )
      );
    }

    const updatedItems = await Promise.all(updates);
    
    try {
      const proposalIds = new Set();
      for (const item of updatedItems) {
        if (item.proposalId) {
          proposalIds.add(item.proposalId);
        }
      }
      
      if (proposalIds.size > 0) {
        for (const proposalId of proposalIds) {
          await recalculateAndSaveProposalTotals({ proposalId });
        }
      }
    } catch (error) {
      console.error("Error recalculating proposal totals:", error);
    }

    try {
      const originalItemMap = new Map();
      items.forEach(item => {
        originalItemMap.set(item._id.toString(), item);
      });

      for (const updatedItem of updatedItems) {
        const originalItem = originalItemMap.get(updatedItem._id.toString());
        if (originalItem && updatedItem.proposalId) {
          const changes = [];
          
          if (originalItem.amount !== undefined && updatedItem.amount !== originalItem.amount) {
            changes.push({
              field: 'amount',
              oldValue: originalItem.amount,
              newValue: updatedItem.amount,
              valueType: 'number'
            });
          }

          if (originalItem.cost !== undefined && updatedItem.cost !== originalItem.cost) {
            changes.push({
              field: 'cost',
              oldValue: originalItem.cost,
              newValue: updatedItem.cost,
              valueType: 'number'
            });
          }

          if (changes.length > 0) {
            await ProposalEditLog.logChange({
              proposalId: updatedItem.proposalId,
              workflowRef: updatedItem.workflowRef,
              fiscalYear: updatedItem.fiscalYear,
              budgetType: updatedItem.budgetType,
              region: updatedItem.region,
              department: updatedItem.department,
              division: updatedItem.division,
              changeType: 'BULK_EDIT',
              entityType: 'Income',
              entityId: updatedItem._id,
              changedBy: {
                userId: req.user?.id || 'SYSTEM',
                userName: req.user?.userName || 'SYSTEM',
                email: req.user?.email,
                role: req.user?.Roles?.join(', ') || 'SYSTEM'
              },
              changes,
              summary: `Updated ${changes.length} field(s) in Income entry`,
              ipAddress: req.ip,
              userAgent: req.get('user-agent')
            });
          }
        }
      }
    } catch (error) {
      console.error("Error logging income changes:", error);
    }

    res.status(200).json({ 
      message: "Income entries updated successfully", 
      updatedCount: updatedItems.length,
      items: updatedItems 
    });
  } catch (error) {
    console.error("Error updating income entries:", error);
    res.status(500).json({ message: "Failed to update income entries" });
  }
};
