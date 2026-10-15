const fs = require('fs');
const os = require('os');
const path = require('path');
const PersonnelServices = require('../models/PersonnelServices');
const { summarizePersonnelFunding, personnelItemFunding } = require('../utils/personnelReportFunding');
const NewProposalWorkflow = require('../models/NewProposalWorkflow');
const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
const Region = require('../models/Region');
const { extractSignatoriesFromWorkflow, drawWorkflowSignatureBlock, cleanupTempImages, enrichSignatoriesWithPositionTitle } = require('../utils/pdfSignatureHelper');
const { getFolioPageSize, isAllRegionsSelection } = require('../utils/reportPageLayout');
const {
  resolveDraftWatermarkForRecords,
  drawMuhammaraDraftWatermark,
} = require('../utils/proposalPdfWatermark');
const {
  buildRegionalReportMatrix,
  chunkRegionalMatrixRegions,
  needsCleanMatrixSignaturePage,
} = require('../utils/regionalReportMatrix');

let MuhammaraRecipe;
try {
  MuhammaraRecipe = require('muhammara').Recipe;
} catch (e) {
  MuhammaraRecipe = null;
}

// ─── Workflow-status-based scoping ───────────────────────────────────────────
const VISIBLE_STATUSES_BY_ROLE_PS = {
  BUDGET_PREPARER:         ['DRAFT', 'FORWARDED_TO_REVIEWER','FORWARDED_TO_APPROVER','FORWARDED_TO_BRD_ANALYST','FORWARDED_TO_BRD_OFFICER','FORWARDED_TO_BRD_MANAGER','FINALIZED','RETURNED_TO_PREPARER','RETURNED_TO_REVIEWER','RETURNED_TO_APPROVER','RETURNED_TO_PLANNING_ANALYST','RETURNED_TO_OFFICER'],
  BUDGET_REVIEWER:         ['FORWARDED_TO_REVIEWER','RETURNED_TO_REVIEWER','FORWARDED_TO_APPROVER','RETURNED_TO_APPROVER','FORWARDED_TO_BRD_ANALYST','FORWARDED_TO_BRD_OFFICER','FORWARDED_TO_BRD_MANAGER','FINALIZED','RETURNED_TO_PLANNING_ANALYST','RETURNED_TO_OFFICER'],
  BUDGET_APPROVER:         ['FORWARDED_TO_APPROVER','RETURNED_TO_APPROVER','FORWARDED_TO_BRD_ANALYST','FORWARDED_TO_BRD_OFFICER','FORWARDED_TO_BRD_MANAGER','FINALIZED','RETURNED_TO_PLANNING_ANALYST','RETURNED_TO_OFFICER'],
  BUDGET_PLANNING_ANALYST: ['FORWARDED_TO_BRD_ANALYST','FORWARDED_TO_BRD_OFFICER','FORWARDED_TO_BRD_MANAGER','FINALIZED','RETURNED_TO_PLANNING_ANALYST','RETURNED_TO_OFFICER'],
  BUDGET_OFFICER:          null,
  BUDGET_MANAGER:          null,
  SUPER_ADMIN:             null,
  OVERALL_BUDGET_APPROVER: null,
};
const FULL_ACCESS_ROLES_PS = new Set([
  'SUPER_ADMIN','SUPER ADMIN','BUDGET_MANAGER','BUDGET MANAGER',
  'OVERALL_BUDGET_APPROVER','OVERALL BUDGET APPROVER',
  'BUDGET_ADMIN','BUDGET ADMIN','BUDGET_OFFICER','BUDGET OFFICER'
]);
const normalizeRolePS = (r) => String(r || '').trim().replace(/\s+/g, '_').toUpperCase();

const buildPersonnelServicesRegionMatrix = (grouped = {}) => buildRegionalReportMatrix(
  Object.values(grouped).flatMap((regionData) => (
    Object.values(regionData.categories || {}).flatMap((category) => (
      Object.values(category.items || {}).map((item) => ({
        region: regionData.region,
        section: category.name,
        particulars: item.name,
        values: { income: item.income || 0, subsidy: item.subsidy ?? item.amount, amount: item.amount },
      }))
    ))
  )),
  ['income', 'subsidy', 'amount']
);

const buildPersonnelServicesPdfMatrix = (grouped = {}) => buildRegionalReportMatrix(
  Object.entries(grouped).flatMap(([region, categories]) => (
    Object.entries(categories || {}).flatMap(([section, items]) => (
      Object.values(items || {}).map((item) => ({
        region,
        section,
        particulars: item.name,
        values: { income: item.income || 0, subsidy: item.subsidy ?? item.amount, amount: item.amount },
      }))
    ))
  )),
  ['income', 'subsidy', 'amount']
);

