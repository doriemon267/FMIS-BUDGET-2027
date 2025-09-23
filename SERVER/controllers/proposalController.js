  const mongoose = require('mongoose');
const Proposal = require('../models/Proposal');
const DraftProposal = require('../models/DraftProposal');
const PersonnelService = require('../models/personnelServices');
const MooeProposal = require('../models/mooeProposals');
const CapitalOutlay = require('../models/CapitalOutlay');
const BudgetarySupport = require('../models/BudgetarySupport');
const Income = require('../models/Income');
const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
// Remove the checkUserRegionAccess function
// const checkUserRegionAccess = async (userId, region) => {
//   try {
//     // If no region specified, allow access
//     if (!region) return true;
//     
//     // Find user's region assignments
//     const userAssignment = await UserRegionAssignment.findOne({ userId }).populate('regions');
//     
//     // If no assignments found, check if any assignments exist in the system
//     if (!userAssignment) {
//       const anyAssignments = await UserRegionAssignment.countDocuments();
//       // If no assignments exist in the system, allow access (system not using region restrictions yet)
//       if (anyAssignments === 0) return true;
//       // Otherwise, deny access
//       return false;
//     }
//     
//     // Check if user is assigned to this region
//     return userAssignment.regions.some(r => r.Region === region);
//   } catch (error) {
//     console.error('Error checking user region access:', error);
//     return false;
//   }
// };
// Workflow transition handlers (additive, non-breaking)
exports.approveAtDivision = async (req, res) => {
  try {
    const { ids = [], entity = 'personnel' } = req.body; // entity: 'personnel' | 'mooe' | 'capital' | 'income'
    const userId = req.user?.id || 'system';
    const Model = entity === 'personnel' ? require('../models/personnelServices')
      : entity === 'mooe' ? require('../models/mooeProposals')
      : entity === 'capital' ? require('../models/CapitalOutlay')
      : require('../models/Income');
    const result = await Model.updateMany(
      { _id: { $in: ids } },
      { $set: { status: 'Submitted', divisionApproved: { by: userId, at: new Date() } } }
    );
    return res.status(200).json({ message: 'Division approval applied', modified: result.modifiedCount });
  } catch (e) {
    console.error('approveAtDivision error:', e);
    return res.status(500).json({ message: 'approveAtDivision failed', error: e.message });
  }
};
exports.consolidateAtDepartment = async (req, res) => {
  try {
    const { ids = [], entity = 'personnel' } = req.body;
    const userId = req.user?.id || 'system';
    const Model = entity === 'personnel' ? require('../models/personnelServices')
      : entity === 'mooe' ? require('../models/mooeProposals')
      : entity === 'capital' ? require('../models/CapitalOutlay')
      : require('../models/Income');
    const result = await Model.updateMany(
      { _id: { $in: ids } },
      { $set: { departmentConsolidated: { by: userId, at: new Date() } } }
    );
    return res.status(200).json({ message: 'Department consolidation recorded', modified: result.modifiedCount });
  } catch (e) {
    console.error('consolidateAtDepartment error:', e);
    return res.status(500).json({ message: 'consolidateAtDepartment failed', error: e.message });
  }
};
exports.submitToRegion = async (req, res) => {
  try {
    const { ids = [], entity = 'personnel' } = req.body;
    const userId = req.user?.id || 'system';
    const Model = entity === 'personnel' ? require('../models/personnelServices')
      : entity === 'mooe' ? require('../models/mooeProposals')
      : entity === 'capital' ? require('../models/CapitalOutlay')
      : require('../models/Income');
    const result = await Model.updateMany(
      { _id: { $in: ids } },
      { $set: { status: 'Submitted', departmentSubmitted: { by: userId, at: new Date() } } }
    );
    return res.status(200).json({ message: 'Submitted to region', modified: result.modifiedCount });
  } catch (e) {
    console.error('submitToRegion error:', e);
    return res.status(500).json({ message: 'submitToRegion failed', error: e.message });
  }
};
exports.finalVerifyAtRegion = async (req, res) => {
  try {
    const { ids = [], entity = 'personnel' } = req.body;
    const userId = req.user?.id || 'system';
    const Model = entity === 'personnel' ? require('../models/personnelServices')
      : entity === 'mooe' ? require('../models/mooeProposals')
      : entity === 'capital' ? require('../models/CapitalOutlay')
      : require('../models/Income');
    const result = await Model.updateMany(
      { _id: { $in: ids } },
      { $set: { status: 'Approved', regionFinalVerified: { by: userId, at: new Date() } } }
    );
    return res.status(200).json({ message: 'Region final verification applied', modified: result.modifiedCount });
  } catch (e) {
    console.error('finalVerifyAtRegion error:', e);
    return res.status(500).json({ message: 'finalVerifyAtRegion failed', error: e.message });
  }
};
exports.updateProposalStatus = async (req, res) => {
  try {
    const { 
      personnelIds, 
      mooeIds, 
      capitalOutlayIds, 
      incomeIds, 
      budgetType, 
      processBy,
      region,
      userId // Add userId to the request
    } = req.body;
    // Change from const to let for fiscalYear
    let { fiscalYear } = req.body;
    // Ensure region is included in the request
    if (!fiscalYear || !budgetType || !region) {
      console.error("Missing required fields in request body:", req.body);
      return res.status(400).json({ message: "Missing fiscalYear, budgetType, or region" });
    }
    fiscalYear = fiscalYear.toString();
    // Build hierarchical scope from middleware (limits by division/department/region)
    const accessScope = req.hierarchicalFilters || {};
    // Optimize: Run all database updates in parallel for better performance
    const updatePromises = [];
    if (personnelIds && Array.isArray(personnelIds) && personnelIds.length > 0) {
      const validPersonnelIds = personnelIds
        .filter(id => mongoose.Types.ObjectId.isValid(id))
        .map(id => new mongoose.Types.ObjectId(id));
      updatePromises.push(
        PersonnelService.updateMany(
          { _id: { $in: validPersonnelIds }, ...accessScope },
          { $set: { status: "Division Submitted", fiscalYear, budgetType, processBy, region, workflowLevel: "DIVISION" } }
        )
      );
    }
    if (mooeIds && Array.isArray(mooeIds) && mooeIds.length > 0) {
      const validMooeIds = mooeIds
        .filter((id) => {
          const isValid = mongoose.Types.ObjectId.isValid(id);
          if (!isValid) {
            console.error("Invalid MOOE id encountered:", id);
          }
          return isValid;
        })
        .map((id) => new mongoose.Types.ObjectId(id));
      updatePromises.push(
        MooeProposal.updateMany(
          { _id: { $in: validMooeIds }, ...accessScope },
          { $set: { status: "Division Submitted", fiscalYear, budgetType, processBy, region, workflowLevel: "DIVISION" } }
        )
      );
    }
    if (capitalOutlayIds && Array.isArray(capitalOutlayIds) && capitalOutlayIds.length > 0) {
      const validCapitalIds = capitalOutlayIds
        .filter((id) => {
          const isValid = mongoose.Types.ObjectId.isValid(id);
          if (!isValid) {
            console.error("Invalid Capital Outlay id encountered:", id);
          }
          return isValid;
        })
        .map((id) => new mongoose.Types.ObjectId(id));
      updatePromises.push(
        CapitalOutlay.updateMany(
          { _id: { $in: validCapitalIds }, ...accessScope },
          { $set: { status: "Division Submitted", fiscalYear, budgetType, processBy, region, workflowLevel: "DIVISION" } }
        )
      );
    }
    if (incomeIds && Array.isArray(incomeIds) && incomeIds.length > 0) {
      const validIncomeIds = incomeIds
        .filter((id) => {
          const isValid = mongoose.Types.ObjectId.isValid(id);
          if (!isValid) {
            console.error("Invalid Income id encountered:", id);
          }
          return isValid;
        })
        .map((id) => new mongoose.Types.ObjectId(id));
      updatePromises.push(
        Income.updateMany(
          { _id: { $in: validIncomeIds }, ...accessScope },
          { $set: { status: "Division Submitted", fiscalYear, budgetType, processBy, region, workflowLevel: "DIVISION" } }
        )
      );
    }
    // Execute all updates in parallel
    const updateResults = await Promise.all(updatePromises);
    const status = "Division Submitted";
    // Calculate personnel expenses
    const personnel = await PersonnelService.aggregate([
      { 
        $match: { 
          status, 
          fiscalYear, 
          budgetType, 
          processBy,
          region,
          ...accessScope
        } 
      },
      {
        $project: {
          processBy: 1,
          region: 1,
          statusOfAppointment: 1,
          // Make sure all fields are properly converted to numbers
          computedTotal: {
            $sum: [
              { $toDouble: { $ifNull: ["$annualSalary", 0] } },
              { $toDouble: { $ifNull: ["$RATA", 0] } },
              { $toDouble: { $ifNull: ["$PERA", 0] } },
              { $toDouble: { $ifNull: ["$uniformALLOWANCE", 0] } },
              { $toDouble: { $ifNull: ["$productivityIncentive", 0] } },
              { $toDouble: { $ifNull: ["$medical", 0] } },
              { $toDouble: { $ifNull: ["$childrenAllowance", 0] } },
              { $toDouble: { $ifNull: ["$meal", 0] } },
              { $toDouble: { $ifNull: ["$cashGift", 0] } },
              { $toDouble: { $ifNull: ["$subsistenceAllowanceMDS", 0] } },
              { $toDouble: { $ifNull: ["$subsistenceAllowanceST", 0] } },
              { $toDouble: { $ifNull: ["$midyearBonus", 0] } },
              { $toDouble: { $ifNull: ["$yearEndBonus", 0] } },
              { $toDouble: { $ifNull: ["$gsisPremium", 0] } },
              { $toDouble: { $ifNull: ["$philhealthPremium", 0] } },
              { $toDouble: { $ifNull: ["$pagibigPremium", 0] } },
              { $toDouble: { $ifNull: ["$employeeCompensation", 0] } },
              { $toDouble: { $ifNull: ["$loyaltyAward", 0] } },
              { $toDouble: { $ifNull: ["$overtimePay", 0] } },
              { $toDouble: { $ifNull: ["$earnedLeaves", 0] } },
              { $toDouble: { $ifNull: ["$retirementBenefits", 0] } },
              { $toDouble: { $ifNull: ["$terminalLeave", 0] } },
              { $toDouble: { $ifNull: ["$courtAppearance", 0] } }
            ]
          }
        }
      },
      {
        $group: {
          _id: { 
            processBy: "$processBy", 
            region: "$region", 
            statusOfAppointment: "$statusOfAppointment" 
          },
          totalCost: { $sum: "$computedTotal" }
        }
      }
    ]);
    // Log the result to see if it has values

    // For Department level aggregation, also include Division-level submitted data
    let departmentPersonnelAggregation = [];
    if (req.hierarchicalAccess?.scope === 'DEPARTMENT') {
      const deptRegion = req.hierarchicalAccess.accessibleRegions?.[0]?.regionName;
      const deptName = req.hierarchicalAccess.accessibleDepartments?.[0]?.departmentName;

      console.log(`🔄 DEPARTMENT AGGREGATION: Processing for ${deptRegion} - ${deptName}`);

      if (deptRegion && deptName) {
        // Get Department-level Personnel data
        const deptPersonnel = await PersonnelService.aggregate([
          {
            $match: {
              status,
              fiscalYear,
              budgetType,
              region: deptRegion,
              department: deptName,
              $or: [
                { division: { $exists: false } },
                { division: null },
                { division: "" }
              ]
            }
          },
          {
            $project: {
              processBy: 1,
              region: 1,
              department: 1,
              statusOfAppointment: 1,
              computedTotal: {
                $sum: [
                  { $toDouble: { $ifNull: ["$annualSalary", 0] } },
                  { $toDouble: { $ifNull: ["$RATA", 0] } },
                  { $toDouble: { $ifNull: ["$PERA", 0] } },
                  { $toDouble: { $ifNull: ["$uniformALLOWANCE", 0] } },
                  { $toDouble: { $ifNull: ["$productivityIncentive", 0] } },
                  { $toDouble: { $ifNull: ["$medical", 0] } },
                  { $toDouble: { $ifNull: ["$childrenAllowance", 0] } },
                  { $toDouble: { $ifNull: ["$meal", 0] } },
                  { $toDouble: { $ifNull: ["$cashGift", 0] } },
                  { $toDouble: { $ifNull: ["$subsistenceAllowanceMDS", 0] } },
                  { $toDouble: { $ifNull: ["$subsistenceAllowanceST", 0] } },
                  { $toDouble: { $ifNull: ["$midyearBonus", 0] } },
                  { $toDouble: { $ifNull: ["$yearEndBonus", 0] } },
                  { $toDouble: { $ifNull: ["$gsisPremium", 0] } },
                  { $toDouble: { $ifNull: ["$philhealthPremium", 0] } },
                  { $toDouble: { $ifNull: ["$pagibigPremium", 0] } },
                  { $toDouble: { $ifNull: ["$employeeCompensation", 0] } },
                  { $toDouble: { $ifNull: ["$loyaltyAward", 0] } },
                  { $toDouble: { $ifNull: ["$overtimePay", 0] } },
                  { $toDouble: { $ifNull: ["$earnedLeaves", 0] } },
                  { $toDouble: { $ifNull: ["$retirementBenefits", 0] } },
                  { $toDouble: { $ifNull: ["$terminalLeave", 0] } },
                  { $toDouble: { $ifNull: ["$courtAppearance", 0] } }
                ]
              }
            }
          },
          {
            $group: {
              _id: {
                processBy: "$processBy",
                region: "$region",
                department: "$department",
                statusOfAppointment: "$statusOfAppointment"
              },
              totalCost: { $sum: "$computedTotal" }
            }
          }
        ]);

        // Get Division-level submitted Personnel data for this department
        const divisionPersonnel = await PersonnelService.aggregate([
          {
            $match: {
              status: { $in: ["Submitted", "Approved", "Completed"] }, // Only submitted divisions
              fiscalYear,
              budgetType,
              region: deptRegion,
              department: deptName,
              division: { $exists: true, $ne: null, $ne: "" }
            }
          },
          {
            $project: {
              processBy: 1,
              region: 1,
              department: 1,
              statusOfAppointment: 1,
              computedTotal: {
                $sum: [
                  { $toDouble: { $ifNull: ["$annualSalary", 0] } },
                  { $toDouble: { $ifNull: ["$RATA", 0] } },
                  { $toDouble: { $ifNull: ["$PERA", 0] } },
                  { $toDouble: { $ifNull: ["$uniformALLOWANCE", 0] } },
                  { $toDouble: { $ifNull: ["$productivityIncentive", 0] } },
                  { $toDouble: { $ifNull: ["$medical", 0] } },
                  { $toDouble: { $ifNull: ["$childrenAllowance", 0] } },
                  { $toDouble: { $ifNull: ["$meal", 0] } },
                  { $toDouble: { $ifNull: ["$cashGift", 0] } },
                  { $toDouble: { $ifNull: ["$subsistenceAllowanceMDS", 0] } },
                  { $toDouble: { $ifNull: ["$subsistenceAllowanceST", 0] } },
                  { $toDouble: { $ifNull: ["$midyearBonus", 0] } },
                  { $toDouble: { $ifNull: ["$yearEndBonus", 0] } },
                  { $toDouble: { $ifNull: ["$gsisPremium", 0] } },
                  { $toDouble: { $ifNull: ["$philhealthPremium", 0] } },
                  { $toDouble: { $ifNull: ["$pagibigPremium", 0] } },
                  { $toDouble: { $ifNull: ["$employeeCompensation", 0] } },
                  { $toDouble: { $ifNull: ["$loyaltyAward", 0] } },
                  { $toDouble: { $ifNull: ["$overtimePay", 0] } },
                  { $toDouble: { $ifNull: ["$earnedLeaves", 0] } },
                  { $toDouble: { $ifNull: ["$retirementBenefits", 0] } },
                  { $toDouble: { $ifNull: ["$terminalLeave", 0] } },
                  { $toDouble: { $ifNull: ["$courtAppearance", 0] } }
                ]
              }
            }
          },
          {
            $group: {
              _id: {
                processBy: "$processBy",
                region: "$region",
                department: "$department",
                statusOfAppointment: "$statusOfAppointment"
              },
              totalCost: { $sum: "$computedTotal" }
            }
          }
        ]);

        // Aggregate Department + Division data
        const aggregatedPersonnel = [...deptPersonnel, ...divisionPersonnel].reduce((acc, item) => {
          const key = `${item._id.processBy}_${item._id.region}_${item._id.statusOfAppointment}`;
          if (!acc[key]) {
            acc[key] = {
              _id: item._id,
              totalCost: 0
            };
          }
          acc[key].totalCost += item.totalCost || 0;
          return acc;
        }, {});

        departmentPersonnelAggregation = Object.values(aggregatedPersonnel);
      }
    }

    // Transform personnel data for proposal summary
    // Use hierarchical aggregation for Department users, otherwise use regular aggregation
    const personnelDataToTransform = departmentPersonnelAggregation.length > 0 ? departmentPersonnelAggregation : personnel;
    const personnelTransformed = personnelDataToTransform.map((p) => ({
      processBy: p._id.processBy,
      region: p._id.region,
      fiscalYear,
      budgetType,
      submittedDate: new Date(),
      status,
      cobExpenditures: `Personnel Services - ${p._id.statusOfAppointment}`,
      totalExpenses: Number(p.totalCost) || 0,  // Ensure it's a number
      totalIncome: 0,
      isHierarchicallyAggregated: departmentPersonnelAggregation.length > 0 // Flag for hierarchical aggregation
    }));
    // Calculate MOOE expenses and income with hierarchical aggregation
    const mooe = await MooeProposal.aggregate([
      { $match: { status, fiscalYear, budgetType, processBy, region } },
      {
        $group: {
          _id: { processBy: "$processBy", region: "$region" },
          totalCost: { $sum: { $toDouble: { $ifNull: ["$amount", 0] } } },
          totalIncome: { $sum: { $toDouble: { $ifNull: ["$income", 0] } } },
        },
      },
    ]);

    // For Department level aggregation, also include Division-level submitted data
    let departmentMooeAggregation = [];
    if (req.hierarchicalAccess?.scope === 'DEPARTMENT') {
      const deptRegion = req.hierarchicalAccess.accessibleRegions?.[0]?.regionName;
      const deptName = req.hierarchicalAccess.accessibleDepartments?.[0]?.departmentName;

      console.log(`🔄 DEPARTMENT MOOE AGGREGATION: Processing for ${deptRegion} - ${deptName}`);

      if (deptRegion && deptName) {
        // Get Department-level MOOE data
        const deptMooe = await MooeProposal.aggregate([
          {
            $match: {
              status,
              fiscalYear,
              budgetType,
              region: deptRegion,
              department: deptName,
              $or: [
                { division: { $exists: false } },
                { division: null },
                { division: "" }
              ]
            }
          },
          {
            $group: {
              _id: { processBy: "$processBy", region: "$region", department: "$department" },
              totalCost: { $sum: { $toDouble: { $ifNull: ["$amount", 0] } } },
              totalIncome: { $sum: { $toDouble: { $ifNull: ["$income", 0] } } },
            },
          },
        ]);

        // Get Division-level submitted MOOE data for this department
        const divisionMooe = await MooeProposal.aggregate([
          {
            $match: {
              status: { $in: ["Submitted", "Approved", "Completed"] }, // Only submitted divisions
              fiscalYear,
              budgetType,
              region: deptRegion,
              department: deptName,
              division: { $exists: true, $ne: null, $ne: "" }
            }
          },
          {
            $group: {
              _id: { processBy: "$processBy", region: "$region", department: "$department" },
              totalCost: { $sum: { $toDouble: { $ifNull: ["$amount", 0] } } },
              totalIncome: { $sum: { $toDouble: { $ifNull: ["$income", 0] } } },
            },
          },
        ]);

        // Aggregate Department + Division data
        const aggregatedMooe = [...deptMooe, ...divisionMooe].reduce((acc, item) => {
          const key = `${item._id.processBy}_${item._id.region}_${item._id.department || 'DEPT'}`;
          if (!acc[key]) {
            acc[key] = {
              _id: item._id,
              totalCost: 0,
              totalIncome: 0
            };
          }
          acc[key].totalCost += item.totalCost || 0;
          acc[key].totalIncome += item.totalIncome || 0;
          return acc;
        }, {});

        departmentMooeAggregation = Object.values(aggregatedMooe);
      }
    }
    // Transform MOOE data for proposal summary
    // Use hierarchical aggregation for Department users, otherwise use regular aggregation
    const mooeDataToTransform = departmentMooeAggregation.length > 0 ? departmentMooeAggregation : mooe;
    const mooeTransformed = mooeDataToTransform.map((p) => ({
      processBy: p._id.processBy,
      region: p._id.region,
      fiscalYear,
      budgetType,
      submittedDate: new Date(),
      status,
      cobExpenditures: "MOOE",
      totalExpenses: Number(p.totalCost) || 0,  // Ensure it's a number
      totalIncome: Number(p.totalIncome) || 0,  // Use calculated income from MOOE records
      isHierarchicallyAggregated: departmentMooeAggregation.length > 0 // Flag for hierarchical aggregation
    }));
    // Calculate Capital Outlay expenses and income
    const capitalOutlays = await CapitalOutlay.aggregate([
      { $match: { status, fiscalYear, budgetType, processBy, region } },
      {
        $group: {
          _id: { processBy: "$processBy", region: "$region" },
          totalCost: { $sum: { $toDouble: { $ifNull: ["$cost", 0] } } },
          totalIncome: { $sum: { $toDouble: { $ifNull: ["$income", 0] } } },
        },
      },
    ]);

    // For Department level aggregation, also include Division-level submitted data
    let departmentCapitalOutlayAggregation = [];
    if (req.hierarchicalAccess?.scope === 'DEPARTMENT') {
      const deptRegion = req.hierarchicalAccess.accessibleRegions?.[0]?.regionName;
      const deptName = req.hierarchicalAccess.accessibleDepartments?.[0]?.departmentName;

      console.log(`🔄 DEPARTMENT CAPITAL OUTLAY AGGREGATION: Processing for ${deptRegion} - ${deptName}`);

      if (deptRegion && deptName) {
        // Get Department-level Capital Outlay data
        const deptCapitalOutlay = await CapitalOutlay.aggregate([
          {
            $match: {
              status,
              fiscalYear,
              budgetType,
              region: deptRegion,
              department: deptName,
              $or: [
                { division: { $exists: false } },
                { division: null },
                { division: "" }
              ]
            }
          },
          {
            $group: {
              _id: { processBy: "$processBy", region: "$region", department: "$department" },
              totalCost: { $sum: { $toDouble: { $ifNull: ["$cost", 0] } } },
              totalIncome: { $sum: { $toDouble: { $ifNull: ["$income", 0] } } },
            },
          },
        ]);

        // Get Division-level submitted Capital Outlay data for this department
        const divisionCapitalOutlay = await CapitalOutlay.aggregate([
          {
            $match: {
              status: { $in: ["Submitted", "Approved", "Completed"] }, // Only submitted divisions
              fiscalYear,
              budgetType,
              region: deptRegion,
              department: deptName,
              division: { $exists: true, $ne: null, $ne: "" }
            }
          },
          {
            $group: {
              _id: { processBy: "$processBy", region: "$region", department: "$department" },
              totalCost: { $sum: { $toDouble: { $ifNull: ["$cost", 0] } } },
              totalIncome: { $sum: { $toDouble: { $ifNull: ["$income", 0] } } },
            },
          },
        ]);

        // Aggregate Department + Division data
        const aggregatedCapitalOutlay = [...deptCapitalOutlay, ...divisionCapitalOutlay].reduce((acc, item) => {
          const key = `${item._id.processBy}_${item._id.region}_${item._id.department || 'DEPT'}`;
          if (!acc[key]) {
            acc[key] = {
              _id: item._id,
              totalCost: 0,
              totalIncome: 0
            };
          }
          acc[key].totalCost += item.totalCost || 0;
          acc[key].totalIncome += item.totalIncome || 0;
          return acc;
        }, {});

        departmentCapitalOutlayAggregation = Object.values(aggregatedCapitalOutlay);
      }
    }
    // Transform Capital Outlay data for proposal summary
    // Use hierarchical aggregation for Department users, otherwise use regular aggregation
    const capitalOutlayDataToTransform = departmentCapitalOutlayAggregation.length > 0 ? departmentCapitalOutlayAggregation : capitalOutlays;
    const capitalOutlaysTransformed = capitalOutlayDataToTransform.map((p) => ({
      processBy: p._id.processBy,
      region: p._id.region,
      fiscalYear,
      budgetType,
      submittedDate: new Date(),
      status,
      cobExpenditures: "Capital Outlay",
      totalExpenses: Number(p.totalCost) || 0,  // Ensure it's a number
      totalIncome: Number(p.totalIncome) || 0,  // Use calculated income from Capital Outlay records
      isHierarchicallyAggregated: departmentCapitalOutlayAggregation.length > 0 // Flag for hierarchical aggregation
    }));
    // Calculate Income with consistent filtering
    const income = await Income.aggregate([
      { 
        $match: { 
          status, 
          fiscalYear, 
          budgetType, 
          processBy, 
          region 
        } 
      },
      {
        $group: {
          _id: { 
            processBy: "$processBy", 
            region: "$region" 
          },
          totalAmount: { 
            $sum: { 
              $toDouble: { 
                $ifNull: ["$amount", 0] 
              } 
            } 
          },
        },
      },
    ]);
    // Transform Income data for proposal summary with explicit conversion
    const incomeTransformed = income.map((p) => {
      const totalIncome = Number(p.totalAmount) || 0;
      return {
        processBy: p._id.processBy,
        region: p._id.region,
        fiscalYear,
        budgetType,
        submittedDate: new Date(),
        status,
        cobExpenditures: "Income",
        totalExpenses: 0,
        totalIncome: totalIncome
      };
    });
    const summary = [
      ...personnelTransformed,
      ...mooeTransformed,
      ...capitalOutlaysTransformed,
      ...incomeTransformed,
    ];
    // Optimize: Use bulkWrite for better performance instead of sequential updates
    if (summary.length > 0) {
      const bulkOps = summary.map(item => ({
        updateOne: {
          filter: {
            processBy: item.processBy,
            region: item.region,
            fiscalYear: item.fiscalYear,
            budgetType: item.budgetType,
            cobExpenditures: item.cobExpenditures,
          },
          update: {
            $set: {
              submittedDate: item.submittedDate,
              status: item.status,
              totalExpenses: item.totalExpenses,
              totalIncome: item.totalIncome,
            },
          },
          upsert: true
        }
      }));
      const bulkResult = await Proposal.bulkWrite(bulkOps);
      }
    return res.status(200).json({
      message: "Proposals status updated and summary saved successfully",
    });
  } catch (error) {
    console.error("Error updating proposal status and saving summary:", error.stack);
    return res.status(500).json({
      message: "Error updating proposal status and saving summary",
      error: error.message,
    });
  }
};
exports.saveAsDraft = async (req, res) => {
  try {
    let {
      personnelIds,
      mooeIds,
      capitalOutlayIds,
      incomeIds,
      budgetarySupportIds,
      fiscalYear,
      budgetType,
      processBy,
      region
    } = req.body;
    // Enhanced validation with detailed error messages
    const missingFields = [];
    if (!fiscalYear) missingFields.push('fiscalYear');
    if (!budgetType) missingFields.push('budgetType');
    if (!processBy) missingFields.push('processBy');
    if (!region) missingFields.push('region');
    if (missingFields.length > 0) {
      console.error("Missing required fields:", missingFields);
      console.error("Full request body:", req.body);
      return res.status(400).json({
        message: `Missing required fields: ${missingFields.join(', ')}`,
        missingFields,
        receivedData: req.body
      });
    }
    // Log the region being used for this draft
    // Ensure region is properly set
    if (!region) {
      return res.status(400).json({
        message: "Region is required for saving drafts",
        error: "REGION_REQUIRED"
      });
    }
    // IMPORTANT: We will only update items that already belong to this region
    // This prevents changing the region of items from other regions
    fiscalYear = fiscalYear.toString();
    // Create or update draft proposal
    const draftData = {
      fiscalYear,
      budgetType,
      processBy,
      region,
      status: "Draft",
      lastEditedAt: new Date(),
      // Add any other fields needed
      cobExpenditures: [],
      totalAmount: 0
    };
    // Try to find existing draft
    let existingDraft = await DraftProposal.findOne({
      fiscalYear,
      budgetType,
      processBy,
      region
    });
    if (existingDraft) {
      existingDraft = await DraftProposal.findByIdAndUpdate(
        existingDraft._id,
        draftData,
        { new: true }
      );
    } else {
      const newDraft = new DraftProposal(draftData);
      existingDraft = await newDraft.save();
    }
    // Check if there are any proposals to update
    const totalProposals = (personnelIds?.length || 0) + (mooeIds?.length || 0) +
                          (capitalOutlayIds?.length || 0) + (incomeIds?.length || 0) +
                          (budgetarySupportIds?.length || 0);
    if (totalProposals === 0) {
      return res.status(200).json({
        message: "No proposals were provided to save as draft",
        draft: existingDraft,
        warning: "No proposal items were updated"
      });
    }
    // Update related items to Draft status
    if (personnelIds && Array.isArray(personnelIds) && personnelIds.length > 0) {
      const validPersonnelIds = personnelIds
        .filter((id) => {
          const isValid = mongoose.Types.ObjectId.isValid(id);
          if (!isValid) {
            console.error("Invalid Personnel id encountered:", id);
          }
          return isValid;
        })
        .map((id) => new mongoose.Types.ObjectId(id));
      // CRITICAL: Only update items that already belong to this region
      // This prevents changing the region of items from other regions
      const personnelResult = await PersonnelService.updateMany(
        { 
          _id: { $in: validPersonnelIds },
          region: region  // Only update items that already belong to this region
        },
        { 
          $set: { 
            status: "Draft", 
            fiscalYear, 
            budgetType, 
            processBy
            // Don't set region here as we're only updating items that already have this region
          } 
        }
      );
      }
    // Update MOOE proposals to Draft status
    if (mooeIds && Array.isArray(mooeIds) && mooeIds.length > 0) {
      const validMooeIds = mooeIds
        .filter((id) => {
          const isValid = mongoose.Types.ObjectId.isValid(id);
          if (!isValid) {
            console.error("Invalid MOOE id encountered:", id);
          }
          return isValid;
        })
        .map((id) => new mongoose.Types.ObjectId(id));
      // CRITICAL: Only update items that already belong to this region
      const mooeResult = await MooeProposal.updateMany(
        { 
          _id: { $in: validMooeIds },
          region: region  // Only update items that already belong to this region
        },
        { 
          $set: { 
            status: "Draft", 
            fiscalYear, 
            budgetType, 
            processBy
            // Don't set region here as we're only updating items that already have this region
          } 
        }
      );
      }
    // Update Capital Outlay proposals to Draft status
    if (capitalOutlayIds && Array.isArray(capitalOutlayIds) && capitalOutlayIds.length > 0) {
      const validCapitalIds = capitalOutlayIds
        .filter((id) => {
          const isValid = mongoose.Types.ObjectId.isValid(id);
          if (!isValid) {
            console.error("Invalid Capital Outlay id encountered:", id);
          }
          return isValid;
        })
        .map((id) => new mongoose.Types.ObjectId(id));
      // CRITICAL: Only update items that already belong to this region
      const capitalResult = await CapitalOutlay.updateMany(
        { 
          _id: { $in: validCapitalIds },
          region: region  // Only update items that already belong to this region
        },
        { 
          $set: { 
            status: "Draft", 
            fiscalYear, 
            budgetType, 
            processBy
            // Don't set region here as we're only updating items that already have this region
          } 
        }
      );
      }
    // Update Budgetary Support proposals to Draft status
    if (budgetarySupportIds && Array.isArray(budgetarySupportIds) && budgetarySupportIds.length > 0) {
      const validBudgetaryIds = budgetarySupportIds
        .filter((id) => {
          const isValid = mongoose.Types.ObjectId.isValid(id);
          if (!isValid) {
            console.error("Invalid Budgetary Support id encountered:", id);
          }
          return isValid;
        })
        .map((id) => new mongoose.Types.ObjectId(id));
      // CRITICAL: Only update items that already belong to this region
      const budgetaryResult = await BudgetarySupport.updateMany(
        { 
          _id: { $in: validBudgetaryIds },
          region: region  // Only update items that already belong to this region
        },
        { 
          $set: { 
            status: "Draft", 
            fiscalYear, 
            budgetType, 
            processBy
            // Don't set region here as we're only updating items that already have this region
          } 
        }
      );
      }
    // Update Income proposals to Draft status
    if (incomeIds && Array.isArray(incomeIds) && incomeIds.length > 0) {
      const validIncomeIds = incomeIds
        .filter((id) => {
          const isValid = mongoose.Types.ObjectId.isValid(id);
          if (!isValid) {
            console.error("Invalid Income id encountered:", id);
          }
          return isValid;
        })
        .map((id) => new mongoose.Types.ObjectId(id));
      // CRITICAL: Only update items that already belong to this region
      const incomeResult = await Income.updateMany(
        { 
          _id: { $in: validIncomeIds },
          region: region  // Only update items that already belong to this region
        },
        { 
          $set: { 
            status: "Draft", 
            fiscalYear, 
            budgetType, 
            processBy
            // Don't set region here as we're only updating items that already have this region
          } 
        }
      );
      }
    // Create default result objects for categories that weren't processed
    let personnelResultObj = { modifiedCount: 0 };
    let mooeResultObj = { modifiedCount: 0 };
    let capitalResultObj = { modifiedCount: 0 };
    let budgetaryResultObj = { modifiedCount: 0 };
    let incomeResultObj = { modifiedCount: 0 };
    // Use the actual results if they exist
    if (personnelIds && Array.isArray(personnelIds) && personnelIds.length > 0 && typeof personnelResult !== 'undefined') {
      personnelResultObj = personnelResult;
    }
    if (mooeIds && Array.isArray(mooeIds) && mooeIds.length > 0 && typeof mooeResult !== 'undefined') {
      mooeResultObj = mooeResult;
    }
    if (capitalOutlayIds && Array.isArray(capitalOutlayIds) && capitalOutlayIds.length > 0 && typeof capitalResult !== 'undefined') {
      capitalResultObj = capitalResult;
    }
    if (budgetarySupportIds && Array.isArray(budgetarySupportIds) && budgetarySupportIds.length > 0 && typeof budgetaryResult !== 'undefined') {
      budgetaryResultObj = budgetaryResult;
    }
    if (incomeIds && Array.isArray(incomeIds) && incomeIds.length > 0 && typeof incomeResult !== 'undefined') {
      incomeResultObj = incomeResult;
    }
    // Count how many items were actually updated
    const updatedCounts = {
      personnel: personnelResultObj.modifiedCount || 0,
      mooe: mooeResultObj.modifiedCount || 0,
      capitalOutlay: capitalResultObj.modifiedCount || 0,
      budgetarySupport: budgetaryResultObj.modifiedCount || 0,
      income: incomeResultObj.modifiedCount || 0
    };
    const totalUpdated = Object.values(updatedCounts).reduce((sum, count) => sum + count, 0);
    // Check if any items were not updated because they belong to a different region
    const notUpdatedCounts = {
      personnel: personnelIds && Array.isArray(personnelIds) ? personnelIds.length - (personnelResultObj.modifiedCount || 0) : 0,
      mooe: mooeIds && Array.isArray(mooeIds) ? mooeIds.length - (mooeResultObj.modifiedCount || 0) : 0,
      capitalOutlay: capitalOutlayIds && Array.isArray(capitalOutlayIds) ? capitalOutlayIds.length - (capitalResultObj.modifiedCount || 0) : 0,
      budgetarySupport: budgetarySupportIds && Array.isArray(budgetarySupportIds) ? budgetarySupportIds.length - (budgetaryResultObj.modifiedCount || 0) : 0,
      income: incomeIds && Array.isArray(incomeIds) ? incomeIds.length - (incomeResultObj.modifiedCount || 0) : 0
    };
    const totalNotUpdated = Object.values(notUpdatedCounts).reduce((sum, count) => sum + count, 0);
    if (totalNotUpdated > 0) {
      }
    return res.status(200).json({
      message: `Proposal saved as draft successfully. ${totalUpdated} items updated.`,
      draft: existingDraft,
      updatedCounts,
      notUpdatedCounts,
      warning: totalNotUpdated > 0 ? 
        `${totalNotUpdated} items were not updated because they belong to a different region than ${region}` : 
        undefined
    });
  } catch (error) {
    console.error("Error saving proposal as draft:", error.stack);
    return res.status(500).json({
      message: "Error saving proposal as draft",
      error: error.message,
    });
  }
};
// ... (rest of the controller remains unchanged)
exports.createProposal = async (req, res) => {
  try {
    const proposalData = { ...req.body };
    // Apply hierarchical consolidation if user has assignment
    if (req.userHierarchicalAssignment && req.userHierarchicalAssignment.assignmentLevel !== 'NONE') {
      const assignment = req.userHierarchicalAssignment;
      // Set the organizational context based on user's assignment level
      switch (assignment.assignmentLevel) {
        case 'DIVISION':
          // Division users: data consolidates to department level, but track original division
          proposalData.region = assignment.regions[0]?.regionName;
          proposalData.department = assignment.departments[0]?.departmentName;
          proposalData.division = assignment.divisions[0];
          proposalData.originalDivision = assignment.divisions[0]; // Track original for reference
          break;
        case 'DEPARTMENT':
          // Department users: data consolidates to region level, but track original department
          proposalData.region = assignment.regions[0]?.regionName;
          proposalData.department = assignment.departments[0]?.departmentName;
          proposalData.originalDepartment = assignment.departments[0]?.departmentName;
          break;
        case 'REGION':
          // Region users: data stays at region level
          proposalData.region = assignment.regions[0]?.regionName;
          break;
        case 'FULL':
          // Full access users can specify any organizational context
          // Keep the data as provided in request
          break;
      }
      // Add audit fields
      proposalData.createdByAssignmentLevel = assignment.assignmentLevel;
      proposalData.createdByUserId = req.user.id;
      
      // Add consolidation metadata
      proposalData.consolidationMetadata = {
        submittedBy: req.user.id,
        submittedByLevel: assignment.assignmentLevel,
        submissionTimestamp: new Date(),
        consolidationApplied: true,
        originalContext: {
          region: req.body.region,
          department: req.body.department,
          division: req.body.division
        },
        consolidatedContext: {
          region: proposalData.region,
          department: proposalData.department,
          division: proposalData.division
        }
      };
    }
    const newProposal = new Proposal(proposalData);
    const savedProposal = await newProposal.save();
    res.status(201).json(savedProposal);
  } catch (error) {
    console.error('Error creating proposal:', error);
    res.status(400).json({ error: error.message });
  }
};
exports.getProposals = async (req, res) => {
  try {
    const { 
      page = 0, 
      limit = 20, 
      sort = "updatedAt", 
      order = "desc", 
      search = "",
      filterField = "",
      filterValue = "",
      filterOperator = "="
    } = req.query;
    // Convert page and limit to numbers
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    // Build the query
    let query = {};
    // Apply submission workflow filters first (these respect submission status)
    if (req.submissionWorkflowFilters) {
      Object.assign(query, req.submissionWorkflowFilters);
      }
    // Fallback to hierarchical filters if submission workflow not available
    else if (req.hierarchicalFilters) {
      Object.assign(query, req.hierarchicalFilters);
      }
    // Add search condition if provided
    if (search) {
      const searchConditions = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { processBy: { $regex: search, $options: 'i' } },
        { region: { $regex: search, $options: 'i' } }
      ];
      // If filters exist, combine with AND
      if (Object.keys(query).length > 0) {
        const originalFilters = { ...query };
        query = {
          $and: [
            originalFilters,
            { $or: searchConditions }
          ]
        };
      } else {
        query.$or = searchConditions;
      }
    }
    // Add filter condition if provided
    if (filterField && filterValue) {
      if (filterOperator === "=") {
        query[filterField] = filterValue;
      } else if (filterOperator === ">") {
        query[filterField] = { $gt: filterValue };
      } else if (filterOperator === "<") {
        query[filterField] = { $lt: filterValue };
      } else if (filterOperator === ">=") {
        query[filterField] = { $gte: filterValue };
      } else if (filterOperator === "<=") {
        query[filterField] = { $lte: filterValue };
      }
    }
    // Submitted-only view for Department-level All Proposals
    if (String(req.query.submittedOnly) === 'true' && req.hierarchicalAccessInfo?.scope === 'DEPARTMENT') {
      // Show only division submissions that have been submitted/verified/submitted to region/approved/finalized
      const submittedStatuses = ['Division Submitted','DIVISION SUBMITTED','Department Verified','DEPARTMENT VERIFIED','Department Submitted','DEPARTMENT SUBMITTED','Region Approved','REGION APPROVED','Finalized'];
      query = {
        $and: [
          query,
          { division: { $exists: true, $ne: null, $ne: '' } },
          { originalLevel: 'DIVISION' },
          { status: { $in: submittedStatuses } }
        ]
      };
    }
    // First, let's check how many total proposals exist in the database
    const totalProposalsInDB = await Proposal.countDocuments();
    // Check what proposals exist for this user
    if (totalProposalsInDB > 0) {
      const sampleProposals = await Proposal.find().limit(3);
      sampleProposals.forEach((proposal, index) => {
        });
    }
    // Get data from all proposal models
    const sortOrder = order === "asc" ? 1 : -1;
    const skipCount = pageNum * limitNum;

    // Query all models in parallel (unpaginated for correct aggregation)
    const [proposals, personnelData, mooeData, capitalData, incomeData] = await Promise.all([
      Proposal.find(query).lean(),
      PersonnelService.find(query).lean(),
      MooeProposal.find(query).lean(), 
      CapitalOutlay.find(query).lean(),
      Income.find(query).lean()
    ]);

    // Combine all data and add model type identifier + cobExpenditures for consistent display
    const allProposals = [
      ...proposals.map(p => ({ ...p, modelType: 'proposal' })), 
      // Aggregate Personnel Services (merge CASUAL and PERMANENT into one)
      ...(() => {
        const psGroups = new Map();

        // Fields contributing to Personnel Services totals
        const psFields = [
          'annualSalary','RATA','PERA','uniformALLOWANCE','productivityIncentive','medical','childrenAllowance','meal','cashGift','subsistenceAllowanceMDS','subsistenceAllowanceST','midyearBonus','yearEndBonus','gsisPremium','philhealthPremium','pagibigPremium','employeeCompensation','loyaltyAward','overtimePay','earnedLeaves','retirementBenefits','terminalLeave','courtAppearance'
        ];

        const toNumber = (val) => {
          if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
          if (val == null) return 0;
          const cleaned = String(val).replace(/[^0-9.-]/g, '');
          const n = parseFloat(cleaned);
          return Number.isFinite(n) ? n : 0;
        };
        const calcPSTotal = (item) => psFields.reduce((sum, f) => sum + toNumber(item?.[f]), 0);

        const norm = (v) => String(v ?? '').trim().toUpperCase();
        const scope = req.hierarchicalAccessInfo?.scope?.toUpperCase() || 'REGION';
        personnelData.forEach(p => {
          // Dynamic grouping by scope: REGION -> region only; DEPARTMENT -> +department; DIVISION -> +department +division
          const parts = [
            // For Division scope, merge across processBy (do not include in key)
            norm(p.region) || 'UNKNOWN',
            norm(p.fiscalYear) || 'UNKNOWN',
            norm(p.budgetType) || 'UNKNOWN'
          ];
          if (scope !== 'DIVISION') {
            // Keep processBy separation for Region/Department
            parts.unshift(norm(p.processBy) || 'UNKNOWN');
          }
          if (scope === 'DEPARTMENT' || scope === 'DIVISION') {
            parts.push(norm(p.department) || 'UNKNOWN');
          }
          if (scope === 'DIVISION') {
            parts.push(norm(p.division) || 'UNKNOWN');
          }
          const key = parts.join('-');
          if (psGroups.has(key)) {
            const existing = psGroups.get(key);
            // Accumulate only the total; keep breakdown fields zeroed to avoid UI double-summing
            existing.Total = (Number(existing.Total) || 0) + calcPSTotal(p);
            existing.recordCount = (existing.recordCount || 1) + 1;
            if (p.Employment || p.statusOfAppointment) {
              existing.statusTypes.add(p.Employment || p.statusOfAppointment);
            }
            existing.personnelIds = existing.personnelIds || [];
            if (p._id) existing.personnelIds.push(String(p._id));
          } else {
            // Start a new aggregated record; copy some identifying fields from the first item
            const base = {
              ...p,
              modelType: 'personnel',
              cobExpenditures: 'Personnel Services',
              recordCount: 1,
              statusTypes: new Set(),
              personnelIds: p._id ? [String(p._id)] : [],
            };
            // Zero-out PS breakdown fields so the UI uses Total as fallback
            psFields.forEach(f => { base[f] = 0; });
            base.Total = calcPSTotal(p);
            if (p.Employment || p.statusOfAppointment) {
              base.statusTypes.add(p.Employment || p.statusOfAppointment);
            }
            psGroups.set(key, base);
          }
        });

        // Convert Set to array for serialization and map to plain objects
        return Array.from(psGroups.values()).map(rec => ({
          ...rec,
          statusTypes: Array.from(rec.statusTypes || [])
        }));
      })(),
      // Aggregate MOOE records by processBy, region, fiscalYear, budgetType (dynamic by scope)
      ...(() => {
        const mooeGroups = new Map();
        const norm = (v) => String(v ?? '').trim().toUpperCase();
        const scope = req.hierarchicalAccessInfo?.scope?.toUpperCase() || 'REGION';
        
        mooeData.forEach(p => {
          const parts = [
            norm(p.processBy) || 'UNKNOWN',
            norm(p.region) || 'UNKNOWN',
            norm(p.fiscalYear) || 'UNKNOWN',
            norm(p.budgetType) || 'UNKNOWN'
          ];
          if (scope === 'DEPARTMENT' || scope === 'DIVISION') {
            parts.push(norm(p.department) || 'UNKNOWN');
          }
          if (scope === 'DIVISION') {
            parts.push(norm(p.division) || 'UNKNOWN');
          }
          // Preserve status split as before
          parts.push(norm(p.status) || 'UNKNOWN');
          const groupKey = parts.join('-');
          
          if (mooeGroups.has(groupKey)) {
            const existing = mooeGroups.get(groupKey);
            // Aggregate amounts
            existing.income = (existing.income || 0) + (p.income || 0);
            existing.subsidy = (existing.subsidy || 0) + (p.subsidy || 0);
            existing.amount = (existing.amount || 0) + (p.amount || 0);
            // Keep track of aggregated records count
            existing.recordCount = (existing.recordCount || 1) + 1;
            existing.accountingTitles = existing.accountingTitles || [];
            if (p.accountingTitle && !existing.accountingTitles.includes(p.accountingTitle)) {
              existing.accountingTitles.push(p.accountingTitle);
            }
          } else {
            const mooeRecord = {
              ...p,
              modelType: 'mooe',
              cobExpenditures: 'MOOE',
              recordCount: 1,
              accountingTitles: p.accountingTitle ? [p.accountingTitle] : []
            };
            mooeGroups.set(groupKey, mooeRecord);
          }
        });
        
        return Array.from(mooeGroups.values()).map(record => ({
          ...record,
          // Create a combined title if multiple records were aggregated
          aggregatedTitle: record.recordCount > 1 
            ? `MOOE (${record.recordCount} items: ${record.accountingTitles.join(', ')})`
            : record.accountingTitle || 'MOOE'
        }));
      })(),
      // Aggregate Capital Outlay records by processBy, region, fiscalYear, budgetType (dynamic by scope)
      ...(() => {
        const capitalGroups = new Map();
        const norm = (v) => String(v ?? '').trim().toUpperCase();
        const scope = req.hierarchicalAccessInfo?.scope?.toUpperCase() || 'REGION';
        
        capitalData.forEach(p => {
          const parts = [
            norm(p.processBy) || 'UNKNOWN',
            norm(p.region) || 'UNKNOWN',
            norm(p.fiscalYear) || 'UNKNOWN',
            norm(p.budgetType) || 'UNKNOWN'
          ];
          if (scope === 'DEPARTMENT' || scope === 'DIVISION') {
            parts.push(norm(p.department) || 'UNKNOWN');
          }
          if (scope === 'DIVISION') {
            parts.push(norm(p.division) || 'UNKNOWN');
          }
          // Preserve status split as before
          parts.push(norm(p.status) || 'UNKNOWN');
          const groupKey = parts.join('-');
          
          if (capitalGroups.has(groupKey)) {
            const existing = capitalGroups.get(groupKey);
            // Aggregate amounts
            existing.income = (existing.income || 0) + (p.income || 0);
            existing.subsidy = (existing.subsidy || 0) + (p.subsidy || 0);
            existing.cost = (existing.cost || 0) + (p.cost || 0);
            existing.amount = (existing.amount || 0) + (p.amount || 0);
            // Keep track of aggregated records count
            existing.recordCount = (existing.recordCount || 1) + 1;
            existing.accountingTitles = existing.accountingTitles || [];
            if (p.accountingTitle && !existing.accountingTitles.includes(p.accountingTitle)) {
              existing.accountingTitles.push(p.accountingTitle);
            }
          } else {
            const capitalRecord = {
              ...p,
              modelType: 'capital',
              cobExpenditures: 'Capital Outlay',
              recordCount: 1,
              accountingTitles: p.accountingTitle ? [p.accountingTitle] : []
            };
            capitalGroups.set(groupKey, capitalRecord);
          }
        });
        
        return Array.from(capitalGroups.values()).map(record => ({
          ...record,
          // Create a combined title if multiple records were aggregated
          aggregatedTitle: record.recordCount > 1 
            ? `Capital Outlay (${record.recordCount} items: ${record.accountingTitles.join(', ')})`
            : record.accountingTitle || 'Capital Outlay'
        }));
      })(),
      // Aggregate Income records by processBy, region, fiscalYear, budgetType, status
      ...(() => {
        const incomeGroups = new Map();
        
        incomeData.forEach(p => {
          const groupKey = `${p.processBy || 'Unknown'}-${p.region || 'Unknown'}-${p.fiscalYear || 'Unknown'}-${p.budgetType || 'Unknown'}-${p.status || 'Unknown'}`;
          
          if (incomeGroups.has(groupKey)) {
            const existing = incomeGroups.get(groupKey);
            // Aggregate amounts
            existing.amount = (existing.amount || 0) + (p.amount || 0);
            // Keep track of aggregated records count
            existing.recordCount = (existing.recordCount || 1) + 1;
            existing.particularsArray = existing.particularsArray || [];
            if (p.particulars && !existing.particularsArray.includes(p.particulars)) {
              existing.particularsArray.push(p.particulars);
            }
          } else {
            const incomeRecord = {
              ...p,
              modelType: 'income',
              cobExpenditures: 'Corporate Income',
              recordCount: 1,
              particularsArray: p.particulars ? [p.particulars] : []
            };
            incomeGroups.set(groupKey, incomeRecord);
          }
        });
        
        return Array.from(incomeGroups.values()).map(record => ({
          ...record,
          // Create a combined title if multiple records were aggregated
          aggregatedTitle: record.recordCount > 1 
            ? `Corporate Income (${record.recordCount} items: ${record.particularsArray.join(', ')})`
            : record.particulars || 'Corporate Income',
          // Set particulars to show aggregated info
          particulars: record.recordCount > 1 
            ? `Corporate Income (${record.recordCount} items)`
            : record.particulars
        }));
      })()
    ];

    // Enrich results with origin/current level and approval info
    const inferOriginLevel = (doc) => {
      const orig = (doc.originalLevel || doc.workflowLevel || '').toUpperCase();
      if (orig) return orig;
      if (doc.division) return 'DIVISION';
      if (doc.department) return 'DEPARTMENT';
      return 'REGION';
    };
    const mapLevelFromStatus = (status) => {
      const s = String(status || '').toUpperCase();
      if (s.includes('FINAL')) return 'FINALIZED';
      if (s.includes('REGION')) return 'REGION';
      if (s.includes('DEPARTMENT')) return 'DEPARTMENT';
      return 'DIVISION';
    };
    const inferCurrentLevel = (doc) => {
      if (doc.workflowLevel) return String(doc.workflowLevel).toUpperCase();
      return mapLevelFromStatus(doc.status);
    };
    const makeLabel = (level, doc) => {
      const L = String(level || '').toUpperCase();
      if (L === 'DIVISION') return doc.division ? `DIVISION: ${doc.division}` : 'DIVISION';
      if (L === 'DEPARTMENT') return doc.department ? `DEPARTMENT: ${doc.department}` : 'DEPARTMENT';
      if (L === 'REGION') return doc.region ? `REGION: ${doc.region}` : 'REGION';
      if (L === 'FINALIZED') return 'FINALIZED';
      return L || 'UNKNOWN';
    };
    const pickLatest = (dates) => {
      return dates
        .map(d => (d ? new Date(d) : null))
        .filter(Boolean)
        .sort((a,b)=>b-a)[0] || null;
    };
    const enrichOne = (item) => {
      const originLevel = inferOriginLevel(item);
      const currentLevel = inferCurrentLevel(item);
      const originLabel = makeLabel(originLevel, item);
      const currentOwnerLabel = makeLabel(currentLevel, item);
      // Approval/verification metadata (best-effort across models)
      const approvalInfo = {
        lastActionBy: item.lastActionBy || item.submittedToRegionBy || item.submittedToDepartmentBy || null,
        lastActionDate: item.lastActionDate || pickLatest([item.finalApprovedAt, item.regionApprovedDate, item.departmentVerifiedDate, item.submittedDate]) || null,
        departmentVerifiedBy: item.departmentVerifiedBy || item?.departmentConsolidated?.by || null,
        departmentVerifiedAt: item.departmentVerifiedDate || item?.departmentConsolidated?.at || item.submittedToDepartmentAt || null,
        regionApprovedBy: item.regionApprovedBy || item.finalApprovedBy || item?.regionFinalVerified?.by || null,
        regionApprovedAt: item.regionApprovedDate || item.finalApprovedAt || item?.regionFinalVerified?.at || item.submittedToRegionAt || null,
        submittedToDepartmentBy: item.submittedToDepartmentBy || null,
        submittedToDepartmentAt: item.submittedToDepartmentAt || null,
        submittedToRegionBy: item.submittedToRegionBy || null,
        submittedToRegionAt: item.submittedToRegionAt || null
      };
      return { ...item, originLevel, originLabel, currentLevel, currentOwnerLabel, approvalInfo };
    };

    // If PS/MOOE/Capital entries were aggregated, keep aggregation but also aggregate approval info sensibly
    const enrichedProposals = allProposals.map(enrichOne);

    // Sort combined results and apply pagination
    enrichedProposals.sort((a, b) => {
      const aValue = a[sort] || a.createdAt || new Date(0);
      const bValue = b[sort] || b.createdAt || new Date(0);
      return sortOrder * (aValue > bValue ? 1 : -1);
    });

    const paginatedProposals = enrichedProposals.slice(skipCount, skipCount + limitNum);
    if (proposals.length > 0) {
      proposals.forEach((proposal, index) => {
        });
    }
    // Get total count from all models for pagination
    const [proposalCount, personnelCount, mooeCount, capitalCount, incomeCount] = await Promise.all([
      Proposal.countDocuments(query),
      PersonnelService.countDocuments(query),
      MooeProposal.countDocuments(query),
      CapitalOutlay.countDocuments(query),
      Income.countDocuments(query)
    ]);
    
    const totalRecords = proposalCount + personnelCount + mooeCount + capitalCount + incomeCount;
    // Include workflow information in response
    const workflowInfo = req.hierarchicalAccessInfo ? {
      userLevel: req.hierarchicalAccessInfo.scope,
      submissionWorkflowEnabled: req.hierarchicalAccessInfo.submissionWorkflowEnabled,
      canSeeSubmittedOnly: req.hierarchicalAccessInfo.scope !== 'DIVISION'
    } : null;
    // Return the response with the actual values from the database
    res.status(200).json({
      proposals: paginatedProposals,
      totalRecords,
      page: pageNum,
      limit: limitNum,
      workflowInfo,
      // Debug info to show model distribution
      modelCounts: {
        proposal: proposalCount,
        personnel: personnelCount,
        mooe: mooeCount,
        capital: capitalCount,
        income: incomeCount
      }
    });
  } catch (error) {
    console.error("Error in getProposals:", error);
    res.status(500).json({ 
      message: "Failed to fetch proposals",
      error: error.message 
    });
  }
};
exports.getMyProposals = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      orderBy,
      order = "asc",
      processBy,
      fiscalYear,
      budgetType,
      status,
      submittedDate,
    } = req.query;
    let query = {};
    if (search && search.split("-").length !== 3) {
      query.$or = [
        { processBy: { $regex: search, $options: "i" } },
        { fiscalYear: { $regex: search, $options: "i" } },
        { budgetType: { $regex: search, $options: "i" } },
        { region: { $regex: search, $options: "i" } },
        { cobExpenditures: { $regex: search, $options: "i" } },
        { status: { $regex: search, $options: "i" } },
      ];
    }
    if (processBy) query.processBy = processBy;
    if (fiscalYear) query.fiscalYear = fiscalYear;
    if (budgetType) query.budgetType = budgetType;
    if (status) query.status = status;
    if (submittedDate) query.submittedDate = new Date(submittedDate);
    const sortByField = orderBy || "submittedDate";
    const sortOrder = order.toLowerCase() === "desc" ? -1 : 1;
    const sortQuery = { [sortByField]: sortOrder };
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const skip = (pageNum - 1) * limitNum;
    const myproposals = await Proposal.find(query)
      .skip(skip)
      .limit(limitNum)
      .sort(sortQuery);
    const totalRecords = await Proposal.countDocuments(query);
    const groupedObj = {};
    for (const prop of myproposals) {
      const submittedDateStr = prop.submittedDate
        ? new Date(prop.submittedDate).toISOString().split("T")[0]
        : null;
      const rejectedDateStr = prop.rejectedDate
        ? new Date(prop.rejectedDate).toISOString().split("T")[0]
        : null;
      const key = [
        prop.processBy,
        prop.region,
        prop.fiscalYear,
        prop.budgetType,
        prop.status,
      ].join("|");
      if (!groupedObj[key]) {
        groupedObj[key] = {
          proposalIds: [],
          processBy: prop.processBy,
          region: prop.region,
          fiscalYear: prop.fiscalYear,
          budgetType: prop.budgetType,
          submittedDate: submittedDateStr,
          rejectedDate: rejectedDateStr,
          rejectionReason: prop.rejectionReason || "",
          status: prop.status,
          cost: 0,
        };
      }
      groupedObj[key].proposalIds.push(prop._id);
      groupedObj[key].cost += prop.cost || 0;
    }
    const groupedProposals = Object.values(groupedObj).map((grp) => {
      const isClearedStatus = ["Approved", "Submitted", "Draft"].includes(
        grp.status
      );
      return {
        proposalIds: grp.proposalIds,
        processBy: grp.processBy,
        region: grp.region,
        fiscalYear: grp.fiscalYear,
        budgetType: grp.budgetType,
        submittedDate: isClearedStatus ? null : grp.submittedDate,
        rejectedDate: isClearedStatus ? null : grp.rejectedDate,
        rejectionReason: isClearedStatus ? "" : grp.rejectionReason,
        status: grp.status,
        cost: grp.cost,
      };
    });
    return res.json({
      myproposals: groupedProposals,
      totalPages: Math.ceil(totalRecords / limitNum),
      currentPage: pageNum,
      totalRecords,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong." });
  }
};
exports.getProposalById = async (req, res) => {
  try {
    const proposal = await Proposal.findById(req.params.id);
    if (!proposal) {
      return res.status(404).json({ message: "Proposal not found" });
    }
    return res.json(proposal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
exports.updateProposal = async (req, res) => {
  try {
    // Guard: Prevent elevating status to Approved without proper permission
    if (req.body && typeof req.body.status === 'string') {
      const desiredStatus = req.body.status.trim();
      const approvingStatuses = ['Approved', 'Region Approved', 'Finalized'];
      if (approvingStatuses.includes(desiredStatus)) {
        try {
          const assignment = await HierarchicalUserAssignment.getUserPermissions(req.user?.id);
          const canApprove = assignment?.rolePermissions?.canApproveProposals === true;
          if (!canApprove) {
            return res.status(403).json({
              success: false,
              message: 'Permission denied: Can Approve Proposals is required to set status to an approved state',
              code: 'INSUFFICIENT_PERMISSIONS'
            });
          }
        } catch (e) {
          return res.status(500).json({ success: false, message: 'Error validating approval permission', error: e.message });
        }
      }
    }
    const updatedProposal = await Proposal.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(updatedProposal);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
exports.deleteProposal = async (req, res) => {
  try {
    await Proposal.findByIdAndDelete(req.params.id);
    res.json({ message: "Proposal deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
exports.deleteAllProposals = async (req, res) => {
  try {
    await Proposal.deleteMany({});
    res.json({ message: "All proposals deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
exports.getAllProposals = async (req, res) => {
  try {
    const proposals = await Proposal.find()
      .sort({ createdAt: -1 });
    res.status(200).json(proposals);
  } catch (error) {
    console.error("Error fetching proposals:", error);
    res.status(500).json({ error: "Failed to fetch proposals" });
  }
};
exports.approveProposal = async (req, res) => {
  try {
    const { fiscalYear, budgetType, processBy, region, approvedDate } =
      req.body;
    if (!fiscalYear || !budgetType || !processBy || !region) {
      return res.status(400).json({
        message:
          "Missing required fields: fiscalYear, budgetType, processBy, or region.",
      });
    }
    const update = {
      $set: {
        status: "Approved",
        approvedDate: approvedDate ? new Date(approvedDate) : new Date(),
      },
    };
    const [personnelResult, mooeResult, capitalResult, proposalResult] =
      await Promise.all([
        PersonnelService.updateMany(
          { status: "Submitted", fiscalYear, budgetType, processBy, region },
          update
        ),
        MooeProposal.updateMany(
          { status: "Submitted", fiscalYear, budgetType, processBy, region },
          update
        ),
        CapitalOutlay.updateMany(
          { status: "Submitted", fiscalYear, budgetType, processBy, region },
          update
        ),
        Proposal.updateMany(
          { status: "Submitted", fiscalYear, budgetType, processBy, region },
          update
        ),
      ]);
    return res.status(200).json({
      message: "All proposals approved successfully.",
      personnelModified: personnelResult.modifiedCount,
      mooeModified: mooeResult.modifiedCount,
      capitalModified: capitalResult.modifiedCount,
      proposalModified: proposalResult.modifiedCount,
    });
  } catch (error) {
    console.error("Error approving proposals:", error);
    return res.status(500).json({
      message: "Error approving proposals",
      error: error.message,
    });
  }
};
exports.rejectAllProposals = async (req, res) => {
  try {
    const { fiscalYear, budgetType, processBy, region, reason, reasonDate } =
      req.body;
    if (!fiscalYear || !budgetType || !processBy || !region) {
      return res.status(400).json({
        message:
          "Missing required fields: fiscalYear, budgetType, processBy, or region.",
      });
    }
    const update = {
      $set: {
        status: "Returned",
        rejectedDate: reasonDate ? new Date(reasonDate) : new Date(),
        rejectionReason: reason || "",
      },
    };
    const [personnelResult, mooeResult, capitalResult, proposalResult] =
      await Promise.all([
        PersonnelService.updateMany(
          { status: "Submitted", fiscalYear, budgetType, processBy, region },
          update
        ),
        MooeProposal.updateMany(
          { status: "Submitted", fiscalYear, budgetType, processBy, region },
          update
        ),
        CapitalOutlay.updateMany(
          { status: "Submitted", fiscalYear, budgetType, processBy, region },
          update
        ),
        Proposal.updateMany(
          { status: "Submitted", fiscalYear, budgetType, processBy, region },
          update
        ),
      ]);
    return res.status(200).json({
      message: "All proposals rejected successfully.",
      personnelModified: personnelResult.modifiedCount,
      mooeModified: mooeResult.modifiedCount,
      capitalModified: capitalResult.modifiedCount,
      proposalModified: proposalResult.modifiedCount,
    });
  } catch (error) {
    console.error("Error rejecting proposals:", error);
    return res.status(500).json({
      message: "Error rejecting proposals",
      error: error.message,
    });
  }
};
exports.getAllUserProposals = async (req, res) => {
  try {
    const { processBy } = req.query;
    if (!processBy) {
      return res.status(400).json({ message: 'processBy parameter is required' });
    }
    // Get all proposals for this user
    const [personnel, mooe, capitalOutlay, income, drafts] = await Promise.all([
      // Regular proposals
      Proposal.find({ 
        processBy, 
        category: 'personnel' 
      }).lean(),
      Proposal.find({ 
        processBy, 
        category: 'mooe' 
      }).lean(),
      Proposal.find({ 
        processBy, 
        category: 'capitalOutlay' 
      }).lean(),
      Proposal.find({ 
        processBy, 
        category: 'income' 
      }).lean(),
      // Draft proposals
      DraftProposal.find({ 
        processBy 
      }).lean()
    ]);
    // Process draft proposals to add them to the correct category
    const categorizedDrafts = {
      personnel: [],
      mooe: [],
      capitalOutlay: [],
      income: []
    };
    drafts.forEach(draft => {
      const category = draft.category || 'uncategorized';
      if (categorizedDrafts[category]) {
        categorizedDrafts[category].push(draft);
      }
    });
    // Combine regular and draft proposals
    const result = {
      personnel: [...personnel, ...categorizedDrafts.personnel],
      mooe: [...mooe, ...categorizedDrafts.mooe],
      capitalOutlay: [...capitalOutlay, ...categorizedDrafts.capitalOutlay],
      income: [...income, ...categorizedDrafts.income],
      // Include uncategorized drafts if any
      uncategorized: categorizedDrafts.uncategorized || []
    };
    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching user proposals:', error);
    res.status(500).json({ 
      message: 'Server error while fetching user proposals',
      error: error.message
    });
  }
};
exports.updateMissingRegions = async (req, res) => {
  try {
    const { type, ids, region, processBy } = req.body;
    if (!type || !Array.isArray(ids) || ids.length === 0 || !region) {
      return res.status(400).json({ message: "Missing required parameters" });
    }
    const validIds = ids
      .filter(id => mongoose.Types.ObjectId.isValid(id))
      .map(id => new mongoose.Types.ObjectId(id));
    if (validIds.length === 0) {
      return res.status(400).json({ message: "No valid IDs provided" });
    }
    let result;
    switch (type) {
      case "personnel":
        result = await PersonnelService.updateMany(
          { _id: { $in: validIds } },
          { $set: { region, processBy } }
        );
        break;
      case "mooe":
        result = await MooeProposal.updateMany(
          { _id: { $in: validIds } },
          { $set: { region, processBy } }
        );
        break;
      case "capitalOutlay":
        result = await CapitalOutlay.updateMany(
          { _id: { $in: validIds } },
          { $set: { region, processBy } }
        );
        break;
      case "income":
        result = await Income.updateMany(
          { _id: { $in: validIds } },
          { $set: { region, processBy } }
        );
        break;
      default:
        return res.status(400).json({ message: "Invalid proposal type" });
    }
    return res.status(200).json({
      message: `Updated ${result.modifiedCount} ${type} proposals with missing regions`,
      result
    });
  } catch (error) {
    console.error("Error updating missing regions:", error);
    return res.status(500).json({ message: "Server error updating missing regions" });
  }
};
// Helper function to calculate personnel total
function calculatePersonnelTotal(personnel) {
  if (!personnel) return 0;
  return (
    (Number(personnel.annualSalary) || 0) +
    (Number(personnel.RATA) || 0) +
    (Number(personnel.PERA) || 0) +
    (Number(personnel.uniformALLOWANCE) || 0) +
    (Number(personnel.productivityIncentive) || 0) +
    (Number(personnel.medical) || 0) +
    (Number(personnel.childrenAllowance) || 0) +
    (Number(personnel.meal) || 0) +
    (Number(personnel.cashGift) || 0) +
    (Number(personnel.subsistenceAllowanceMDS) || 0) +
    (Number(personnel.subsistenceAllowanceST) || 0) +
    (Number(personnel.midyearBonus) || 0) +
    (Number(personnel.yearEndBonus) || 0) +
    (Number(personnel.gsisPremium) || 0) +
    (Number(personnel.philhealthPremium) || 0) +
    (Number(personnel.pagibigPremium) || 0) +
    (Number(personnel.employeeCompensation) || 0) +
    (Number(personnel.loyaltyAward) || 0) +
    (Number(personnel.overtimePay) || 0) +
    (Number(personnel.earnedLeaves) || 0) +
    (Number(personnel.retirementBenefits) || 0) +
    (Number(personnel.terminalLeave) || 0) +
    (Number(personnel.courtAppearance) || 0)
  );
}
exports.returnProposal = async (req, res) => {
  try {
    const { fiscalYear, budgetType, processBy, region, reason, cobExpenditures } = req.body;
    if (!fiscalYear || !budgetType || !processBy || !region || !cobExpenditures) {
      return res.status(400).json({
        message: "Missing required fields: fiscalYear, budgetType, processBy, region, or cobExpenditures.",
      });
    }
    const update = {
      $set: {
        status: "Returned",
        rejectedDate: new Date(),
        rejectionReason: reason || "",
        returnedExpenditureType: cobExpenditures // Add this field to track which type was returned
      },
    };
    // Only update the specific proposal type based on cobExpenditures
    let personnelResult = { modifiedCount: 0 };
    let mooeResult = { modifiedCount: 0 };
    let capitalResult = { modifiedCount: 0 };
    let incomeResult = { modifiedCount: 0 };
    let proposalResult = { modifiedCount: 0 };
    // Update only the specific type of proposal
    if (cobExpenditures === "Personnel" || cobExpenditures === "PS" || cobExpenditures === "Personnel Services") {
      personnelResult = await PersonnelService.updateMany(
        { status: "Submitted", fiscalYear, budgetType, processBy, region },
        update
      );
    } else if (cobExpenditures === "MOOE") {
      mooeResult = await MooeProposal.updateMany(
        { status: "Submitted", fiscalYear, budgetType, processBy, region },
        update
      );
    } else if (cobExpenditures === "Capital Outlay") {
      capitalResult = await CapitalOutlay.updateMany(
        { status: "Submitted", fiscalYear, budgetType, processBy, region },
        update
      );
    } else if (cobExpenditures === "Income") {
      incomeResult = await Income.updateMany(
        { status: "Submitted", fiscalYear, budgetType, processBy, region },
        update
      );
    }
    // Update the proposal summary record
    proposalResult = await Proposal.updateMany(
      { 
        status: "Submitted", 
        fiscalYear, 
        budgetType, 
        processBy, 
        region,
        cobExpenditures // Only update the matching expenditure type
      },
      update
    );
    return res.status(200).json({
      message: `${cobExpenditures} proposal returned successfully.`,
      personnelModified: personnelResult.modifiedCount,
      mooeModified: mooeResult.modifiedCount,
      capitalModified: capitalResult.modifiedCount,
      incomeModified: incomeResult.modifiedCount,
      proposalModified: proposalResult.modifiedCount,
    });
  } catch (error) {
    console.error("Error returning proposal:", error);
    return res.status(500).json({
      message: "Error returning proposal",
      error: error.message,
    });
  }
};
// Add this function to get proposal details with detailed data
exports.getProposalDetails = async (req, res) => {
  try {
    const { fiscalYear, budgetType, processBy, region } = req.query;
    // Validate required parameters
    if (!fiscalYear || !budgetType || !processBy || !region) {
      return res.status(400).json({ 
        message: 'Missing required parameters',
        parameters: { fiscalYear, budgetType, processBy, region }
      });
    }
    // First try to find in regular proposals
    let proposal = await Proposal.findOne({
      fiscalYear,
      budgetType,
      processBy,
      region,
    }).lean();
    // If not found in regular proposals, check draft proposals
    if (!proposal) {
      proposal = await DraftProposal.findOne({
        fiscalYear,
        budgetType,
        processBy,
        region,
      }).lean();
      if (!proposal) {
        // Create a basic proposal object with the provided parameters
        proposal = {
          fiscalYear,
          budgetType,
          processBy,
          region,
          status: "Unknown",
          createdAt: new Date(),
          updatedAt: new Date()
        };
      }
    }
    // Determine the expenditure type if not already set
    if (!proposal.cobExpenditures) {
      // Check if there are any personnel services for this proposal
      const personnelCount = await PersonnelService.countDocuments({
        fiscalYear,
        budgetType,
        processBy,
        region
      });
      if (personnelCount > 0) {
        proposal.cobExpenditures = "Personnel Services";
      } else {
        // Check if there are any MOOE items
        const mooeCount = await MooeProposal.countDocuments({
          fiscalYear,
          budgetType,
          processBy,
          region
        });
        if (mooeCount > 0) {
          proposal.cobExpenditures = "MOOE";
        } else {
          // Check if there are any capital outlay items
          const capitalOutlayCount = await CapitalOutlay.countDocuments({
            fiscalYear,
            budgetType,
            processBy,
            region
          });
          if (capitalOutlayCount > 0) {
            proposal.cobExpenditures = "Capital Outlay";
          } else {
            // Check if there are any income items
            const incomeCount = await Income.countDocuments({
              fiscalYear,
              budgetType,
              processBy,
              region
            });
            if (incomeCount > 0) {
              proposal.cobExpenditures = "Income";
            } else {
              proposal.cobExpenditures = null;
            }
          }
        }
      }
      }
    // Return the proposal with all details
    res.status(200).json(proposal);
  } catch (error) {
    console.error('Error fetching proposal details:', error);
    res.status(500).json({ 
      message: 'Server error while fetching proposal details',
      error: error.message
    });
  }
};
// Add this function to handle draft proposals
exports.saveDraftProposal = async (req, res) => {
  try {
    const proposalData = req.body;
    // Ensure status is set to Draft
    proposalData.status = "Draft";
    proposalData.lastEditedAt = new Date();
    // If there's an existing draft with the same key info, update it
    const query = {
      fiscalYear: proposalData.fiscalYear,
      budgetType: proposalData.budgetType,
      processBy: proposalData.processBy,
      region: proposalData.region
    };
    // Use findOneAndUpdate with upsert option to create if not exists
    const savedDraft = await DraftProposal.findOneAndUpdate(
      query,
      proposalData,
      { 
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    );
    res.status(200).json({
      message: 'Draft saved successfully',
      draft: savedDraft
    });
  } catch (error) {
    console.error('Error saving draft proposal:', error.stack);
    // Handle duplicate key error specifically
    if (error.code === 11000) {
      return res.status(400).json({
        message: 'A draft with these details already exists',
        error: 'Duplicate draft'
      });
    }
    res.status(500).json({ 
      message: 'Server error while saving draft',
      error: error.message
    });
  }
};
// Add this function to get a specific draft proposal
exports.getDraftProposal = async (req, res) => {
  try {
    const { id } = req.params;
    // Find the draft proposal
    const draftProposal = await DraftProposal.findById(id).lean();
    if (!draftProposal) {
      return res.status(404).json({ 
        message: 'Draft proposal not found',
        id
      });
    }
    res.status(200).json(draftProposal);
  } catch (error) {
    console.error('Error fetching draft proposal:', error);
    res.status(500).json({ 
      message: 'Server error while fetching draft proposal',
      error: error.message
    });
  }
};
// Add this function to get all user proposals including drafts
exports.getAllUserProposals = async (req, res) => {
  try {
    const { processBy, region } = req.query;
    if (!processBy) {
      return res.status(400).json({ message: "processBy parameter is required" });
    }
    if (!region) {
      return res.status(400).json({ message: "Region parameter is required" });
    }

    // Base query
    const baseQuery = { processBy, region };

    // Determine user scope from middleware/assignment
    const assignment = req.userHierarchicalAssignment || {};
    const scope = (req.hierarchicalAccessInfo?.scope || assignment.assignmentLevel || 'NONE').toUpperCase();
    const departmentName = assignment?.departmentId?.Department || assignment?.departments?.[0]?.departmentName || null;
    const divisionName = assignment?.divisionName || assignment?.divisions?.[0] || null;

    // Visibility gates to prevent lower-level draft leakage
    const submittedStatuses = [
      'Division Submitted','DIVISION SUBMITTED',
      'Department Verified','DEPARTMENT VERIFIED',
      'Department Submitted','DEPARTMENT SUBMITTED',
      'Region Approved','REGION APPROVED','Finalized'
    ];

    let visibilityGate = {};
    if (scope === 'DIVISION') {
      // Division: only own division items (any status)
      visibilityGate = {
        $and: [
          baseQuery,
          { department: departmentName },
          { division: divisionName }
        ]
      };
    } else if (scope === 'DEPARTMENT') {
      // Department: own department-level drafts + submitted division items only
      visibilityGate = {
        $and: [
          baseQuery,
          { department: departmentName },
          {
            $or: [
              // Own department-level items (no division or explicit DEPARTMENT level)
              {
                $and: [
                  { $or: [
                    { workflowLevel: 'DEPARTMENT' },
                    { $or: [ { division: { $exists: false } }, { division: null }, { division: '' } ] }
                  ] }
                ]
              },
              // Division items visible only when submitted upward
              {
                $and: [
                  { division: { $exists: true, $ne: null, $ne: '' } },
                  { $or: [ { originalLevel: 'DIVISION' }, { workflowLevel: 'DIVISION' } ] },
                  { status: { $in: submittedStatuses } }
                ]
              }
            ]
          }
        ]
      };
    } else if (scope === 'REGION' || scope === 'FULL') {
      // Region: own region-level drafts + submitted department/division items only
      const depDivSubmitted = ['Department Submitted','DEPARTMENT SUBMITTED','Region Approved','REGION APPROVED','Finalized'];
      visibilityGate = {
        $and: [
          baseQuery,
          {
            $or: [
              // Own region-level items (no department/division, explicit REGION level)
              {
                $and: [
                  { $or: [ { department: { $exists: false } }, { department: null }, { department: '' } ] },
                  { $or: [ { division: { $exists: false } }, { division: null }, { division: '' } ] },
                  { workflowLevel: 'REGION' }
                ]
              },
              // Department/Division items only when submitted upward
              {
                $and: [
                  { $or: [ { department: { $exists: true, $ne: null, $ne: '' } }, { division: { $exists: true, $ne: null, $ne: '' } } ] },
                  { status: { $in: depDivSubmitted } }
                ]
              }
            ]
          }
        ]
      };
    } else {
      // Fallback: just base query
      visibilityGate = baseQuery;
    }

    // Query all collections with the same visibility gate
    const [personnel, mooe, capitalOutlay, income, budgetarySupport, drafts] = await Promise.all([
      PersonnelService.find(visibilityGate).sort({ updatedAt: -1 }),
      MooeProposal.find(visibilityGate).sort({ updatedAt: -1 }),
      CapitalOutlay.find(visibilityGate).sort({ updatedAt: -1 }),
      Income.find(visibilityGate).sort({ updatedAt: -1 }),
      BudgetarySupport.find(visibilityGate).sort({ updatedAt: -1 }),
      DraftProposal.find(visibilityGate).sort({ updatedAt: -1 })
    ]);

    return res.status(200).json({
      personnel,
      mooe,
      capitalOutlay,
      income,
      budgetarySupport,
      drafts,
      filters: { region, processBy },
      scope
    });
  } catch (error) {
    console.error("Error getting all user proposals:", error);
    return res.status(500).json({ 
      message: "Error getting all user proposals", 
      error: error.message 
    });
  }
};
// Manual consolidation of existing submitted proposals
exports.consolidateProposals = async (req, res) => {
  try {
    // Build query with hierarchical filters
    const query = { status: "Submitted" };
    if (req.hierarchicalFilters) {
      Object.assign(query, req.hierarchicalFilters);
    }
    // Find all submitted items from individual collections with hierarchical filtering
    const [submittedPersonnel, submittedMooe, submittedCapital, submittedIncome] = await Promise.all([
      PersonnelService.find(query),
      MooeProposal.find(query),
      CapitalOutlay.find(query),
      Income.find(query)
    ]);
    if (submittedPersonnel.length === 0 && submittedMooe.length === 0 && 
        submittedCapital.length === 0 && submittedIncome.length === 0) {
      return res.status(200).json({
        message: "No submitted proposals found to consolidate"
      });
    }
    // Group by processBy, region, department, division, fiscalYear, budgetType to preserve hierarchy
    const grouped = {};
    const processItems = (items, category) => {
      items.forEach(item => {
        // Create hierarchical key that includes department and division
        const department = item.department || '';
        const division = item.division || '';
        const key = `${item.processBy}_${item.region}_${department}_${division}_${item.fiscalYear}_${item.budgetType}`;
        
        if (!grouped[key]) {
          grouped[key] = {
            processBy: item.processBy,
            region: item.region,
            department: item.department || null,
            division: item.division || null,
            fiscalYear: item.fiscalYear,
            budgetType: item.budgetType,
            categories: {}
          };
        }
        if (!grouped[key].categories[category]) {
          grouped[key].categories[category] = [];
        }
        grouped[key].categories[category].push(item);
      });
    };
    processItems(submittedPersonnel, 'personnel');
    processItems(submittedMooe, 'mooe');
    processItems(submittedCapital, 'capitalOutlay');
    processItems(submittedIncome, 'income');
    // Create consolidated proposals for each group
    const bulkOps = [];
    let consolidatedCount = 0;
    for (const [key, group] of Object.entries(grouped)) {
      for (const [category, items] of Object.entries(group.categories)) {
        let totalExpenses = 0;
        let totalIncome = 0;
        // Calculate totals based on category
        if (category === 'personnel') {
          totalExpenses = items.reduce((sum, item) => {
            const itemTotal = [
              'annualSalary', 'RATA', 'PERA', 'uniformALLOWANCE', 'productivityIncentive',
              'medical', 'childrenAllowance', 'meal', 'cashGift', 'subsistenceAllowanceMDS',
              'subsistenceAllowanceST', 'midyearBonus', 'yearEndBonus', 'gsisPremium',
              'philhealthPremium', 'pagibigPremium', 'employeeCompensation', 'loyaltyAward',
              'overtimePay', 'earnedLeaves', 'retirementBenefits', 'terminalLeave', 'courtAppearance'
            ].reduce((itemSum, field) => itemSum + (Number(item[field]) || 0), 0);
            return sum + itemTotal;
          }, 0);
        } else if (category === 'mooe' || category === 'capitalOutlay') {
          totalExpenses = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
        } else if (category === 'income') {
          totalIncome = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
        }
        // Determine cobExpenditures based on category
        let cobExpenditures;
        if (category === 'personnel') {
          const statusTypes = [...new Set(items.map(item => item.statusOfAppointment))];
          cobExpenditures = statusTypes.length === 1 ? statusTypes[0] : 'Personnel Services';
        } else if (category === 'mooe') {
          cobExpenditures = 'MOOE';
        } else if (category === 'capitalOutlay') {
          cobExpenditures = 'Capital Outlay';
        } else if (category === 'income') {
          cobExpenditures = 'Income';
        }
        // Build filter that includes hierarchical fields
        const filter = {
          processBy: group.processBy,
          region: group.region,
          fiscalYear: group.fiscalYear,
          budgetType: group.budgetType,
          cobExpenditures: cobExpenditures,
        };

        // Add department and division to filter if they exist
        if (group.department) {
          filter.department = group.department;
        }
        if (group.division) {
          filter.division = group.division;
        }

        // Build update object that preserves hierarchy
        const updateSet = {
          submittedDate: new Date(),
          status: 'Submitted',
          totalExpenses: totalExpenses,
          totalIncome: totalIncome,
        };

        // Add hierarchical fields to update
        if (group.department) {
          updateSet.department = group.department;
        }
        if (group.division) {
          updateSet.division = group.division;
        }

        bulkOps.push({
          updateOne: {
            filter: filter,
            update: {
              $set: updateSet,
            },
            upsert: true
          }
        });
        consolidatedCount++;
      }
    }
    // Execute bulk operations
    if (bulkOps.length > 0) {
      const bulkResult = await Proposal.bulkWrite(bulkOps);
      res.status(200).json({
        message: `Successfully consolidated ${consolidatedCount} proposal categories`,
        details: {
          modified: bulkResult.modifiedCount,
          created: bulkResult.upsertedCount,
          totalOperations: bulkOps.length
        }
      });
    } else {
      res.status(200).json({
        message: "No proposals to consolidate"
      });
    }
  } catch (error) {
    console.error("❌ Error in consolidateProposals:", error);
    res.status(500).json({
      message: "Failed to consolidate proposals",
      error: error.message
    });
  }
};
// Debug endpoint to check database content
exports.debugProposals = async (req, res) => {
  try {
    // Get total count
    const totalProposals = await Proposal.countDocuments();
    // Get all proposals
    const allProposals = await Proposal.find().sort({ createdAt: -1 }).limit(10);
    // Get status distribution
    const statusStats = await Proposal.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    // Get region distribution
    const regionStats = await Proposal.aggregate([
      { $group: { _id: '$region', count: { $sum: 1 } } }
    ]);
    // Get processBy distribution
    const processStats = await Proposal.aggregate([
      { $group: { _id: '$processBy', count: { $sum: 1 } } }
    ]);
    const response = {
      totalProposals,
      statusDistribution: statusStats,
      regionDistribution: regionStats,
      processDistribution: processStats,
      sampleProposals: allProposals.map(p => ({
        id: p._id,
        processBy: p.processBy,
        region: p.region,
        status: p.status,
        cobExpenditures: p.cobExpenditures,
        fiscalYear: p.fiscalYear,
        budgetType: p.budgetType,
        submittedDate: p.submittedDate,
        totalExpenses: p.totalExpenses,
        totalIncome: p.totalIncome
      }))
    };
    res.status(200).json(response);
  } catch (error) {
    console.error("❌ Error in debugProposals:", error);
    res.status(500).json({
      message: "Failed to debug proposals",
      error: error.message
    });
  }
};
