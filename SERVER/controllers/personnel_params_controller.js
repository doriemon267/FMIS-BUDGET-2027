const mongoose = require("mongoose");
const PersonnelServices = require("../models/PersonnelServices");
const Settings = require("../models/Settings");
const { recalculateAndSaveProposalTotals } = require('../utils/recalculateProposalTotals');
const { validateNonNegativeInItems } = require('../utils/validateNonNegative');

const getPersonnelByParams = async (req, res) => {
  try {
    const { proposalId, fiscalYear, budgetType, processBy, region, status, division } = req.query;
    const query = {};

    // When proposalId is provided (e.g. Proposal Details dialog), filter by workflowRef or legacy proposalId
    if (proposalId) {
      let workflowId = proposalId;
      if (typeof proposalId === 'string' && mongoose.Types.ObjectId.isValid(proposalId)) {
        try {
          workflowId = new mongoose.Types.ObjectId(proposalId);
        } catch (_) {}
      }
      try {
        query.$or = [{ workflowRef: workflowId }];
        const Proposal = require('../models/Proposal');
        const legacy = await Proposal.findOne({ workflowRef: workflowId }).select('_id').lean();
        if (legacy?._id) {
          query.$or.push({ proposalId: legacy._id });
        }
      } catch (_e) {
        query.proposalId = workflowId;
      }
    } else {
      if (fiscalYear) query.fiscalYear = String(fiscalYear);
      if (budgetType) query.budgetType = budgetType;
      if (processBy) query.processBy = processBy;
      if (status) query.status = status;

      if (region) {
        const reg = String(region).trim();
        const cleanReg = reg.replace(/^TEST\s+/i, '').trim();
        if (cleanReg) {
          const regionRegex = new RegExp(cleanReg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
          const searchRegions = [reg];
          if (reg === 'Region 10') searchRegions.push('Region X');
          if (reg === 'Region X') searchRegions.push('Region 10');
          query.$and = query.$and || [];
          query.$and.push({ $or: [{ region: { $in: searchRegions } }, { region: regionRegex }] });
        } else {
          query.region = region;
        }
      }

      if (division) {
        const div = String(division).trim();
        const cleanDiv = div.replace(/^TEST\s+/i, '').trim();
        if (cleanDiv) {
          const divRegex = new RegExp(cleanDiv.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
          query.$and = query.$and || [];
          query.$and.push({ $or: [{ division: divRegex }, { department: divRegex }, { division: div }, { department: div }] });
        } else {
          query.division = division;
        }
      }
    }

    let personnel = await PersonnelServices.find(query).lean();

    // ✅ ENHANCED FALLBACK: Always merge relevant unlinked records when viewing a proposal,
    // not just when linked records are missing. This ensures centralized/bulk-uploaded personnel 
    // (no workflowRef) shows up alongside proposal-specific entries.
    if (proposalId && (req.query.fiscalYear || req.query.budgetType)) {
      // Fetch the proposal to get its region if not provided in the request
      let proposalRegion = req.query.region;
      if (!proposalRegion) {
        try {
          // Check legacy Proposal first
          const Proposal = require('../models/Proposal');
          const proposal = await Proposal.findById(proposalId).select('region').lean();
          if (proposal) {
            proposalRegion = proposal.region;
          } else {
            // Check NewProposalWorkflow if legacy not found
            const NewProposalWorkflow = require('../models/NewProposalWorkflow');
            const workflow = await NewProposalWorkflow.findById(proposalId)
              .populate('region', 'Region RegionName region')
              .lean();
            if (workflow) {
              proposalRegion = workflow.region?.Region || workflow.region?.RegionName || workflow.region?.region || workflow.region;
            }
          }
        } catch (err) {
          console.warn('[Personnel] Failed to fetch proposal for region fallback:', err.message);
        }
      }

      // Build regional search array including special regions
      // Build regional search array including special regions and regex support
      const searchRegions = [null, ""];
      let regionRegex = null;
      if (proposalRegion) {
        const reg = String(proposalRegion).trim();
        searchRegions.push(reg);
        
        // Handle Region 10 / Region X equivalence
        if (reg === 'Region 10') searchRegions.push('Region X');
        if (reg === 'Region X') searchRegions.push('Region 10');

        // Create substring regex (e.g. "MARIIS" matches "MARIIS - Division 1" or vice versa)
        const cleanReg = reg.replace(/^TEST\s+/i, '').trim();
        if (cleanReg) {
          regionRegex = new RegExp(cleanReg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        }
      }

      // Resilient Division/Department matching: Match if either field substring-matches either provided value
      const orgClauses = [];
      if (req.query.division) {
        const div = String(req.query.division).trim();
        const cleanDiv = div.replace(/^TEST\s+/i, '').trim();
        const divRegex = new RegExp(cleanDiv.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        orgClauses.push({ division: divRegex });
        orgClauses.push({ department: divRegex });
        orgClauses.push({ division: div });
        orgClauses.push({ department: div });
      }
      if (req.query.department) {
        const dept = String(req.query.department).trim();
        const cleanDept = dept.replace(/^TEST\s+/i, '').trim();
        const deptRegex = new RegExp(cleanDept.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        orgClauses.push({ department: deptRegex });
        orgClauses.push({ division: deptRegex });
        orgClauses.push({ department: dept });
        orgClauses.push({ division: dept });
      }
      // Also include records that have NO division/department (Central/Region level personnel)
      orgClauses.push({ $and: [{ division: { $in: [null, ""] } }, { department: { $in: [null, ""] } }] });

      const regionQueryClause = regionRegex 
        ? { $or: [{ region: { $in: searchRegions } }, { region: regionRegex }] }
        : { region: { $in: searchRegions } };

      const unlinkedQuery = {
        $and: [
          { $or: [{ workflowRef: null }, { workflowRef: { $exists: false } }] },
          { $or: [{ proposalId: null }, { proposalId: { $exists: false } }] },
          { $or: orgClauses },
          regionQueryClause
        ]
      };

      if (req.query.fiscalYear) {
        const fyNum = Number(req.query.fiscalYear);
        const fyOr = [{ fiscalYear: String(req.query.fiscalYear) }];
        if (!Number.isNaN(fyNum)) {
          fyOr.push({ fiscalYear: fyNum });
        }
        unlinkedQuery.$and.push({ $or: fyOr });
      }
      if (req.query.budgetType) {
        unlinkedQuery.$and.push({ budgetType: { $in: [req.query.budgetType, null, ""] } });
      }

      const unlinkedPersonnel = await PersonnelServices.find(unlinkedQuery).lean();
      
      if (unlinkedPersonnel.length > 0) {
        // Merge and deduplicate by _id to avoid showing the same record twice 
        // (though unlinked records by definition shouldn't be in the first 'personnel' array)
        const existingIds = new Set(personnel.map(p => String(p._id)));
        const uniqueUnlinked = unlinkedPersonnel.filter(p => !existingIds.has(String(p._id)));
        
        if (uniqueUnlinked.length > 0) {
          personnel = [...personnel, ...uniqueUnlinked];
        }
      }
    }

    // DIAGNOSTIC LOGGING: Inspect what records were matched
    console.log(`[DIAGNOSTIC] Proposal Details fetch for ID: ${proposalId}`);
    console.log(`- Request params: Region="${region}", Division="${division}", FiscalYear="${fiscalYear}", BudgetType="${budgetType}"`);
    console.log(`- Matched total records count: ${personnel.length}`);
    if (personnel.length > 0) {
      const breakdown = personnel.reduce((acc, p) => {
        const status = String(p.statusOfAppointment || p.StatusOfAppointment || 'N/A').toUpperCase();
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});
      console.log(`- Breakdown by Appointment Status:`, breakdown);
      
      const sampleCasual = personnel.find(p => String(p.statusOfAppointment || p.StatusOfAppointment || '').toUpperCase() === 'CASUAL');
      if (sampleCasual) {
        console.log(`- Sample CASUAL record found: Name="${sampleCasual.employeeFullName}", Division="${sampleCasual.division}", Region="${sampleCasual.region}", ChargedToIncome=${sampleCasual.chargedToIncomeEligible}`);
      } else {
        console.log(`- NO CASUAL record found in the matched list.`);
        // Let's do a quick global check on the database for CASUAL records to see if any exist at all
        try {
          const globalCasualCount = await PersonnelServices.countDocuments({
            $or: [
              { statusOfAppointment: { $regex: '^casual$', $options: 'i' } },
              { StatusOfAppointment: { $regex: '^casual$', $options: 'i' } }
            ]
          });
          console.log(`- GLOBAL DATABASE CHECK: Total CASUAL records in database = ${globalCasualCount}`);
        } catch (dbErr) {
          console.log(`- Global database check failed: ${dbErr.message}`);
        }
      }
    } else {
      console.log(`- NO records matched query filters at all.`);
      try {
        const totalCount = await PersonnelServices.countDocuments({});
        console.log(`- GLOBAL DATABASE CHECK: Total records in entire personnelservices collection = ${totalCount}`);
      } catch (dbErr) {
        console.log(`- Global database count check failed: ${dbErr.message}`);
      }
    }

    res.status(200).json(personnel);
  } catch (error) {
    console.error("Error fetching personnel by params:", error);
    res.status(500).json({ message: "Failed to fetch personnel data" });
  }
};

const bulkUpdatePersonnel = async (req, res) => {
  try {
    const { items } = req.body;
    
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Items array is required and must not be empty" });
    }
    const nonNeg = validateNonNegativeInItems(items, ['Total', 'amount']);
    if (!nonNeg.valid) {
      return res.status(400).json({ message: nonNeg.message });
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

      const existingPersonnel = await PersonnelServices.findById(item._id);
      if (!existingPersonnel) {
        return res.status(404).json({ message: `Personnel entry with ID ${item._id} not found` });
      }

      const submittedStatuses = ["Submitted", "Division Submitted", "Department Verified", "Department Submitted", "Region Approved", "Finalized"];
      if (submittedStatuses.includes(existingPersonnel.status)) {
        return res.status(403).json({
          error: "Update not allowed",
          message: `Cannot edit personnel record ${item._id} that has been submitted or approved`
        });
      }

      updates.push(
        PersonnelServices.findByIdAndUpdate(
          item._id,
          {
            Total: item.Total !== undefined ? item.Total : existingPersonnel.Total,
            amount: item.amount !== undefined ? item.amount : existingPersonnel.amount,
            ...(setFY ? { fiscalYear: setFY } : {}),
            ...(setBT ? { budgetType: setBT } : {}),
            region: item.region !== undefined ? item.region : (workflowData.region || existingPersonnel.region),
            department: item.department !== undefined ? item.department : (workflowData.department || existingPersonnel.department),
            division: item.division !== undefined ? item.division : (workflowData.division || existingPersonnel.division),
            processBy: item.processBy !== undefined ? item.processBy : (req.user?.userName || req.user?.id || existingPersonnel.processBy),
            processDate: item.processDate !== undefined ? item.processDate : new Date(),
            status: item.status !== undefined ? item.status : (workflowData.status || existingPersonnel.status),
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

    res.status(200).json({ 
      message: "Personnel entries updated successfully", 
      updatedCount: updatedItems.length,
      items: updatedItems 
    });
  } catch (error) {
    console.error("Error updating personnel entries:", error);
    res.status(500).json({ message: "Failed to update personnel entries" });
  }
};

module.exports = {
  getPersonnelByParams,
  bulkUpdatePersonnel
};