const getVisibleWorkflowIdsPS = async (req, { fiscalYear, budgetType, regions } = {}) => {
  const userRoles = (req.user?.Roles || req.user?.roles || []).map(normalizeRolePS);
  if (userRoles.some(r => FULL_ACCESS_ROLES_PS.has(r))) return null;

  let visibleStatuses = null;
  for (const [roleKey, statuses] of Object.entries(VISIBLE_STATUSES_BY_ROLE_PS)) {
    if (userRoles.includes(roleKey)) {
      if (statuses === null) return null;
      if (!visibleStatuses) {
        visibleStatuses = new Set(statuses);
      } else {
        statuses.forEach(s => visibleStatuses.add(s));
      }
    }
  }
  if (!visibleStatuses) visibleStatuses = new Set(VISIBLE_STATUSES_BY_ROLE_PS.BUDGET_PREPARER);

  // --- OPSYON A FIX: Get all active/released consolidated proposals to find their merged source IDs ---
  const activeConsolidatedQuery = {
    isConsolidated: true,
    status: { $in: [...visibleStatuses] }
  };
  if (fiscalYear) activeConsolidatedQuery.fiscalYear = Number(fiscalYear) || parseInt(fiscalYear, 10);
  if (budgetType) {
    const typeMap = { NEP: 'NEP', GAA: 'GAA' };
    activeConsolidatedQuery.modelType = typeMap[String(budgetType).toUpperCase()] || 'Initial';
  }
  if (regions && regions !== 'all') {
    const regionList = Array.isArray(regions) ? regions : [regions];
    const regionDocs = await Region.find({ Region: { $in: regionList } }).select('_id').lean();
    if (regionDocs.length) activeConsolidatedQuery.region = { $in: regionDocs.map(r => r._id) };
  }

  const activeConsolidatedDocs = await NewProposalWorkflow.find(activeConsolidatedQuery).select('mergedFrom').lean();
  const allowedMergedIds = [];
  activeConsolidatedDocs.forEach(doc => {
    if (Array.isArray(doc.mergedFrom)) {
      allowedMergedIds.push(...doc.mergedFrom);
    }
  });

  // Build the main query using an $and array to safely mix $or conditions without key collision
  const npwQuery = {
    $and: [
      {
        $or: [
          { status: { $in: [...visibleStatuses] } },
          { _id: { $in: allowedMergedIds } }
        ]
      }
    ]
  };

  if (fiscalYear) npwQuery.$and.push({ fiscalYear: Number(fiscalYear) || parseInt(fiscalYear, 10) });
  if (budgetType) {
    const typeMap = { NEP: 'NEP', GAA: 'GAA' };
    npwQuery.$and.push({ modelType: typeMap[String(budgetType).toUpperCase()] || 'Initial' });
  }
  if (regions && regions !== 'all') {
    const regionList = Array.isArray(regions) ? regions : [regions];
    const regionDocs = await Region.find({ Region: { $in: regionList } }).select('_id').lean();
    if (regionDocs.length) npwQuery.$and.push({ region: { $in: regionDocs.map(r => r._id) } });
  }

  // For PREPARER / REVIEWER / APPROVER, also restrict to their own department/division
  const isPreparerReviewer = userRoles.some(r => ['BUDGET_PREPARER','BUDGET_REVIEWER','BUDGET_APPROVER'].includes(r));
  if (isPreparerReviewer) {
    const userId = String(req.user?.id || req.user?.userId || '');
    if (userId) {
      try {
        const hua = await HierarchicalUserAssignment.findOne({ userId, isActive: true })
          .populate('departmentId', 'Department departmentName DepartmentName').lean();
        if (hua) {
          const dept = hua.departmentId?.Department || hua.departmentId?.departmentName || hua.departmentId?.DepartmentName;
          const div  = hua.divisionName || '';
          const level = String(hua.assignmentLevel || '').toUpperCase();
          if (dept && !['BUDGET_AND_REVENUE_DIVISION','REGION','FULL'].includes(level)) {
            npwQuery.$and.push({ department: dept });
            if (div && level === 'DIVISION') npwQuery.$and.push({ division: div });
          }
        }
      } catch (_) {}
    }
  }

  const docs = await NewProposalWorkflow.find(npwQuery).select('_id').lean();
  return docs.map(d => d._id);
};

// ─────────────────────────────────────────────────────────────────────────────
// Define the hierarchical structure mapping
const PERSONNEL_SERVICES_STRUCTURE = {
  "B.1.1": {
    name: "Personnel Services",
    categories: {
      "1": {
        name: "Salaries and Wages",
        items: {
          "a": { name: "Salaries - Regular (Authorized Positions)", field: "annualSalary" },
          "b": { name: "Casual Personnel", field: "casualPersonnel" } // Will be calculated
        }
      },
      "2": {
        name: "Other Compensation",
        items: {
          "a": { name: "PERA", field: "PERA" },
          "b": { name: "Representation Allowance", field: "RATA" },
          "c": { name: "Transportation Allowance", field: "transportationAllowance" }, // Not in model
          "d": { name: "Honoraria", field: "honoraria" },
          "e": { name: "Uniform/Clothing Allowance", field: "uniformALLOWANCE" },
          "f": { name: "Children Allowances", field: "childrenAllowance" },
          "g": { name: "Medical Allowances", field: "medical" },
          "h": { name: "Additional Medical Allowance", field: "additionalMedical" },
          "i": { name: "Meal Allowances", field: "meal" },
          "j": { name: "Per Diem & Allowance of Board of Directors", field: "perDiem" }, // Not in model
          "k": { name: "Subsistence Allowance", field: "subsistenceAllowance,subsistenceAllowanceMDS,subsistenceAllowanceST" },
          "l": { name: "Longevity Pay (Loyalty Award)", field: "loyaltyAward" },
          "m": { name: "Overtime Services", field: "overtimePay" },
          "n": { name: "Special Counsel Allowance", field: "specialCounsel" }, // Not in model
          "o": { name: "Productivity Enhancement Incentive", field: "productivityIncentive" },
          "p": { name: "Cash Gift", field: "cashGift" },
          "q": { name: "Mid-Year and Year-End Bonus", field: "midyearBonus,yearEndBonus" }, // Combined
          "r": { name: "Performance Based Bonus", field: "performanceBonus" }, // Not in model
          "s": { name: "Hazard Pay", field: "hazardPay" },
          "t": { name: "Other Bonuses and Allowances", field: "otherBonuses" }, // Not in model
          "u": { name: "Anniversary Bonus", field: "anniversaryBonus" }, // Not in model
          "v": { name: "Court Appearance", field: "courtAppearance" }
        }
      },
      "3": {
        name: "Other Benefits",
        items: {
          "a": { name: "Retirement Benefits", field: "retirementBenefits" },
          "b": { name: "Terminal Leave Benefits", field: "terminalLeave" }
        }
      },
      "4": {
        name: "Fixed Personnel Expenditures",
        items: {
          "a": { name: "GSIS Ret. & Life Insurance Premium", field: "gsisPremium" },
          "b": { name: "PAG-IBIG Contributions", field: "pagibigPremium" },
          "c": { name: "PHILHEALTH Contributions", field: "philhealthPremium" },
          "d": { name: "Employees Compensation Insurance Premium", field: "employeeCompensation" },
          "e": { name: "Provident Fund", field: "providentFund" } // Not in model
        }
      },
      "5": {
        name: "REORG",
        items: {
          "a": { name: "Reorganization Costs", field: "reorgCosts" } // Not in model
        }
      },
      "6": {
        name: "Leave Monetization/Earned Leaves",
        items: {
          "a": { name: "Earned Leaves", field: "earnedLeaves" }
        }
      }
    }
  }
};
const getConsolidatedPersonnelServicesData = async (req, res) => {
  try {
    const { regions, region, fiscalYear, budgetType, department, division } = req.query;
    // Build query
    let query = {};
    if (fiscalYear) query.fiscalYear = fiscalYear;
    if (budgetType) query.budgetType = budgetType;

    if (regions) {
      const regionList = Array.isArray(regions) ? regions : [regions];
      query.region = { $in: regionList };
    } else if (region) {
      query.region = region;
    }

    if (department) query.department = new RegExp(`^${String(department).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    if (division) query.division = new RegExp(`^${String(division).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

    // Apply hierarchical filters if present (merged with query)
    const hFilters = req.hierarchicalFilters || req.submissionWorkflowFilters || {};
    if (Object.keys(hFilters).length > 0) {
      if (hFilters.$and) {
        query = {
          $and: [
            query,
            ...hFilters.$and
          ]
        };
      } else {
        query = {
          ...query,
          ...hFilters
        };
      }
    }

    // ── Workflow-status scope filter ────────────────────────────────────
    // Only show Personnel Services data whose parent workflow has been
    // submitted/forwarded to (or past) the requesting user's role.
    const visibleWorkflowIds = await getVisibleWorkflowIdsPS(req, { fiscalYear, budgetType, regions: regions || region });
    if (visibleWorkflowIds !== null) {
      if (visibleWorkflowIds.length === 0) {
        return res.status(200).json({
          success: true,
          data: [],
          matrix: buildRegionalReportMatrix([], ['income', 'subsidy', 'amount']),
          summary: { totalRegions: 0, totalEmployees: 0, grandTotal: 0 }
        });
      }
      const wfFilter = { workflowRef: { $in: visibleWorkflowIds } };
      if (query.$and) {
        query.$and.push(wfFilter);
      } else {
        query.workflowRef = { $in: visibleWorkflowIds };
      }
    }
    // ────────────────────────────────────────────────────────────────────

    const psData = await PersonnelServices.find(query).lean();
    if (!Array.isArray(psData) || psData.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        matrix: buildRegionalReportMatrix([], ['income', 'subsidy', 'amount']),
        summary: {
          totalRegions: 0,
          totalEmployees: 0,
          grandTotal: 0
        }
      });
    }
    // Group by region
    const grouped = {};
    const regionSet = new Set();
    let grandTotal = 0;
    let totalEmployees = 0;
    psData.forEach((employee) => {
      const region = employee.region || 'Unspecified';
      regionSet.add(region);
      totalEmployees++;
      if (!grouped[region]) {
        grouped[region] = {
          region,
          totalEmployees: 0,
          categories: {}
        };
      }
      grouped[region].totalEmployees++;
      // Process each category in the structure
      Object.entries(PERSONNEL_SERVICES_STRUCTURE["B.1.1"].categories).forEach(([categoryKey, categoryData]) => {
        if (!grouped[region].categories[categoryKey]) {
          grouped[region].categories[categoryKey] = {
            name: categoryData.name,
            items: {},
            total: 0, income: 0, subsidy: 0
          };
        }
        const category = grouped[region].categories[categoryKey];
        // Process each item in the category
        Object.entries(categoryData.items).forEach(([itemKey, itemData]) => {
          if (!category.items[itemKey]) {
            category.items[itemKey] = {
              name: itemData.name,
              amount: 0, income: 0, subsidy: 0
            };
          }
          // Calculate amount based on field mapping
          let amount = 0;
          if (itemData.field) {
            const appointment = (employee.statusOfAppointment || '').toString().trim().toUpperCase();
            
            // Special handling for Salaries and Wages based on statusOfAppointment
            if (categoryKey === '1' && itemKey === 'a') {
              // Salaries - Regular (Authorized Positions) = Permanent/Regular/Plantilla only
              if (appointment.includes('PERMANENT') || appointment.includes('REGULAR') || appointment.includes('PLANTILLA')) {
                amount = Number(employee.annualSalary) || 0;
              }
            } else if (categoryKey === '1' && itemKey === 'b') {
              // Casual Personnel = Casual only
              if (appointment.includes('CASUAL')) {
                amount = Number(employee.annualSalary) || 0;
              }
            } else {
              // Regular field mapping for other items
              if (itemData.field.includes(',')) {
                // Handle combined fields (like midyearBonus,yearEndBonus)
                const fields = itemData.field.split(',');
                amount = fields.reduce((sum, field) => sum + (Number(employee[field.trim()]) || 0), 0);
              } else {
                amount = Number(employee[itemData.field]) || 0;
              }
            }
          }
          category.items[itemKey].amount += amount;
          category.total += amount;
          const funding = personnelItemFunding(employee, categoryKey === '1' ? 'annualSalary' : itemData.field, amount);
          category.items[itemKey].income += funding.incomeAmount;
          category.items[itemKey].subsidy += funding.subsidyAmount;
          category.income += funding.incomeAmount;
          category.subsidy += funding.subsidyAmount;
        });
      });
      // Calculate employee total
      const employeeTotal = Math.round((Number(employee.Total) || 0) * 100) / 100;
      grandTotal += employeeTotal;
    });
    // Transform to array format
    let result;
    // Check if we should aggregate all regions into one
    if (!regions || (regions && regions.length === 0)) {
      // All regions case - aggregate everything into one consolidated structure
      const consolidatedCategories = {};
      let consolidatedEmployees = 0;
      Object.values(grouped).forEach(regionData => {
        consolidatedEmployees += regionData.totalEmployees;
        Object.entries(regionData.categories).forEach(([categoryKey, categoryData]) => {
          if (!consolidatedCategories[categoryKey]) {
            consolidatedCategories[categoryKey] = {
              key: categoryKey,
              name: categoryData.name,
              total: 0, income: 0, subsidy: 0,
              items: {}
            };
          }
          consolidatedCategories[categoryKey].total += categoryData.total;
          consolidatedCategories[categoryKey].income += categoryData.income;
          consolidatedCategories[categoryKey].subsidy += categoryData.subsidy;
          Object.entries(categoryData.items).forEach(([itemKey, itemData]) => {
            if (!consolidatedCategories[categoryKey].items[itemKey]) {
              consolidatedCategories[categoryKey].items[itemKey] = {
                key: `${categoryKey}.${itemKey}`,
                name: itemData.name,
                amount: 0, income: 0, subsidy: 0
              };
            }
            consolidatedCategories[categoryKey].items[itemKey].amount += itemData.amount;
            consolidatedCategories[categoryKey].items[itemKey].income += itemData.income;
            consolidatedCategories[categoryKey].items[itemKey].subsidy += itemData.subsidy;
          });
        });
      });
      result = [{
        id: 'ps-all-regions',
        region: 'ALL REGIONS',
        totalEmployees: consolidatedEmployees,
        categories: Object.entries(consolidatedCategories)
          .filter(([_, categoryData]) => categoryData.total > 0)
          .map(([categoryKey, categoryData]) => ({
            id: `all-regions-${categoryKey}`,
            key: categoryKey,
            name: categoryData.name,
            total: categoryData.total,
            income: categoryData.income,
            subsidy: categoryData.subsidy,
            items: Object.entries(categoryData.items)
              .filter(([_, itemData]) => itemData.amount > 0)
              .map(([itemKey, itemData]) => ({
                id: `all-regions-${categoryKey}-${itemKey}`,
                key: itemData.key,
                name: itemData.name,
                amount: itemData.amount,
                income: itemData.income,
                subsidy: itemData.subsidy
              }))
          }))
      }];
    } else {
      // Individual regions case
      result = Object.values(grouped).map(regionData => ({
        id: `ps-${regionData.region}`,
        region: regionData.region,
        totalEmployees: regionData.totalEmployees,
        categories: Object.entries(regionData.categories)
          .filter(([_, categoryData]) => categoryData.total > 0)
          .map(([categoryKey, categoryData]) => ({
            id: `${regionData.region}-${categoryKey}`,
            key: categoryKey,
            name: categoryData.name,
            total: categoryData.total,
            income: categoryData.income,
            subsidy: categoryData.subsidy,
            items: Object.entries(categoryData.items)
              .filter(([_, itemData]) => itemData.amount > 0)
              .map(([itemKey, itemData]) => ({
                id: `${regionData.region}-${categoryKey}-${itemKey}`,
                key: `${categoryKey}.${itemKey}`,
                name: itemData.name,
                amount: itemData.amount,
                income: itemData.income,
                subsidy: itemData.subsidy
              }))
          }))
      })).sort((a, b) => a.region.localeCompare(b.region));
    }
    res.status(200).json({
      success: true,
      data: result,
      matrix: buildPersonnelServicesRegionMatrix(grouped),
      summary: {
        totalRegions: regionSet.size,
        totalEmployees,
        grandTotal: Math.round(grandTotal * 100) / 100,
        funding: summarizePersonnelFunding(psData),
        fundingByRegion: Array.from(regionSet).map(region => ({
          region, ...summarizePersonnelFunding(psData.filter(row => (row.region || 'Unspecified') === region)),
        })),
      }
    });
  } catch (error) {
    console.error('Error fetching Personnel Services data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch Personnel Services data',
      error: error.message
    });
  }
};
// Get available regions with Personnel Services data
const getAvailableRegions = async (req, res) => {
  try {
    // Build query to filter regions based on hierarchical access
    const query = {};
    if (req.hierarchicalFilters && req.hierarchicalFilters.region) {
      query.region = req.hierarchicalFilters.region;
    }
    const regions = await PersonnelServices.distinct('region', query);
    res.status(200).json({
      success: true,
      regions: regions.filter(region => region && region.trim() !== '')
    });
  } catch (error) {
    console.error('Error fetching available regions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available regions',
      error: error.message
    });
  }
};
// Debug endpoint to check statusOfAppointment values
const getStatusOfAppointmentValues = async (req, res) => {
  try {
    // Build query to filter data based on hierarchical access
    const query = {};
    if (req.hierarchicalFilters && req.hierarchicalFilters.region) {
      query.region = req.hierarchicalFilters.region;
    }
    const statuses = await PersonnelServices.distinct('statusOfAppointment', query);
    const sample = await PersonnelServices.findOne(query).select('statusOfAppointment annualSalary employeeFullName');
    res.status(200).json({
      success: true,
      distinctStatuses: statuses,
      sample: sample
    });
  } catch (error) {
    console.error('Error fetching status values:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch status values',
      error: error.message
    });
  }
};

const getConsolidatedPersonnelServicesPdf = async (req, res) => {
  if (!MuhammaraRecipe) {
    return res.status(500).json({ message: 'PDF generation library (muhammara) is not installed on the server.' });
  }
  const requesterId = String(req.user?.id || '').trim();
  if (!requesterId) {
    return res.status(401).json({ message: 'Authentication is required to generate PDF reports.' });
  }

  try {
    const { regions, region, fiscalYear, budgetType, consolidationType } = req.query;
    let { department, division } = req.query;

    // --- SECURITY OVERRIDE: Enforce scope based on user roles and assignments ---
    const userId = req.user?.id || req.user?.userId || req.user?._id || req.user?.UserId;
    const userRoles = req.user?.roles || req.user?.Roles || [];

    // Region-wide roles (Super Admins + BRD roles)
    const REGION_WIDE_ROLES = [
      'SUPER_ADMIN', 'SUPER ADMIN', 'BUDGET_MANAGER',
      'BUDGET_PLANNING_ANALYST', 'BUDGET PLANNING ANALYST',
      'BUDGET_OFFICER', 'BUDGET OFFICER',
      'OVERALL_BUDGET_APPROVER', 'OVERALL BUDGET APPROVER',
      'BUDGET_ADMIN', 'BUDGET ADMIN',
    ];
    let isSuperAdmin = userRoles.some(r => REGION_WIDE_ROLES.includes(r));

    if (!isSuperAdmin) {
      let assignedDept = req.hierarchicalAccess?.accessibleDepartments?.[0]?.departmentName
        || req.submissionWorkflowFilters?.department;
      let assignedDiv = req.hierarchicalAccess?.accessibleDivisions?.[0]
        || req.submissionWorkflowFilters?.division;

      // Emergency DB lookup if middleware didn't provide dept
      if (userId && !assignedDept) {
        try {
          const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
          const assignment = await HierarchicalUserAssignment.findOne({ userId: String(userId) })
            .populate('departmentId').lean();
          if (assignment) {
            const level = assignment.assignmentLevel || '';
            const isRegionLevel = ['BUDGET_AND_REVENUE_DIVISION', 'REGION', 'FULL'].includes(level);
            if (isRegionLevel) {
              isSuperAdmin = true;
            } else if (!assignedDept) {
              assignedDept = assignment.departmentId?.departmentName
                || assignment.departmentId?.Department
                || assignment.departmentId?.DepartmentName;
              assignedDiv = assignedDiv || assignment.divisionName || assignment.division;
            }
          }
        } catch (_) {}
      }

      if (!isSuperAdmin) {
        if (!assignedDept) {
          return res.status(403).json({
            message: 'Cannot generate PDF: your organizational scope could not be determined.'
          });
        }
        // Override query params with scoped values
        department = assignedDept;
        if (assignedDiv) division = assignedDiv;
      }
    }

    const regionList = regions ? (Array.isArray(regions) ? regions : [regions]) : (region ? [region] : null);
    let query = {};
    if (fiscalYear) query.fiscalYear = fiscalYear;
    if (budgetType) query.budgetType = budgetType;

    if (regionList && regionList.length) query.region = { $in: regionList };
    else if (region) query.region = region;
    
    // Enforce accessible region if not super admin and not specified
    if (!isSuperAdmin && !query.region) {
      const accessibleRegion = req.hierarchicalAccess?.accessibleRegions?.[0]?.regionName
        || req.hierarchicalAccessInfo?.accessibleRegions?.[0]?.regionName;
      if (accessibleRegion) query.region = accessibleRegion;
    }

    if (department) query.department = new RegExp(`^${String(department).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    if (division) query.division = new RegExp(`^${String(division).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

    // Apply hierarchical filters if present
    const hFilters = req.hierarchicalFilters || req.submissionWorkflowFilters || {};
    if (Object.keys(hFilters).length > 0) {
      if (hFilters.$and) {
        query = {
          $and: [
            query,
            ...hFilters.$and
          ]
        };
      } else {
        query = {
          ...query,
          ...hFilters
        };
      }
    }

    const visibleWorkflowIds = await getVisibleWorkflowIdsPS(req, {
      fiscalYear,
      budgetType,
      regions: regions || region,
    });
    if (visibleWorkflowIds !== null) query.workflowRef = { $in: visibleWorkflowIds };

    const psData = await PersonnelServices.find(query).lean();
    const showDraftWatermark = await resolveDraftWatermarkForRecords(psData, NewProposalWorkflow);

    // FINAL FALLBACK: Extract from data if still missing
    // Track what to SHOW in the PDF header
    const headerDept = isSuperAdmin ? null : department;
    const headerDiv  = isSuperAdmin ? null : division;

    const generateDocumentId = () => {
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 8);
      return `CPS-${timestamp}-${random}`.toUpperCase();
    };
    const documentId = generateDocumentId();

    let signatoriesInfo = extractSignatoriesFromWorkflow(null, req.user);
    const workflowRefId = psData.map((m) => m.workflowRef).filter(Boolean)[0];
    if (workflowRefId) {
      const workflow = await NewProposalWorkflow.findById(workflowRefId)
        .select('createdByName workflowHistory consolidatedByName')
        .lean();
      if (workflow) {
        signatoriesInfo = extractSignatoriesFromWorkflow(workflow, req.user);
      }
    }

    const grouped = {};
    psData.forEach((employee) => {
      const isMultiRegion = !regionList || regionList.length > 1;
      let rcName;
      if (isMultiRegion || !department) {
        rcName = employee.region || 'Unknown Region';
      } else if (!division) {
        let deptName = employee.department;
        if (deptName === 'IRRIGATION MANAGEMENT OFFICE') deptName = 'IMO';
        rcName = deptName || employee.region || 'Unknown Responsibility Center';
      } else {
        let deptName = employee.department;
        if (deptName === 'IRRIGATION MANAGEMENT OFFICE') deptName = 'IMO';
        rcName = `${deptName} / ${employee.division}`;
      }
      if (!grouped[rcName]) grouped[rcName] = {};
      Object.entries(PERSONNEL_SERVICES_STRUCTURE["B.1.1"].categories).forEach(([categoryKey, categoryData]) => {
        const categoryName = `${categoryKey} ${categoryData.name}`;
        if (!grouped[rcName][categoryName]) grouped[rcName][categoryName] = {};
        Object.entries(categoryData.items).forEach(([itemKey, itemData]) => {
          if (!grouped[rcName][categoryName][itemKey]) {
            grouped[rcName][categoryName][itemKey] = { key: `${categoryKey}.${itemKey}`, name: itemData.name, amount: 0, income: 0, subsidy: 0 };
          }
          let amount = 0;
          if (itemData.field) {
            const appointment = (employee.statusOfAppointment || '').toString().trim().toUpperCase();
            if (categoryKey === '1' && itemKey === 'a') {
              if (appointment.includes('PERMANENT') || appointment.includes('REGULAR') || appointment.includes('PLANTILLA')) {
                amount = Number(employee.annualSalary) || 0;
              }
            } else if (categoryKey === '1' && itemKey === 'b') {
              if (appointment.includes('CASUAL')) amount = Number(employee.annualSalary) || 0;
            } else if (itemData.field.includes(',')) {
              const fields = itemData.field.split(',');
              amount = fields.reduce((sum, field) => sum + (Number(employee[field.trim()]) || 0), 0);
            } else {
              amount = Number(employee[itemData.field]) || 0;
            }
          }
          const item = grouped[rcName][categoryName][itemKey];
          item.amount += amount;
          const funding = personnelItemFunding(employee, categoryKey === '1' ? 'annualSalary' : itemData.field, amount);
          item.income += funding.incomeAmount;
          item.subsidy += funding.subsidyAmount;
        });
      });
    });

    const regionMatrix = buildPersonnelServicesPdfMatrix(grouped);
    const useRegionMatrix = (isAllRegionsSelection({ consolidationType, regions }) || !regionList)
      && regionMatrix.regions.length > 0;

    const tmpFilePath = path.join(os.tmpdir(), `ps_report_${Date.now()}.pdf`);
    const tempSignatureImagePaths = [];
    const recipeOptions = { version: 1.6, author: 'FMIS-BUDGET', title: 'Personnel Services Report' };
    const pdfDoc = new MuhammaraRecipe('new', tmpFilePath, recipeOptions);

    const { width: PAGE_WIDTH, height: PAGE_HEIGHT } = useRegionMatrix
      ? getFolioPageSize(true)
      : { width: 576, height: 936 };
    const MARGIN = 18;
    const CONTENT_LEFT = MARGIN;
    const CONTENT_RIGHT = PAGE_WIDTH - MARGIN;
    const LINE_H = 13;
    let curY = MARGIN;
    let pageNo = 1;
    const textOpt = (o = {}) => ({ color: '#000000', ...o });
    const safeStr = (v) => (v != null && v !== '') ? String(v) : '';
    const formatPhp = (n) => Number(n || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 });
    const resolveExisting = (...candidates) => {
      for (const c of candidates) { if (c && fs.existsSync(c)) return c; }
      return null;
    };
    const wrapText = (text, maxWidth, fontSize) => {
      const words = String(text || '').split(' ');
      const lines = [];
      let currentLine = '';
      const getWidth = (t) => {
        try { return pdfDoc.calculateTextDimensions(t, { fontSize }).width; }
        catch (e) { return t.length * (fontSize * 0.55); }
      };
      words.forEach(word => {
        let testLine = currentLine ? `${currentLine} ${word}` : word;
        if (getWidth(testLine) > maxWidth) {
          if (currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            let part = '';
            for (let char of word) {
              if (getWidth(part + char) > maxWidth) {
                lines.push(part);
                part = char;
              } else {
                part += char;
              }
            }
            currentLine = part;
          }
        } else {
          currentLine = testLine;
        }
      });
      if (currentLine) lines.push(currentLine);
      return lines;
    };
    const sealPath = resolveExisting(path.join(__dirname, '../assets/Seal.png'), path.join(process.cwd(), 'SERVER/assets/Seal.png'), path.join(process.cwd(), 'CLIENT/public/Seal.png'));
    const nialogoPath = resolveExisting(path.join(__dirname, '../assets/logo.png'), path.join(process.cwd(), 'SERVER/assets/logo.png'), path.join(process.cwd(), 'CLIENT/public/logo.png'));
    const bagongPath = resolveExisting(path.join(__dirname, '../assets/Bagong_Pilipinas.png'), path.join(process.cwd(), 'SERVER/assets/Bagong_Pilipinas.png'), path.join(process.cwd(), 'CLIENT/public/Bagong_Pilipinas.png'));

    const drawPage = (isFirst) => {
      const cx = PAGE_WIDTH / 2;
      // Border disabled as requested
      drawMuhammaraDraftWatermark(pdfDoc, {
        show: showDraftWatermark,
        pageWidth: PAGE_WIDTH,
        pageHeight: PAGE_HEIGHT,
      });
      pdfDoc.text('Annex B.1.1 (Personnel Services)', CONTENT_LEFT + 10, PAGE_HEIGHT - 22, textOpt({ fontSize: 8 }));
      pdfDoc.text(`Doc ID: ${documentId}`, CONTENT_LEFT + 10, PAGE_HEIGHT - 12, textOpt({ fontSize: 8 }));
      pdfDoc.text(`Page ${pageNo}`, CONTENT_RIGHT - 55, PAGE_HEIGHT - 12, textOpt({ fontSize: 8 }));
      if (!isFirst) return;

      const logoW = 44, logoH = 44, logoY = MARGIN + 2;
      if (sealPath) { try { pdfDoc.image(sealPath, CONTENT_LEFT, logoY, { width: logoW, height: logoH }); } catch (e) {} }
      if (nialogoPath) { try { pdfDoc.image(nialogoPath, CONTENT_LEFT + logoW + 5, logoY, { width: logoW, height: logoH }); } catch (e) {} }
      if (bagongPath) { try { pdfDoc.image(bagongPath, CONTENT_RIGHT - logoW, logoY, { width: logoW, height: logoH }); } catch (e) {} }

      let hy = logoY + 6;
      pdfDoc.text('Republic of the Philippines', cx, hy, textOpt({ fontSize: 10, align: 'center' }));
      hy += LINE_H;
      pdfDoc.text('OFFICE OF THE PRESIDENT', cx, hy, textOpt({ fontSize: 10, bold: true, align: 'center' }));
      hy += LINE_H;
      pdfDoc.text('NATIONAL IRRIGATION ADMINISTRATION', cx, hy, textOpt({ fontSize: 10, bold: true, align: 'center' }));
      hy += LINE_H;
      
      let rcHeader = regionList && regionList.length ? regionList.join(', ') : 'ALL REGIONS';
      if (headerDept || headerDiv) {
        let subHeader = '';
        if (headerDept) subHeader += headerDept;
        if (headerDiv) subHeader += (subHeader ? ' - ' : '') + headerDiv;
        pdfDoc.text(rcHeader, cx, hy, textOpt({ fontSize: 10, bold: true, align: 'center' }));
        hy += LINE_H;
        pdfDoc.text(subHeader, cx, hy, textOpt({ fontSize: 9, align: 'center' }));
      } else {
        pdfDoc.text(rcHeader, cx, hy, textOpt({ fontSize: 10, bold: true, align: 'center' }));
      }

      curY = hy + LINE_H * 1.3;
      pdfDoc.text(`PERSONNEL SERVICES – ${String(budgetType || 'INITIAL').toUpperCase()} BUDGET PROPOSAL`, cx, curY, textOpt({ fontSize: 12, bold: true, align: 'center' }));
      curY += LINE_H * 1.2;
      pdfDoc.text(`Fiscal Year: ${safeStr(fiscalYear) || 'All Years'}  |  Budget Type: ${safeStr(budgetType) || 'All'}`, cx, curY, textOpt({ fontSize: 10, align: 'center' }));
      curY += LINE_H * 1.8;
    };

    const startNewPage = () => {
      pdfDoc.endPage();
      pageNo += 1;
      pdfDoc.createPage(PAGE_WIDTH, PAGE_HEIGHT);
      curY = MARGIN + 20;
      drawPage(false);
    };
    const ensureSpace = (lines = 1) => {
      if (curY + lines * LINE_H > PAGE_HEIGHT - MARGIN - 22) startNewPage();
    };

    const COL_REGION = 70;
    const COL_ITEM = 35;
    const COL_AMOUNT = 90;
    const COL_PARTICULARS = CONTENT_RIGHT - CONTENT_LEFT - COL_REGION - COL_ITEM - (COL_AMOUNT * 3);
    const colX = {
      region: CONTENT_LEFT,
      item: CONTENT_LEFT + COL_REGION,
      particulars: CONTENT_LEFT + COL_REGION + COL_ITEM,
      income: CONTENT_LEFT + COL_REGION + COL_ITEM + COL_PARTICULARS,
      subsidy: CONTENT_LEFT + COL_REGION + COL_ITEM + COL_PARTICULARS + COL_AMOUNT,
      amount: CONTENT_LEFT + COL_REGION + COL_ITEM + COL_PARTICULARS + (COL_AMOUNT * 2),
    };

    const drawTableHeader = () => {
      ensureSpace(2);
      pdfDoc.rectangle(colX.region, curY - 3, CONTENT_RIGHT - CONTENT_LEFT, LINE_H * 2 + 4, { stroke: '#4d4c4c', lineWidth: 0.5 });
      pdfDoc.text('RESPONSIBILITY', colX.region + 3, curY, textOpt({ fontSize: 6.5, bold: true }));
      pdfDoc.text('CENTER', colX.region + 3, curY + LINE_H, textOpt({ fontSize: 6.5, bold: true }));
      pdfDoc.text('ITEM NO.', colX.item + 3, curY, textOpt({ fontSize: 8, bold: true }));
      pdfDoc.text('PARTICULARS', colX.particulars + 3, curY, textOpt({ fontSize: 8, bold: true }));
      ['income', 'subsidy', 'amount'].forEach(key => pdfDoc.text(key.toUpperCase(), colX[key] + 3, curY, textOpt({ fontSize: 8, bold: true })));
      curY += LINE_H * 2 + 4;
    };

    const financialKeys = ['income', 'subsidy', 'amount'];
    const emptyFinancials = () => ({ income: 0, subsidy: 0, amount: 0 });
    const addFinancials = (target, values) => financialKeys.forEach(key => { target[key] += Number(values?.[key] || 0); });
    const drawFinancials = (values, x, width, y, bold = false) => {
      const cellWidth = width / 3;
      financialKeys.forEach((key, index) => {
        pdfDoc.text(formatPhp(values?.[key]), x + ((index + 1) * cellWidth) - 4, y,
          textOpt({ fontSize: 6.5, bold, align: 'right' }));
      });
    };
    const grandFinancials = emptyFinancials();
    if (useRegionMatrix) {
      const particularsWidth = 250;
      const minAmountWidth = 210;
      const capacity = Math.max(1, Math.floor(((CONTENT_RIGHT - CONTENT_LEFT) - particularsWidth) / minAmountWidth) - 1);
      const chunks = chunkRegionalMatrixRegions(regionMatrix.regions, capacity);
      const headerHeight = 28;
      const sectionHeight = 14;
      const totalHeight = 18;
      let firstMatrixPage = true;

      const drawMatrixHeader = (chunk) => {
        const amountWidth = ((CONTENT_RIGHT - CONTENT_LEFT) - particularsWidth) / (chunk.length + 1);
        const y = curY;
        pdfDoc.rectangle(CONTENT_LEFT, y, CONTENT_RIGHT - CONTENT_LEFT, headerHeight, { stroke: '#4d4c4c', lineWidth: 0.6 });
        pdfDoc.text('PARTICULARS', CONTENT_LEFT + 4, y + 7, textOpt({ fontSize: 7, bold: true }));
        [...chunk, chunks.length > 1 ? 'CHUNK TOTAL' : 'REGIONAL TOTAL'].forEach((label, index) => {
          const x = CONTENT_LEFT + particularsWidth + (index * amountWidth);
          pdfDoc.rectangle(x, y, 0.4, headerHeight, { fill: '#9e9e9e', stroke: '#9e9e9e', lineWidth: 0 });
          wrapText(label, amountWidth - 6, 6).slice(0, 2).forEach((line, lineIndex) => {
            pdfDoc.text(line, x + (amountWidth / 2), y + 4 + (lineIndex * 7), textOpt({ fontSize: 6, bold: true, align: 'center' }));
          });
          financialKeys.forEach((key, subIndex) => pdfDoc.text(key.toUpperCase(), x + (amountWidth / 3) * (subIndex + 0.5), y + 20, textOpt({ fontSize: 5.5, bold: true, align: 'center' })));
        });
        curY += headerHeight;
        return amountWidth;
      };

      const startMatrixPage = (chunk) => {
        if (!firstMatrixPage) {
          pdfDoc.endPage();
          pageNo += 1;
        }
        pdfDoc.createPage(PAGE_WIDTH, PAGE_HEIGHT);
        curY = MARGIN;
        drawPage(firstMatrixPage);
        if (!firstMatrixPage) curY = MARGIN + 25;
        firstMatrixPage = false;
        return drawMatrixHeader(chunk);
      };

      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
        const chunk = chunks[chunkIndex];
        let amountWidth = startMatrixPage(chunk);
        const ensureMatrixSpace = (height) => {
          if (curY + height <= PAGE_HEIGHT - MARGIN - 25) return;
          pdfDoc.endPage();
          pageNo += 1;
          pdfDoc.createPage(PAGE_WIDTH, PAGE_HEIGHT);
          curY = MARGIN + 25;
          drawPage(false);
          amountWidth = drawMatrixHeader(chunk);
        };

        regionMatrix.sections.forEach((section) => {
          const firstLines = wrapText(section.rows[0]?.particulars, particularsWidth - 16, 7);
          ensureMatrixSpace(sectionHeight + Math.max(17, 6 + firstLines.length * 7.4));
          pdfDoc.rectangle(CONTENT_LEFT, curY, CONTENT_RIGHT - CONTENT_LEFT, sectionHeight, { fill: '#f2f2f2', stroke: '#9e9e9e', lineWidth: 0.4 });
          pdfDoc.text(section.name, CONTENT_LEFT + 4, curY + 4, textOpt({ fontSize: 6.8, bold: true }));
          curY += sectionHeight;

          section.rows.forEach((row) => {
            const titleLines = wrapText(row.particulars, particularsWidth - 16, 7);
            const rowHeight = Math.max(17, 6 + titleLines.length * 7.4);
            ensureMatrixSpace(rowHeight);
            pdfDoc.rectangle(CONTENT_LEFT, curY, CONTENT_RIGHT - CONTENT_LEFT, rowHeight, { stroke: '#c0c0c0', lineWidth: 0.3 });
            titleLines.forEach((line, lineIndex) => pdfDoc.text(line, CONTENT_LEFT + 10, curY + 4 + lineIndex * 7.4, textOpt({ fontSize: 7 })));
            const chunkTotal = emptyFinancials();
            chunk.forEach((regionName, index) => {
              const x = CONTENT_LEFT + particularsWidth + (index * amountWidth);
              pdfDoc.rectangle(x, curY, 0.3, rowHeight, { fill: '#c0c0c0', stroke: '#c0c0c0', lineWidth: 0 });
              const values = row.valuesByRegion?.[regionName];
              addFinancials(chunkTotal, values);
              drawFinancials(values, x, amountWidth, curY + Math.max(4, (rowHeight - 7) / 2));
            });
            const totalX = CONTENT_LEFT + particularsWidth + (chunk.length * amountWidth);
            pdfDoc.rectangle(totalX, curY, 0.4, rowHeight, { fill: '#9e9e9e', stroke: '#9e9e9e', lineWidth: 0 });
            drawFinancials(chunkTotal, totalX, amountWidth, curY + Math.max(4, (rowHeight - 7) / 2), true);
            curY += rowHeight;
          });
          ensureMatrixSpace(totalHeight);
          pdfDoc.text('SUBTOTAL', CONTENT_LEFT + 4, curY + 5, textOpt({ fontSize: 7, bold: true }));
          const sectionTotal = emptyFinancials();
          chunk.forEach((regionName, index) => {
            const values = emptyFinancials();
            section.rows.forEach(row => addFinancials(values, row.valuesByRegion?.[regionName]));
            addFinancials(sectionTotal, values);
            drawFinancials(values, CONTENT_LEFT + particularsWidth + index * amountWidth, amountWidth, curY + 5, true);
          });
          drawFinancials(sectionTotal, CONTENT_LEFT + particularsWidth + chunk.length * amountWidth, amountWidth, curY + 5, true);
          curY += totalHeight;
        });

        ensureMatrixSpace(totalHeight);
        pdfDoc.rectangle(CONTENT_LEFT, curY, CONTENT_RIGHT - CONTENT_LEFT, totalHeight, { fill: '#ededed', stroke: '#4d4c4c', lineWidth: 0.7 });
        pdfDoc.text(chunks.length > 1 ? 'CHUNK REGIONAL TOTAL' : 'REGIONAL TOTAL', CONTENT_LEFT + 4, curY + 5, textOpt({ fontSize: 7.5, bold: true }));
        const chunkGrandTotal = emptyFinancials();
        chunk.forEach((regionName, index) => {
          const x = CONTENT_LEFT + particularsWidth + (index * amountWidth);
          const values = regionMatrix.totalsByRegion?.[regionName];
          addFinancials(chunkGrandTotal, values);
          pdfDoc.rectangle(x, curY, 0.4, totalHeight, { fill: '#9e9e9e', stroke: '#9e9e9e', lineWidth: 0 });
          drawFinancials(values, x, amountWidth, curY + 5, true);
        });
        const totalX = CONTENT_LEFT + particularsWidth + (chunk.length * amountWidth);
        pdfDoc.rectangle(totalX, curY, 0.4, totalHeight, { fill: '#4d4c4c', stroke: '#4d4c4c', lineWidth: 0 });
        drawFinancials(chunkGrandTotal, totalX, amountWidth, curY + 5, true);
        curY += totalHeight + 6;

        if (chunks.length > 1 && chunkIndex === chunks.length - 1) {
          ensureMatrixSpace(totalHeight);
          pdfDoc.rectangle(CONTENT_LEFT, curY, CONTENT_RIGHT - CONTENT_LEFT, totalHeight, { fill: '#dfe8df', stroke: '#4d4c4c', lineWidth: 0.8 });
          pdfDoc.text('ALL-REGION TOTAL', CONTENT_LEFT + 4, curY + 5, textOpt({ fontSize: 8, bold: true }));
          drawFinancials(regionMatrix.regionalTotal, totalX, amountWidth, curY + 5, true);
          curY += totalHeight + 6;
        }
      }
    } else {
      pdfDoc.createPage(PAGE_WIDTH, PAGE_HEIGHT);
      drawPage(true);
      drawTableHeader();

    for (const [rcName, categories] of Object.entries(grouped)) {
      let regionFirstRow = true;
      for (const [categoryName, itemsMap] of Object.entries(categories)) {
        const filteredItems = Object.values(itemsMap).filter(item => Number(item.amount || 0) > 0);
        if (filteredItems.length === 0) continue;

        ensureSpace(2);
        pdfDoc.rectangle(colX.region, curY - 2, CONTENT_RIGHT - CONTENT_LEFT, LINE_H + 2, { stroke: '#c0d0c0', lineWidth: 0.3 });
        
        const rcLines = regionFirstRow ? wrapText(rcName, COL_REGION - 6, 7) : [''];
        ensureSpace(Math.max(1, rcLines.length));
        rcLines.forEach((line, idx) => {
          pdfDoc.text(line, colX.region + 3, curY + (idx * LINE_H), textOpt({ fontSize: 7, bold: true }));
        });

        pdfDoc.text(categoryName, colX.item + 3, curY, textOpt({ fontSize: 8, bold: true }), { columnWidth: COL_PARTICULARS + COL_ITEM - 6, overflow: 'truncate' });
        curY += (Math.max(1, rcLines.length) * LINE_H);
        regionFirstRow = false;

        const catFinancials = emptyFinancials();
        filteredItems.forEach((item) => {
          const lines = wrapText(safeStr(item.name), COL_PARTICULARS - 6, 7.5);
          ensureSpace(Math.max(1, lines.length));
          pdfDoc.text(safeStr(item.key), colX.item + 3, curY, textOpt({ fontSize: 7.5 }));
          lines.forEach((line, index) => pdfDoc.text(line, colX.particulars + 3, curY + index * LINE_H, textOpt({ fontSize: 7.5 })));
          drawFinancials(item, colX.income, COL_AMOUNT * 3, curY);
          curY += LINE_H * Math.max(1, lines.length);
          addFinancials(catFinancials, item);
        });

        ensureSpace(1);
        pdfDoc.rectangle(colX.region, curY - 1, CONTENT_RIGHT - CONTENT_LEFT, LINE_H + 1, { stroke: '#9e9e9e', lineWidth: 0.4 });
        pdfDoc.text(`Subtotal: ${categoryName}`, colX.item + 3, curY, textOpt({ fontSize: 7.5, bold: true }));
        drawFinancials(catFinancials, colX.income, COL_AMOUNT * 3, curY, true);
        curY += LINE_H + 2;
        addFinancials(grandFinancials, catFinancials);
      }
      curY += 4;
    }

    ensureSpace(2);
    pdfDoc.rectangle(colX.region, curY - 2, CONTENT_RIGHT - CONTENT_LEFT, LINE_H + 4, { stroke: '#4d4c4c', lineWidth: 0.6 });
    pdfDoc.text('GRAND TOTAL', colX.region + 3, curY, textOpt({ fontSize: 9, bold: true }));
    drawFinancials(grandFinancials, colX.income, COL_AMOUNT * 3, curY, true);
    curY += LINE_H + 6;
    }

    if (useRegionMatrix && needsCleanMatrixSignaturePage({
      currentY: curY,
      requiredHeight: 8 * LINE_H,
      pageHeight: PAGE_HEIGHT,
      margin: MARGIN,
    })) {
      // Signatures continue on clean report chrome; never render the legacy
      // Responsibility Center table header after an All Regions matrix.
      pdfDoc.endPage();
      pageNo += 1;
      pdfDoc.createPage(PAGE_WIDTH, PAGE_HEIGHT);
      curY = MARGIN + 20;
      drawPage(false);
    } else if (!useRegionMatrix) {
      ensureSpace(8);
    }
    curY += LINE_H * 2;
    const sigContext = (regionList && regionList.length === 1) ? { region: regionList[0] } : null;
    signatoriesInfo = await enrichSignatoriesWithPositionTitle(signatoriesInfo, sigContext);
    curY = drawWorkflowSignatureBlock(pdfDoc, signatoriesInfo, curY, MARGIN, PAGE_WIDTH - (MARGIN * 2), tempSignatureImagePaths);

    pdfDoc.endPage().endPDF((err) => {
      if (err) {
        if (!res.headersSent) return res.status(500).json({ message: 'Failed to generate PDF', error: err.message });
        return;
      }
      if (res.headersSent) return;
      res.setHeader('Content-Type', 'application/pdf');
      const filename = `Consolidated_PS_${safeStr(fiscalYear) || 'All'}_${safeStr(budgetType) || 'All'}.pdf`;
      res.setHeader('Content-Disposition', `inline; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
      res.setHeader('X-Document-ID', documentId);
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-Document-ID');
      const stream = fs.createReadStream(tmpFilePath);
      stream.on('error', (e) => { if (!res.headersSent) res.status(500).json({ message: 'Stream error', error: e.message }); });
      res.on('finish', () => {
        cleanupTempImages(tempSignatureImagePaths);
        fs.unlink(tmpFilePath, () => {});
      });
      stream.pipe(res);
    });
  } catch (error) {
    console.error('Error generating consolidated Personnel Services PDF:', error);
    if (!res.headersSent) return res.status(500).json({ message: 'Failed to generate consolidated Personnel Services PDF', error: error.message });
  }
};

module.exports = {
  getConsolidatedPersonnelServicesData,
  getAvailableRegions,
  getStatusOfAppointmentValues,
  getConsolidatedPersonnelServicesPdf,
  _private: { buildPersonnelServicesRegionMatrix, buildPersonnelServicesPdfMatrix }
};
