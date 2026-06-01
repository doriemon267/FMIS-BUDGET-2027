const fs = require('fs');
const os = require('os');
const path = require('path');
const PersonnelServices = require('../models/PersonnelServices');
const COSPersonnel = require('../models/COSPersonnel');
const MooeProposal = require('../models/mooeProposals');
const CapitalOutlay = require('../models/CapitalOutlay');
const CapitalOutlayDetails = require('../models/CapitalOutlayDetails');
const Income = require('../models/Income');
const Region = require('../models/Region');
const Settings = require('../models/Settings');
const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
const NewProposalWorkflow = require('../models/NewProposalWorkflow');
const Proposal = require('../models/Proposal');
const User = require('../models/User');
const ReportAuditLog = require('../models/ReportAuditLog');
const formatFullName = require('../utils/formatFullName');
let MuhammaraRecipe;
try {
  // Lazy-load muhammara so the rest of the app still works even if it's not installed yet
  MuhammaraRecipe = require('muhammara').Recipe;
} catch (e) {
  MuhammaraRecipe = null;
}
// Define the comprehensive budget structure
const COMPREHENSIVE_BUDGET_STRUCTURE = {
  "A": {
    name: "AGENCY INCOME",
    categories: {
      "1": {
        name: "Corporate Income",
        description: "Total agency income from various sources",
        structure: "A.1"
      }
    }
  },
  "B": {
    name: "EXPENDITURES",
    categories: {
      "1": {
        name: "Current Operating Expenditures",
        subcategories: {
          "1": {
            name: "Personnel Services",
            description: "Personnel-related expenditures",
            structure: "B.1.1"
          },
          "2": {
            name: "Maintenance and Other Operating Expenses",
            description: "MOOE expenditures",
            structure: "B.1.2"
          }
        }
      },
      "2": {
        name: "Capital Outlays",
        description: "Capital expenditures and investments",
        structure: "B.2"
      }
    }
  }
};
// Personnel Services hierarchical structure
const PERSONNEL_SERVICES_STRUCTURE = {
  "B.1.1": {
    name: "Personnel Services",
    categories: {
      "1": {
        name: "Salaries and Wages",
        items: {
          "a": { name: "Salaries - Regular (Authorized Positions)", field: "annualSalary" },
          "b": { name: "Casual Personnel", field: "casualPersonnel" }
        }
      },
      "2": {
        name: "Other Compensation",
        items: {
          "a": { name: "PERA", field: "PERA" },
          "b": { name: "Representation Allowance", field: "RATA" },
          "c": { name: "Transportation Allowance", field: "transportationAllowance" },
          "d": { name: "Honoraria", field: "honoraria" },
          "e": { name: "Uniform/Clothing Allowance", field: "uniformALLOWANCE" },
          "f": { name: "Children Allowances", field: "childrenAllowance" },
          "g": { name: "Medical Allowances", field: "medical" },
          "h": { name: "Additional Medical Allowance", field: "additionalMedical" },
          "i": { name: "Meal Allowances", field: "meal" },
          "j": { name: "Per Diem & Allowance of Board of Directors", field: "perDiem" },
          "k": { name: "Subsistence Allowance", field: "subsistenceAllowance" },
          "l": { name: "Longevity Pay (Loyalty Award)", field: "loyaltyAward" },
          "m": { name: "Overtime Services", field: "overtimePay" },
          "n": { name: "Special Counsel Allowance", field: "specialCounsel" },
          "o": { name: "Productivity Enhancement Incentive", field: "productivityIncentive" },
          "p": { name: "Cash Gift", field: "cashGift" },
          "q": { name: "Mid-Year and Year-End Bonus", field: "midyearBonus,yearEndBonus" },
          "r": { name: "Performance Based Bonus", field: "performanceBonus" },
          "s": { name: "Hazard Pay", field: "hazardPay" },
          "t": { name: "Other Bonuses and Allowances", field: "otherBonuses" },
          "u": { name: "Anniversary Bonus", field: "anniversaryBonus" }
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
          "e": { name: "Provident Fund", field: "providentFund" }
        }
      },
      "5": {
        name: "REORG",
        items: {
          "a": { name: "Reorganization Costs", field: "reorgCosts" }
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
/**
 * Add approver scope filter: restrict to proposals with status FORWARDED_TO_APPROVER or RETURNED_TO_APPROVER.
 * When approverProposalFilter is provided and has IDs, only data linked to those proposals is included.
 * When approverProposalFilter is provided but has empty IDs, return early with empty report.
 */
const getRoleBasedProposalFilterFromRequest = async (req, regionsParam, fiscalYear, budgetType) => {
  const userRoles = req.user?.Roles || [];
  const isApprover = userRoles.some(r => (r && String(r).replace(/\s+/g, '_')) === 'BUDGET_APPROVER') ||
    userRoles.some(r => (r && String(r).replace(/\s+/g, ' ').trim()) === 'BUDGET APPROVER');
  const isReviewer = userRoles.some(r => (r && String(r).replace(/\s+/g, '_')) === 'BUDGET_REVIEWER') ||
    userRoles.some(r => (r && String(r).replace(/\s+/g, ' ').trim()) === 'BUDGET REVIEWER');
  if ((!isApprover && !isReviewer) || !fiscalYear || !budgetType) return null;

  const reviewerVisibleStatuses = [
    'FORWARDED_TO_REVIEWER',
    'RETURNED_TO_REVIEWER',
    'FORWARDED_TO_APPROVER',
    'RETURNED_TO_APPROVER',
    'FORWARDED_TO_BRD_ANALYST',
    'FORWARDED_TO_BRD_OFFICER',
    'FORWARDED_TO_BRD_MANAGER',
    'FINALIZED',
    'RETURNED_TO_PLANNING_ANALYST',
    'RETURNED_TO_OFFICER'
  ];

  const approverVisibleStatuses = [
    'FORWARDED_TO_APPROVER',
    'RETURNED_TO_APPROVER',
    'FORWARDED_TO_BRD_ANALYST',
    'FORWARDED_TO_BRD_OFFICER',
    'FORWARDED_TO_BRD_MANAGER',
    'FINALIZED',
    'RETURNED_TO_PLANNING_ANALYST',
    'RETURNED_TO_OFFICER'
  ];

  const statuses = isApprover ? approverVisibleStatuses : reviewerVisibleStatuses;

  const modelTypeMap = { NEP: 'NEP', GAA: 'GAA' };
  const modelType = modelTypeMap[String(budgetType).toUpperCase()] || 'Initial';
  const fyNum = Number(fiscalYear) || parseInt(fiscalYear, 10);

  const npwQuery = {
    status: { $in: statuses },
    fiscalYear: Number.isFinite(fyNum) ? fyNum : parseInt(String(fiscalYear), 10),
    modelType
  };

  if (regionsParam && regionsParam !== 'all') {
    const regionList = Array.isArray(regionsParam) ? regionsParam : [regionsParam];
    const regionDocs = await Region.find({ Region: { $in: regionList } }).select('_id').lean();
    const regionIds = regionDocs.map((r) => r._id);
    if (regionIds.length > 0) npwQuery.region = { $in: regionIds };
  }

  const npwDocs = await NewProposalWorkflow.find(npwQuery).select('_id').lean();
  const workflowIds = npwDocs.map((d) => d._id);
  const proposalDocs = await Proposal.find({ proposalId: { $in: workflowIds } }).select('_id').lean();
  const proposalIds = proposalDocs.map((d) => d._id);
  return { workflowIds, proposalIds };
};

const applyApproverProposalFilter = (baseQuery, approverProposalFilter) => {
  if (!approverProposalFilter || (!approverProposalFilter.workflowIds?.length && !approverProposalFilter.proposalIds?.length)) {
    return null; // No filter to apply
  }
  const orConditions = [];
  if (approverProposalFilter.workflowIds?.length) {
    orConditions.push({ workflowRef: { $in: approverProposalFilter.workflowIds } });
  }
  if (approverProposalFilter.proposalIds?.length) {
    orConditions.push({ proposalId: { $in: approverProposalFilter.proposalIds } });
  }
  return orConditions.length ? { $and: [{ ...baseQuery }, { $or: orConditions }] } : baseQuery;
};

const REPORT_RELEASE_WORKFLOW_STATUSES = [
  'FORWARDED_TO_REVIEWER',
  'FORWARDED_TO_APPROVER',
  'FORWARDED_TO_BRD_ANALYST',
  'FORWARDED_TO_BRD_OFFICER',
  'FORWARDED_TO_BRD_MANAGER',
  'FINALIZED',
  'RETURNED_TO_PREPARER',
  'RETURNED_TO_REVIEWER',
  'RETURNED_TO_APPROVER',
  'RETURNED_TO_PLANNING_ANALYST',
  'RETURNED_TO_OFFICER'
];

const roleToPositionLabel = (role) => {
  const normalized = String(role || '').replace(/\s+/g, '_').toUpperCase();
  const map = {
    BUDGET_PREPARER: 'Budget Preparer',
    BUDGET_REVIEWER: 'Budget Reviewer',
    BUDGET_APPROVER: 'Budget Approver',
    BUDGET_PLANNING_ANALYST: 'Budget Planning Analyst',
    BUDGET_OFFICER: 'Budget Officer',
    BUDGET_MANAGER: 'Budget Manager',
    OVERALL_BUDGET_APPROVER: 'Budget Manager',
    SUPER_ADMIN: 'Super Admin'
  };
  return map[normalized] || String(role || '').replace(/_/g, ' ') || 'Workflow Signatory';
};

const getSignatureVerificationInfo = ({ hasDigitalSignature, hasESignature, certificateFingerprint256, trustBundleConfigured }) => {
  if (hasDigitalSignature) {
    const hasFingerprint = Boolean(certificateFingerprint256);
    const trustConfigured = trustBundleConfigured !== false;

    if (hasFingerprint && trustConfigured) {
      return {
        statusLabel: 'Valid (PNPKI)',
        reason: 'Cryptographic signature verified with trusted certificate chain.'
      };
    }

    return {
      statusLabel: 'Unverifiable',
      reason: 'Digital signature present but trust-chain requirements are incomplete.'
    };
  }

  if (hasESignature) {
    return {
      statusLabel: 'Image only',
      reason: 'Captured e-signature is visual proof only and not cryptographically verifiable.'
    };
  }

  return {
    statusLabel: 'No signature',
    reason: 'No signature data recorded for this action.'
  };
};

const resolveDisplayName = ({ workflowName, eSignatureSignerName, assignmentName, userDoc }) => {
  const userDocFormatted = formatFullName(userDoc || {});
  const candidates = [
    eSignatureSignerName,
    assignmentName,
    userDocFormatted,
    userDoc?.name,
    userDoc?.particular,
    workflowName,
  ];

  for (const candidate of candidates) {
    const value = String(candidate || '').trim();
    if (!value) continue;
    if (value.toLowerCase() === 'dev user') continue;
    return value;
  }

  const fallback = String(workflowName || '').trim();
  return fallback || 'Unknown Signatory';
};

const buildUserProfileMaps = async (userIds) => {
  const ids = [...new Set((Array.isArray(userIds) ? userIds : []).map((v) => String(v || '').trim()).filter(Boolean))];
  if (ids.length === 0) {
    return { assignmentMap: new Map(), userMap: new Map() };
  }

  const [assignmentDocs, userDocs] = await Promise.all([
    HierarchicalUserAssignment.find({ userId: { $in: ids } })
      .select('userId userName userRole')
      .lean(),
    User.find({ userId: { $in: ids } })
      .select('userId name FirstName MiddleName LastName Suffix particular')
      .lean(),
  ]);

  return {
    assignmentMap: new Map((assignmentDocs || []).map((doc) => [String(doc.userId), doc])),
    userMap: new Map((userDocs || []).map((doc) => [String(doc.userId), doc])),
  };
};

const resolveRoleFromWorkflowAction = (entry) => {
  const action = String(entry?.action || '');
  const fromStatus = String(entry?.fromStatus || '').toUpperCase();

  if (action === 'submit-to-reviewer') return 'BUDGET PREPARER';
  if (action === 'submit-to-approver') {
    if (fromStatus === 'FORWARDED_TO_REVIEWER' || fromStatus === 'RETURNED_TO_REVIEWER') return 'BUDGET REVIEWER';
    return 'BUDGET PREPARER';
  }
  if (action === 'submit-to-analyst') {
    if (fromStatus === 'FORWARDED_TO_REVIEWER' || fromStatus === 'RETURNED_TO_REVIEWER') return 'BUDGET REVIEWER';
    return 'BUDGET APPROVER';
  }
  if (action === 'forward-to-officer') return 'BUDGET PLANNING ANALYST';
  if (action === 'forward-to-manager') return 'BUDGET OFFICER';
  if (action === 'finalize') return 'BUDGET MANAGER';
  return null;
};

const mapBudgetTypeToModelType = (budgetType) => {
  const modelTypeMap = { NEP: 'NEP', GAA: 'GAA' };
  return modelTypeMap[String(budgetType || '').toUpperCase()] || 'Initial';
};

const applyWorkflowScopeFilter = (baseQuery, scopeFilter) => {
  if (!scopeFilter || (!scopeFilter.workflowIds?.length && !scopeFilter.proposalIds?.length)) {
    return null;
  }

  const orConditions = [];
  if (scopeFilter.workflowIds?.length) {
    orConditions.push({ workflowRef: { $in: scopeFilter.workflowIds } });
  }
  if (scopeFilter.proposalIds?.length) {
    orConditions.push({ proposalId: { $in: scopeFilter.proposalIds } });
  }
  return orConditions.length ? { $and: [{ ...baseQuery }, { $or: orConditions }] } : baseQuery;
};

const resolvePreparedByInfo = async (workflowDocs) => {
  if (!Array.isArray(workflowDocs) || workflowDocs.length === 0) {
    return null;
  }

  const candidates = [];
  workflowDocs.forEach((doc) => {
    const history = Array.isArray(doc.workflowHistory) ? doc.workflowHistory : [];
    history.forEach((entry) => {
      const isSubmitAction = ['submit-to-reviewer', 'submit-to-approver'].includes(String(entry?.action || ''));
      const isCreatorStep = String(entry?.performedBy || '') === String(doc?.createdBy || '');
      if (!isSubmitAction || !isCreatorStep) return;

      candidates.push({
        name: entry?.performedByName || doc?.createdByName || 'Budget Preparer',
        userId: String(entry?.performedBy || doc?.createdBy || ''),
        signedAt: entry?.digitalSignature?.signedAt || entry?.timestamp || null,
        hasDigitalSignature: Boolean(entry?.digitalSignature?.signedPayloadHash || entry?.digitalSignature?.signatureAlgorithm),
        signatureAlgorithm: entry?.digitalSignature?.signatureAlgorithm || null,
        eSignatureImageDataUrl: entry?.eSignature?.imageDataUrl || null,
        eSignatureSignedAt: entry?.eSignature?.signedAt || null,
        eSignatureSignerName: entry?.eSignature?.signerName || null
      });
    });
  });

  if (candidates.length === 0) {
    const firstWorkflow = workflowDocs[0];
    const { assignmentMap, userMap } = await buildUserProfileMaps([String(firstWorkflow?.createdBy || '')]);
    const assignment = assignmentMap.get(String(firstWorkflow?.createdBy || ''));
    const userDoc = userMap.get(String(firstWorkflow?.createdBy || ''));
    const resolvedName = resolveDisplayName({
      workflowName: firstWorkflow?.createdByName || 'Budget Preparer',
      eSignatureSignerName: null,
      assignmentName: assignment?.userName,
      userDoc,
    });

    return {
      name: resolvedName,
      userId: String(firstWorkflow?.createdBy || ''),
      position: roleToPositionLabel(assignment?.userRole || 'BUDGET_PREPARER'),
      hasDigitalSignature: false,
      signatureAlgorithm: null,
      signedAt: null,
      eSignatureImageDataUrl: null,
      eSignatureSignedAt: null,
      eSignatureSignerName: null
    };
  }

  candidates.sort((a, b) => new Date(b.signedAt || 0).getTime() - new Date(a.signedAt || 0).getTime());
  const distinctNames = new Set(candidates.map((c) => c.name));
  const topCandidate = candidates[0];
  const { assignmentMap, userMap } = await buildUserProfileMaps(candidates.map((c) => c.userId));
  const assignment = assignmentMap.get(String(topCandidate.userId || ''));
  const userDoc = userMap.get(String(topCandidate.userId || ''));
  const resolvedName = resolveDisplayName({
    workflowName: topCandidate.name,
    eSignatureSignerName: topCandidate.eSignatureSignerName,
    assignmentName: assignment?.userName,
    userDoc,
  });

  return {
    ...topCandidate,
    name: distinctNames.size > 1 ? 'Multiple Budget Preparers' : resolvedName,
    position: distinctNames.size > 1 ? 'Multiple Signatories' : roleToPositionLabel(assignment?.userRole || 'BUDGET_PREPARER')
  };
};

const resolveWorkflowSignatories = async (workflowDocs) => {
  if (!Array.isArray(workflowDocs) || workflowDocs.length === 0) {
    return [];
  }

  const rawEntries = [];
  workflowDocs.forEach((doc) => {
    const history = Array.isArray(doc.workflowHistory) ? doc.workflowHistory : [];
    history.forEach((entry) => {
      const workflowRole = resolveRoleFromWorkflowAction(entry);
      const hasDigitalSignature = Boolean(entry?.digitalSignature?.signedPayloadHash || entry?.digitalSignature?.signatureAlgorithm);
      const hasESignature = Boolean(entry?.eSignature?.imageDataUrl);
      if (!workflowRole || (!hasDigitalSignature && !hasESignature)) return;

      rawEntries.push({
        workflowRole,
        userId: String(entry?.performedBy || ''),
        fullName: String(entry?.performedByName || doc?.createdByName || '').trim() || 'Unknown Signatory',
        eSignatureSignerName: String(entry?.eSignature?.signerName || '').trim(),
        eSignatureImageDataUrl: entry?.eSignature?.imageDataUrl || null,
        signedAt: entry?.digitalSignature?.signedAt || entry?.eSignature?.signedAt || entry?.timestamp || null,
        hasDigitalSignature,
        signatureAlgorithm: entry?.digitalSignature?.signatureAlgorithm || null,
        certificateFingerprint256: entry?.digitalSignature?.certificateFingerprint256 || null,
        trustBundleConfigured: entry?.digitalSignature?.trustBundleConfigured,
        hasESignature
      });
    });
  });

  if (rawEntries.length === 0) return [];

  const userIds = [...new Set(rawEntries.map((item) => item.userId).filter(Boolean))];
  const { assignmentMap, userMap } = await buildUserProfileMaps(userIds);

  const dedupMap = new Map();
  rawEntries.forEach((item) => {
    const key = `${item.workflowRole}:${item.userId || item.fullName}`;
    const existing = dedupMap.get(key);
    const itemTime = new Date(item.signedAt || 0).getTime();
    const existingTime = new Date(existing?.signedAt || 0).getTime();
    if (!existing || itemTime >= existingTime) {
      dedupMap.set(key, item);
    }
  });

  const roleOrder = {
    'BUDGET PREPARER': 1,
    'BUDGET REVIEWER': 2,
    'BUDGET APPROVER': 3,
    'BUDGET PLANNING ANALYST': 4,
    'BUDGET OFFICER': 5,
    'BUDGET MANAGER': 6
  };

  return [...dedupMap.values()]
    .map((item) => {
      const assignment = assignmentMap.get(String(item.userId || ''));
      const userDoc = userMap.get(String(item.userId || ''));
      const assignmentRole = assignment?.userRole || item.workflowRole;
      const position = roleToPositionLabel(assignmentRole);
      const fullName = resolveDisplayName({
        workflowName: item.fullName,
        eSignatureSignerName: item.eSignatureSignerName,
        assignmentName: assignment?.userName,
        userDoc,
      });
      const verification = getSignatureVerificationInfo({
        hasDigitalSignature: item.hasDigitalSignature,
        hasESignature: item.hasESignature,
        certificateFingerprint256: item.certificateFingerprint256,
        trustBundleConfigured: item.trustBundleConfigured,
      });
      return {
        ...item,
        fullName,
        position,
        signatureType: item.hasDigitalSignature ? 'Cryptographic digital signature' : 'Captured e-signature',
        verificationStatus: verification.statusLabel,
        verificationReason: verification.reason,
      };
    })
    .sort((a, b) => {
      const roleDiff = (roleOrder[a.workflowRole] || 999) - (roleOrder[b.workflowRole] || 999);
      if (roleDiff !== 0) return roleDiff;
      return new Date(a.signedAt || 0).getTime() - new Date(b.signedAt || 0).getTime();
    });
};

const getReleasedProposalScopeFilter = async ({ regions, fiscalYear, budgetType, groupBy, offices, responsibilityCenters, preparerScope }) => {
  // 1. Get all active/released consolidated proposals to find their merged source IDs
  const activeConsolidatedQuery = {
    isConsolidated: true,
    status: { $in: REPORT_RELEASE_WORKFLOW_STATUSES }
  };
  if (fiscalYear) {
    const fyNum = Number(fiscalYear) || parseInt(fiscalYear, 10);
    activeConsolidatedQuery.fiscalYear = Number.isFinite(fyNum) ? fyNum : parseInt(String(fiscalYear), 10);
  }
  if (budgetType) {
    activeConsolidatedQuery.modelType = mapBudgetTypeToModelType(budgetType);
  }
  if (regions && regions !== 'all') {
    const regionList = Array.isArray(regions) ? regions : [regions];
    const regionDocs = await Region.find({ Region: { $in: regionList } }).select('_id').lean();
    const regionIds = regionDocs.map((r) => r._id);
    if (regionIds.length > 0) activeConsolidatedQuery.region = { $in: regionIds };
  }
  const activeConsolidatedDocs = await NewProposalWorkflow.find(activeConsolidatedQuery).select('mergedFrom').lean();
  const allowedMergedIds = [];
  activeConsolidatedDocs.forEach(doc => {
    if (Array.isArray(doc.mergedFrom)) {
      allowedMergedIds.push(...doc.mergedFrom);
    }
  });

  // 2. Initialize query with statuses and allowed merged IDs in an $and block to prevent collisions with other filters
  const npwQuery = {
    $and: [
      {
        $or: [
          { status: { $in: REPORT_RELEASE_WORKFLOW_STATUSES } },
          { _id: { $in: allowedMergedIds } }
        ]
      }
    ]
  };

  if (fiscalYear) {
    const fyNum = Number(fiscalYear) || parseInt(fiscalYear, 10);
    npwQuery.$and.push({ fiscalYear: Number.isFinite(fyNum) ? fyNum : parseInt(String(fiscalYear), 10) });
  }

  if (budgetType) {
    npwQuery.$and.push({ modelType: mapBudgetTypeToModelType(budgetType) });
  }

  if (regions && regions !== 'all') {
    const regionList = Array.isArray(regions) ? regions : [regions];
    const regionDocs = await Region.find({ Region: { $in: regionList } }).select('_id').lean();
    const regionIds = regionDocs.map((r) => r._id);
    if (regionIds.length > 0) {
      npwQuery.$and.push({ region: { $in: regionIds } });
    } else {
      npwQuery.$and.push({ region: null });
    }
  }

  if (groupBy === 'office' && Array.isArray(offices) && offices.length > 0) {
    npwQuery.$and.push({ department: { $in: offices } });
  }

  if (groupBy === 'responsibilityCenter' && Array.isArray(responsibilityCenters) && responsibilityCenters.length > 0) {
    npwQuery.$and.push({
      $or: [
        { division: { $in: responsibilityCenters } },
        { responsibilityCenter: { $in: responsibilityCenters } }
      ]
    });
  }

  if (preparerScope) {
    const scopeVal = preparerScope.division || preparerScope.department;
    if (scopeVal) {
      npwQuery.$and.push({
        $or: [
          { division: scopeVal },
          { department: scopeVal },
          { responsibilityCenter: scopeVal }
        ]
      });
    }
  }

  const regionFilterDoc = npwQuery.$and.find(cond => cond.hasOwnProperty('region'));
  if (regionFilterDoc && regionFilterDoc.region === null) {
    return { workflowIds: [], proposalIds: [], workflowDocs: [] };
  }

  const workflowDocs = await NewProposalWorkflow.find(npwQuery)
    .select('_id createdBy createdByName workflowHistory')
    .lean();

  const workflowIds = workflowDocs.map((d) => d._id);
  const proposalDocs = await Proposal.find({ proposalId: { $in: workflowIds } }).select('_id').lean();
  const proposalIds = proposalDocs.map((d) => d._id);

  return { workflowIds, proposalIds, workflowDocs };
};

const buildComprehensiveReportData = async ({ regions, fiscalYear, budgetType, preparerScope, groupBy, offices, responsibilityCenters, approverProposalFilter }) => {
  const normalizeList = (value) => {
    const list = Array.isArray(value) ? value : (value ? [value] : []);
    return list
      .map((v) => String(v || '').trim())
      .filter((v) => v && v.toLowerCase() !== 'all');
  };

  const selectedOffices = normalizeList(offices);
  const selectedResponsibilityCenters = normalizeList(responsibilityCenters);

  // For individual reports, prioritize selected filters for header display
  const summaryDepartment =
    groupBy === 'office' && selectedOffices.length > 0
      ? selectedOffices.join(', ')
      : (preparerScope?.department || '');

  const summaryDivision =
    groupBy === 'responsibilityCenter' && selectedResponsibilityCenters.length > 0
      ? selectedResponsibilityCenters.join(', ')
      : (preparerScope?.division || '');

  // Budget Approver: when no proposals passed to them, return empty report (page accessible, data empty)
  const isEmptyApproverScope = approverProposalFilter && !approverProposalFilter.workflowIds?.length && !approverProposalFilter.proposalIds?.length;
  if (isEmptyApproverScope) {
    return {
      summary: {
        reportTitle: 'BUDGET SUMMARY REPORT',
        fiscalYear: fiscalYear || 'All Years',
        budgetType: budgetType || 'All Types',
        regions: regions ? (Array.isArray(regions) ? regions : [regions]) : ['All Regions'],
        generatedDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        totalRegions: 0,
        totalEmployees: 0,
        grandTotal: 0,
        totalIncome: 0,
        totalSubsidy: 0,
        department: summaryDepartment,
        division: summaryDivision,
        approverNoProposals: true, // Budget Approver: no proposals passed to them yet
        eligibleForGeneration: false
      },
      sections: []
    };
  }

  const releasedProposalScope = await getReleasedProposalScopeFilter({
    regions,
    fiscalYear,
    budgetType,
    groupBy,
    offices: selectedOffices,
    responsibilityCenters: selectedResponsibilityCenters,
    preparerScope
  });

  const noReleasedProposalScope = !releasedProposalScope.workflowIds?.length && !releasedProposalScope.proposalIds?.length;
  if (noReleasedProposalScope) {
    return {
      summary: {
        reportTitle: 'BUDGET SUMMARY REPORT',
        fiscalYear: fiscalYear || 'All Years',
        budgetType: budgetType || 'All Types',
        regions: regions ? (Array.isArray(regions) ? regions : [regions]) : ['All Regions'],
        generatedDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        totalRegions: 0,
        totalEmployees: 0,
        grandTotal: 0,
        totalIncome: 0,
        totalSubsidy: 0,
        department: summaryDepartment,
        division: summaryDivision,
        reportLockedUntilSubmission: true,
        eligibleForGeneration: false
      },
      sections: []
    };
  }

  const workflowSignatories = await resolveWorkflowSignatories(releasedProposalScope.workflowDocs);

  // Build base query
  const query = {};
  if (regions) {
    const regionList = Array.isArray(regions) ? regions : [regions];
    query.region = { $in: regionList };
  }
  if (fiscalYear) query.fiscalYear = fiscalYear;
  if (budgetType) query.budgetType = budgetType;

  // View by Office (department) or Responsibility Center (division)
  if (groupBy === 'office' && offices && offices.length > 0) {
    const officeList = Array.isArray(offices) ? offices : [offices];
    query.department = { $in: officeList };
  }
  if (groupBy === 'responsibilityCenter' && responsibilityCenters && responsibilityCenters.length > 0) {
    const rcList = Array.isArray(responsibilityCenters) ? responsibilityCenters : [responsibilityCenters];
    query.division = { $in: rcList };
  }

  // Preparer scope: restrict to Division or Department
  if (preparerScope) {
    const scopeVal = preparerScope.division || preparerScope.department;
    if (scopeVal) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { division: scopeVal },
          { department: scopeVal },
          { responsibilityCenter: scopeVal }
        ]
      });
    }
  }

  // MOOE & Capital Outlay: use same filters as Region view (region, fiscalYear, budgetType only)
  const mooeQuery = {};
  const coQuery = {};
  if (regions) {
    const regionList = Array.isArray(regions) ? regions : [regions];
    const regionExact = { region: { $in: regionList } };
    const regionRegex = regionList.map((r) => ({ region: new RegExp('^' + String(r).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }));
    mooeQuery.$or = [regionExact, ...regionRegex];
    coQuery.$or = [regionExact, ...regionRegex];
  }
  if (fiscalYear) {
    mooeQuery.fiscalYear = fiscalYear;
    const fyNum = Number(fiscalYear);
    const fyOr = [{ fiscalYear: fiscalYear }, ...(Number.isFinite(fyNum) ? [{ fiscal_year: fyNum }] : [])];
    coQuery.$and = [...(coQuery.$and || []), { $or: fyOr }];
  }
  if (budgetType) {
    mooeQuery.budgetType = budgetType;
    coQuery.budgetType = budgetType;
  }

  const scopeFilter = {
    workflowIds: releasedProposalScope.workflowIds,
    proposalIds: releasedProposalScope.proposalIds
  };

  const incomeQuery = applyApproverProposalFilter(applyWorkflowScopeFilter(query, scopeFilter) || query, approverProposalFilter) || (applyWorkflowScopeFilter(query, scopeFilter) || query);
  const psQuery = applyApproverProposalFilter(applyWorkflowScopeFilter(query, scopeFilter) || query, approverProposalFilter) || (applyWorkflowScopeFilter(query, scopeFilter) || query);
  const mooeQueryFinal = applyApproverProposalFilter(applyWorkflowScopeFilter(mooeQuery, scopeFilter) || mooeQuery, approverProposalFilter) || (applyWorkflowScopeFilter(mooeQuery, scopeFilter) || mooeQuery);
  const coQueryFinal = applyApproverProposalFilter(applyWorkflowScopeFilter(coQuery, scopeFilter) || coQuery, approverProposalFilter) || (applyWorkflowScopeFilter(coQuery, scopeFilter) || coQuery);

  // Fetch data from all sources concurrently
  const [incomeData, psData, mooeData, coData] = await Promise.all([
    Income.find(incomeQuery).lean(),
    PersonnelServices.find(psQuery).lean(),
    MooeProposal.find(mooeQueryFinal).lean(),
    CapitalOutlay.find(coQueryFinal).populate('category').lean()
  ]);

  // Initialize comprehensive report structure
  const reportData = {
    summary: {
      reportTitle: "BUDGET SUMMARY REPORT",
      fiscalYear: fiscalYear || "All Years",
      budgetType: budgetType || "All Types",
      regions: regions ? (Array.isArray(regions) ? regions : [regions]) : ["All Regions"],
      generatedDate: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      totalRegions: 0,
      totalEmployees: 0,
      grandTotal: 0,
      totalIncome: 0,
      totalSubsidy: 0,
      department: summaryDepartment,
      division: summaryDivision,
      eligibleForGeneration: true,
      preparedBy: await resolvePreparedByInfo(releasedProposalScope.workflowDocs),
      signatories: workflowSignatories
    },
    sections: []
  };

  const addSectionTotals = (section) => {
    reportData.summary.grandTotal += section.sectionTotal || 0;
    reportData.summary.totalIncome += Number(section.sectionTotalIncome) || 0;
    reportData.summary.totalSubsidy += Number(section.sectionTotalSubsidy) || 0;
  };

  // Process Corporate Income data
  if (Array.isArray(incomeData) && incomeData.length > 0) {
    const incomeSection = await processCorporateIncomeData(incomeData, query);
    reportData.sections.push(incomeSection);
    addSectionTotals(incomeSection);
  }
  // Process Personnel Services data
  if (Array.isArray(psData) && psData.length > 0) {
    const psSection = await processPersonnelServicesData(psData, query);
    reportData.sections.push(psSection);
    reportData.summary.totalEmployees = psSection.totalEmployees;
    addSectionTotals(psSection);
  }
  // Process MOOE data (always include section; show zero/empty when no data)
  const mooeSection = await processMOOEData(Array.isArray(mooeData) ? mooeData : [], query);
  reportData.sections.push(mooeSection);
  addSectionTotals(mooeSection);
  // Process Capital Outlay data (always include section; show zero/empty when no data)
  const coSection = await processCapitalOutlayData(Array.isArray(coData) ? coData : [], query);
  reportData.sections.push(coSection);
  addSectionTotals(coSection);
  // Get unique regions count
  const allRegions = new Set();
  [...incomeData, ...psData, ...mooeData, ...coData].forEach(item => {
    if (item.region) allRegions.add(item.region);
  });
  reportData.summary.totalRegions = allRegions.size;

  // For individual reports, infer missing Department/Division from filtered data
  const isIndividualView = groupBy === 'office' || groupBy === 'responsibilityCenter';
  if (isIndividualView) {
    const allDepartments = new Set();
    const allDivisions = new Set();

    [...incomeData, ...psData, ...mooeData, ...coData].forEach((item) => {
      const dept = String(item?.department || '').trim();
      const div = String(item?.division || '').trim();
      if (dept) allDepartments.add(dept);
      if (div) allDivisions.add(div);
    });

    if (!reportData.summary.department && allDepartments.size === 1) {
      reportData.summary.department = Array.from(allDepartments)[0];
    }
    if (!reportData.summary.division && allDivisions.size === 1) {
      reportData.summary.division = Array.from(allDivisions)[0];
    }
  }

  return reportData;
};

const getComprehensiveReportData = async (req, res) => {
  try {
    const { regions, region, fiscalYear, budgetType, groupBy, offices, responsibilityCenters } = req.query;
    const regionsParam = regions ?? region;
    const officesParam = offices ? (Array.isArray(offices) ? offices : [offices]) : [];
    const responsibilityCentersParam = responsibilityCenters ? (Array.isArray(responsibilityCenters) ? responsibilityCenters : [responsibilityCenters]) : [];
    let preparerScope = null;
    let approverProposalFilter = null;
    const userRoles = req.user?.Roles || [];
    const isPreparer = userRoles.some(r => (r && String(r).replace(/\s+/g, '_')) === 'BUDGET_PREPARER') ||
      userRoles.some(r => (r && String(r).replace(/\s+/g, ' ').trim()) === 'BUDGET PREPARER');

    if (isPreparer && req.user?.id) {
      const userIdString = String(req.user.id);
      const hua = await HierarchicalUserAssignment.findOne({ userId: userIdString, isActive: true })
        .populate('departmentId', 'Department departmentName DepartmentName')
        .lean();
      if (hua) {
        const assignedDepartment = hua.departmentId?.Department || hua.departmentId?.departmentName || hua.departmentId?.DepartmentName || '';
        const assignedDivision = hua.divisionName || '';
        preparerScope = {
          division: assignedDivision,
          department: assignedDepartment,
          assignmentLevel: hua.assignmentLevel || ''
        };
      }
    }

    approverProposalFilter = await getRoleBasedProposalFilterFromRequest(req, regionsParam, fiscalYear, budgetType);

    const reportData = await buildComprehensiveReportData({
      regions: regionsParam,
      fiscalYear,
      budgetType,
      preparerScope,
      groupBy: groupBy || 'region',
      offices: officesParam,
      responsibilityCenters: responsibilityCentersParam,
      approverProposalFilter
    });

    res.status(200).json({
      success: true,
      data: reportData
    });
  } catch (error) {
    console.error('Error generating comprehensive report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate comprehensive report',
      error: error.message
    });
  }
};
// Process Corporate Income data
const processCorporateIncomeData = async (incomeData, query) => {
  const regionSet = new Set();
  let sectionTotal = 0;
  let totalEntries = 0;
  // Check if we should consolidate all regions
  const consolidateRegions = !query.regions || query.regions === 'all';
  if (consolidateRegions) {
    // TRUE Consolidation - sum amounts by category only
    const consolidatedCategories = {};
    incomeData.forEach((income) => {
      regionSet.add(income.region || 'Unspecified');
      totalEntries++;
      const category = income.category || 'Uncategorized';
      if (!consolidatedCategories[category]) {
        consolidatedCategories[category] = {
          name: category,
          total: 0,
          itemCount: 0,
          regions: new Set()
        };
      }
      const amount = Number(income.amount) || 0;
      consolidatedCategories[category].total += amount;
      consolidatedCategories[category].itemCount++;
      consolidatedCategories[category].regions.add(income.region || 'Unspecified');
      sectionTotal += amount;
    });
    // Add totalIncome/totalSubsidy for report columns (A.1 = all income)
    Object.values(consolidatedCategories).forEach(category => {
      category.regions = Array.from(category.regions);
      category.totalIncome = category.total;
      category.totalSubsidy = 0;
    });
    return {
      sectionCode: "A.1",
      sectionName: "CORPORATE INCOME",
      sectionDescription: "Total agency income from various sources and categories",
      sectionTotal,
      sectionTotalIncome: sectionTotal,
      sectionTotalSubsidy: 0,
      totalEntries,
      totalRegions: regionSet.size,
      consolidatedData: true,
      categories: consolidatedCategories
    };
  } else {
    // Group by region (existing logic for specific region)
    const grouped = {};
    incomeData.forEach((income) => {
      const region = income.region || 'Unspecified';
      regionSet.add(region);
      totalEntries++;
      if (!grouped[region]) {
        grouped[region] = {
          region,
          totalEntries: 0,
          categories: {}
        };
      }
      grouped[region].totalEntries++;
      const category = income.category || 'Uncategorized';
      if (!grouped[region].categories[category]) {
        grouped[region].categories[category] = {
          name: category,
          items: [],
          total: 0
        };
      }
      const amount = Number(income.amount) || 0;
      grouped[region].categories[category].items.push({
        particulars: income.particulars,
        subcategory: income.subcategory,
        amount: amount,
        cost: income.cost || 0
      });
      grouped[region].categories[category].total += amount;
      sectionTotal += amount;
    });
    return {
      sectionCode: "A.1",
      sectionName: "CORPORATE INCOME",
      sectionDescription: "Total agency income from various sources and categories",
      sectionTotal,
      sectionTotalIncome: sectionTotal,
      sectionTotalSubsidy: 0,
      totalEntries,
      totalRegions: regionSet.size,
      regions: Object.values(grouped)
    };
  }
};
// Process Personnel Services data
const processPersonnelServicesData = async (psData, query) => {
  const regionSet = new Set();
  let sectionTotal = 0;
  let totalEmployees = 0;
  // Check if we should consolidate all regions
  const consolidateRegions = !query.regions || query.regions === 'all';
  if (consolidateRegions) {
    // Consolidate by categories across all regions (NOT by region)
    const consolidatedCategories = {};
    let sectionTotalIncome = 0;
    let sectionTotalSubsidy = 0;
    psData.forEach((employee) => {
      regionSet.add(employee.region || 'Unspecified');
      totalEmployees++;
      const empTotal = Number(employee.Total) || 0;
      const chargedIncome = Number(employee.chargedToIncomeAmount) || 0;
      const subsidyPortion = Math.max(0, empTotal - chargedIncome);
      const ratioIncome = empTotal > 0 ? chargedIncome / empTotal : 0;
      const ratioSubsidy = empTotal > 0 ? subsidyPortion / empTotal : 1;
      // Process each category in the structure
      Object.entries(PERSONNEL_SERVICES_STRUCTURE["B.1.1"].categories).forEach(([categoryKey, categoryData]) => {
        if (!consolidatedCategories[categoryKey]) {
          consolidatedCategories[categoryKey] = {
            name: categoryData.name,
            items: {},
            total: 0,
            totalIncome: 0,
            totalSubsidy: 0
          };
        }
        const category = consolidatedCategories[categoryKey];
        Object.entries(categoryData.items).forEach(([itemKey, itemData]) => {
          if (!category.items[itemKey]) {
            category.items[itemKey] = {
              name: itemData.name,
              amount: 0,
              income: 0,
              subsidy: 0
            };
          }
          let amount = 0;
          if (itemData.field) {
            const appointmentStatus = String(employee.statusOfAppointment || '').toUpperCase();
            if (categoryKey === '1' && itemKey === 'a') {
              if (appointmentStatus === 'PERMANENT') {
                amount = Number(employee.annualSalary) || 0;
              }
            } else if (categoryKey === '1' && itemKey === 'b') {
              if (appointmentStatus === 'CASUAL') {
                amount = Number(employee.annualSalary) || 0;
              }
            } else {
              if (itemData.field.includes(',')) {
                const fields = itemData.field.split(',');
                amount = fields.reduce((sum, field) => sum + (Number(employee[field.trim()]) || 0), 0);
              } else {
                amount = Number(employee[itemData.field]) || 0;
              }
            }
          }
          category.items[itemKey].amount += amount;
          category.items[itemKey].income += amount * ratioIncome;
          category.items[itemKey].subsidy += amount * ratioSubsidy;
          category.total += amount;
        });
      });
      sectionTotal += empTotal;
      sectionTotalIncome += chargedIncome;
      sectionTotalSubsidy += subsidyPortion;
    });
    // Derive category totalIncome/totalSubsidy from items
    Object.values(consolidatedCategories).forEach(cat => {
      cat.totalIncome = Object.values(cat.items).reduce((s, item) => s + (Number(item.income) || 0), 0);
      cat.totalSubsidy = Object.values(cat.items).reduce((s, item) => s + (Number(item.subsidy) || 0), 0);
    });
    // Recompute section totals from categories so displayed total matches sum of rows (no inconsistency)
    sectionTotal = Object.values(consolidatedCategories).reduce((s, c) => s + (Number(c.total) || 0), 0);
    sectionTotalIncome = Object.values(consolidatedCategories).reduce((s, c) => s + (Number(c.totalIncome) || 0), 0);
    sectionTotalSubsidy = Object.values(consolidatedCategories).reduce((s, c) => s + (Number(c.totalSubsidy) || 0), 0);
    return {
      sectionCode: "B.1.1",
      sectionName: "Personnel Services",
      sectionDescription: "Personnel-related expenditures including salaries, allowances, and benefits",
      sectionTotal,
      sectionTotalIncome,
      sectionTotalSubsidy,
      totalEmployees,
      totalRegions: regionSet.size,
      consolidatedData: true,
      categories: consolidatedCategories
    };
  } else {
    // Group by region (existing logic for specific region)
    const grouped = {};
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
            total: 0
          };
        }
        const category = grouped[region].categories[categoryKey];
        // Process each item in the category
        Object.entries(categoryData.items).forEach(([itemKey, itemData]) => {
          if (!category.items[itemKey]) {
            category.items[itemKey] = {
              name: itemData.name,
              amount: 0
            };
          }
          // Calculate amount based on field mapping
          let amount = 0;
          if (itemData.field) {
            // Special handling for Salaries and Wages based on statusOfAppointment
            if (categoryKey === '1' && itemKey === 'a') {
              // Salaries - Regular (Authorized Positions) = Permanent only
              if (employee.statusOfAppointment === 'PERMANENT') {
                amount = Number(employee.annualSalary) || 0;
              }
            } else if (categoryKey === '1' && itemKey === 'b') {
              // Casual Personnel = Casual only
              if (employee.statusOfAppointment === 'CASUAL') {
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
        });
      });
      // Calculate employee total
      const employeeTotal = Number(employee.Total) || 0;
      sectionTotal += employeeTotal;
    });
    return {
      sectionCode: "B.1.1",
      sectionName: "Personnel Services",
      sectionDescription: "Personnel-related expenditures including salaries, allowances, and benefits",
      sectionTotal,
      totalEmployees,
      totalRegions: regionSet.size,
      regions: Object.values(grouped)
    };
  }
};
// Process MOOE data
const processMOOEData = async (mooeData, query) => {
  const regionSet = new Set();
  let sectionTotal = 0;
  let totalEntries = 0;
  // When no data, always return consolidated shape so UI always shows MOOE section with table
  const hasData = Array.isArray(mooeData) && mooeData.length > 0;
  if (!hasData) {
    return {
      sectionCode: "B.1.2",
      sectionName: "MAINTENANCE AND OTHER OPERATING EXPENSES",
      sectionDescription: "Operating expenses for maintenance and other operational requirements",
      sectionTotal: 0,
      sectionTotalIncome: 0,
      sectionTotalSubsidy: 0,
      totalEntries: 0,
      totalRegions: 0,
      consolidatedData: true,
      categories: {}
    };
  }
  // Check if we should consolidate all regions
  const consolidateRegions = !query.regions || query.regions === 'all';
  if (consolidateRegions) {
    // TRUE Consolidation - sum amounts by category only; exclude 0 value (only include amount > 0)
    const consolidatedCategories = {};
    mooeData.forEach((proposal) => {
      const income = Number(proposal.income) || 0;
      const subsidy = Number(proposal.subsidy) || 0;
      let amount = income + subsidy;
      if (amount <= 0) amount = Number(proposal.amount) || 0;
      if (amount <= 0) return;
      regionSet.add(proposal.region || 'Unspecified');
      totalEntries++;
      const category = proposal.accountingTitle || 'Uncategorized';
      if (!consolidatedCategories[category]) {
        consolidatedCategories[category] = {
          name: category,
          total: 0,
          totalIncome: 0,
          totalSubsidy: 0,
          itemCount: 0,
          regions: new Set(),
          items: []
        };
      }
      consolidatedCategories[category].total += amount;
      consolidatedCategories[category].totalIncome += income;
      consolidatedCategories[category].totalSubsidy += subsidy;
      consolidatedCategories[category].itemCount++;
      consolidatedCategories[category].regions.add(proposal.region || 'Unspecified');
      consolidatedCategories[category].items.push({
        name: proposal.sublineItem || proposal.accountingTitle || 'N/A',
        title: proposal.sublineItem || proposal.accountingTitle || 'N/A',
        uacsCode: proposal.uacsCode,
        income,
        subsidy,
        amount
      });
      sectionTotal += amount;
    });
    // Remove categories with total 0
    Object.keys(consolidatedCategories).forEach(key => {
      if (consolidatedCategories[key].total === 0) delete consolidatedCategories[key];
    });
    // Convert Set to Array for JSON serialization
    Object.values(consolidatedCategories).forEach(cat => {
      cat.regions = Array.from(cat.regions);
    });
    const sectionTotalIncome = Object.values(consolidatedCategories).reduce((s, c) => s + (Number(c.totalIncome) || 0), 0);
    const sectionTotalSubsidy = Object.values(consolidatedCategories).reduce((s, c) => s + (Number(c.totalSubsidy) || 0), 0);
    return {
      sectionCode: "B.1.2",
      sectionName: "MAINTENANCE AND OTHER OPERATING EXPENSES",
      sectionDescription: "Operating expenses for maintenance and other operational requirements",
      sectionTotal,
      sectionTotalIncome,
      sectionTotalSubsidy,
      totalEntries,
      totalRegions: regionSet.size,
      consolidatedData: true,
      categories: consolidatedCategories
    };
  } else {
    // Group by region (existing logic for specific region); exclude 0 value
    const grouped = {};
    mooeData.forEach((proposal) => {
      const income = Number(proposal.income) || 0;
      const subsidy = Number(proposal.subsidy) || 0;
      let amount = income + subsidy;
      if (amount <= 0) amount = Number(proposal.amount) || 0;
      if (amount <= 0) return;
      const region = proposal.region || 'Unspecified';
      regionSet.add(region);
      totalEntries++;
      if (!grouped[region]) {
        grouped[region] = {
          region,
          totalEntries: 0,
          categories: {}
        };
      }
      grouped[region].totalEntries++;
      const category = proposal.accountingTitle || 'Uncategorized';
      if (!grouped[region].categories[category]) {
        grouped[region].categories[category] = {
          name: category,
          items: [],
          total: 0
        };
      }
      grouped[region].categories[category].items.push({
        title: proposal.sublineItem || proposal.accountingTitle || 'N/A',
        uacsCode: proposal.uacsCode,
        income: income,
        subsidy: subsidy,
        amount: amount
      });
      grouped[region].categories[category].total += amount;
      sectionTotal += amount;
    });
    return {
      sectionCode: "B.1.2",
      sectionName: "MAINTENANCE AND OTHER OPERATING EXPENSES",
      sectionDescription: "Operating expenses for maintenance and other operational requirements",
      sectionTotal,
      totalEntries,
      totalRegions: regionSet.size,
      regions: Object.values(grouped)
    };
  }
};
// Process Capital Outlay data
const processCapitalOutlayData = async (coData, query) => {
  const regionSet = new Set();
  let sectionTotal = 0;
  let totalEntries = 0;
  // When no data, always return consolidated shape so UI always shows Capital Outlay section with table
  const hasData = Array.isArray(coData) && coData.length > 0;
  if (!hasData) {
    return {
      sectionCode: "B.2",
      sectionName: "CAPITAL OUTLAYS",
      sectionDescription: "Capital expenditures for infrastructure, equipment, and other capital investments",
      sectionTotal: 0,
      sectionTotalIncome: 0,
      sectionTotalSubsidy: 0,
      totalEntries: 0,
      totalRegions: 0,
      consolidatedData: true,
      categories: {}
    };
  }
  // Fetch breakdown details (CapitalOutlayDetails) so report shows each row as created, not lumped
  const coIds = coData.map((p) => p._id).filter(Boolean);
  const detailsList = coIds.length > 0
    ? await CapitalOutlayDetails.find({ capital_outlay_id: { $in: coIds } }).sort({ createdAt: 1 }).lean()
    : [];
  const detailsByParent = new Map();
  detailsList.forEach((d) => {
    const id = (d.capital_outlay_id && d.capital_outlay_id.toString()) || d.capital_outlay_id;
    if (!id) return;
    if (!detailsByParent.has(id)) detailsByParent.set(id, []);
    detailsByParent.get(id).push(d);
  });

  // Check if we should consolidate all regions
  const consolidateRegions = !query.regions || query.regions === 'all';
  if (consolidateRegions) {
    // TRUE Consolidation - sum amounts by category; use breakdown rows (CapitalOutlayDetails) when present
    const consolidatedCategories = {};
    coData.forEach((proposal) => {
      const categoryName = proposal.category?.name || proposal.accountingTitle || 'Uncategorized';
      const detailRows = detailsByParent.get(proposal._id.toString()) || [];

      if (detailRows.length > 0) {
        detailRows.forEach((detail) => {
          const income = Number(detail.income_amount) || 0;
          const subsidy = Number(detail.subsidy_amount) || 0;
          const amount = income + subsidy;
          if (amount <= 0) return;
          regionSet.add(proposal.region || 'Unspecified');
          totalEntries++;
          if (!consolidatedCategories[categoryName]) {
            consolidatedCategories[categoryName] = {
              name: categoryName,
              total: 0,
              totalIncome: 0,
              totalSubsidy: 0,
              itemCount: 0,
              regions: new Set(),
              items: []
            };
          }
          consolidatedCategories[categoryName].total += amount;
          consolidatedCategories[categoryName].totalIncome += income;
          consolidatedCategories[categoryName].totalSubsidy += subsidy;
          consolidatedCategories[categoryName].itemCount++;
          consolidatedCategories[categoryName].regions.add(proposal.region || 'Unspecified');
          consolidatedCategories[categoryName].items.push({
            name: (detail.particulars || '').trim() || 'N/A',
            title: (detail.particulars || '').trim() || 'N/A',
            uacsCode: proposal.uacsCode,
            income,
            subsidy,
            amount
          });
          sectionTotal += amount;
        });
      } else {
        const income = Number(proposal.income) || 0;
        const subsidy = Number(proposal.subsidy) || 0;
        let amount = income + subsidy;
        if (amount <= 0) amount = Number(proposal.cost) || 0;
        if (amount <= 0) return;
        regionSet.add(proposal.region || 'Unspecified');
        totalEntries++;
        if (!consolidatedCategories[categoryName]) {
          consolidatedCategories[categoryName] = {
            name: categoryName,
            total: 0,
            totalIncome: 0,
            totalSubsidy: 0,
            itemCount: 0,
            regions: new Set(),
            items: []
          };
        }
        consolidatedCategories[categoryName].total += amount;
        consolidatedCategories[categoryName].totalIncome += income;
        consolidatedCategories[categoryName].totalSubsidy += subsidy;
        consolidatedCategories[categoryName].itemCount++;
        consolidatedCategories[categoryName].regions.add(proposal.region || 'Unspecified');
        consolidatedCategories[categoryName].items.push({
          name: proposal.particulars || proposal.sublineItem || proposal.accountingTitle || 'N/A',
          title: proposal.particulars || proposal.sublineItem || proposal.accountingTitle || 'N/A',
          uacsCode: proposal.uacsCode,
          income,
          subsidy,
          amount
        });
        sectionTotal += amount;
      }
    });
    // Remove categories with total 0
    Object.keys(consolidatedCategories).forEach(key => {
      if (consolidatedCategories[key].total === 0) delete consolidatedCategories[key];
    });
    Object.values(consolidatedCategories).forEach(cat => {
      cat.regions = Array.from(cat.regions);
    });
    const sectionTotalIncome = Object.values(consolidatedCategories).reduce((s, c) => s + (Number(c.totalIncome) || 0), 0);
    const sectionTotalSubsidy = Object.values(consolidatedCategories).reduce((s, c) => s + (Number(c.totalSubsidy) || 0), 0);
    return {
      sectionCode: "B.2",
      sectionName: "CAPITAL OUTLAYS",
      sectionDescription: "Capital expenditures for infrastructure, equipment, and other capital investments",
      sectionTotal,
      sectionTotalIncome,
      sectionTotalSubsidy,
      totalEntries,
      totalRegions: regionSet.size,
      consolidatedData: true,
      categories: consolidatedCategories
    };
  } else {
    // Group by region; use breakdown rows (CapitalOutlayDetails) when present
    const grouped = {};
    coData.forEach((proposal) => {
      const region = proposal.region || 'Unspecified';
      const categoryName = proposal.category?.name || proposal.accountingTitle || 'Uncategorized';
      const detailRows = detailsByParent.get(proposal._id.toString()) || [];

      if (detailRows.length > 0) {
        detailRows.forEach((detail) => {
          const income = Number(detail.income_amount) || 0;
          const subsidy = Number(detail.subsidy_amount) || 0;
          const amount = income + subsidy;
          if (amount <= 0) return;
          regionSet.add(region);
          totalEntries++;
          if (!grouped[region]) {
            grouped[region] = { region, totalEntries: 0, categories: {} };
          }
          grouped[region].totalEntries++;
          if (!grouped[region].categories[categoryName]) {
            grouped[region].categories[categoryName] = { name: categoryName, items: [], total: 0 };
          }
          grouped[region].categories[categoryName].items.push({
            title: (detail.particulars || '').trim() || 'N/A',
            name: (detail.particulars || '').trim() || 'N/A',
            uacsCode: proposal.uacsCode,
            income,
            subsidy,
            amount
          });
          grouped[region].categories[categoryName].total += amount;
          sectionTotal += amount;
        });
      } else {
        const income = Number(proposal.income) || 0;
        const subsidy = Number(proposal.subsidy) || 0;
        let amount = income + subsidy;
        if (amount <= 0) amount = Number(proposal.cost) || 0;
        if (amount <= 0) return;
        regionSet.add(region);
        totalEntries++;
        if (!grouped[region]) {
          grouped[region] = { region, totalEntries: 0, categories: {} };
        }
        grouped[region].totalEntries++;
        if (!grouped[region].categories[categoryName]) {
          grouped[region].categories[categoryName] = { name: categoryName, items: [], total: 0 };
        }
        grouped[region].categories[categoryName].items.push({
          title: proposal.particulars || proposal.sublineItem || 'N/A',
          name: proposal.particulars || proposal.sublineItem || 'N/A',
          uacsCode: proposal.uacsCode,
          income,
          subsidy,
          amount
        });
        grouped[region].categories[categoryName].total += amount;
        sectionTotal += amount;
      }
    });
    return {
      sectionCode: "B.2",
      sectionName: "CAPITAL OUTLAYS",
      sectionDescription: "Capital expenditures for infrastructure, equipment, and other capital investments",
      sectionTotal,
      totalEntries,
      totalRegions: regionSet.size,
      regions: Object.values(grouped)
    };
  }
};

const getComprehensiveReportPdf = async (req, res) => {
  try {
    if (!MuhammaraRecipe) {
      return res.status(500).json({
        success: false,
        message: 'PDF generation library (muhammara) is not installed on the server.'
      });
    }

    const { regions, region, fiscalYear, budgetType, groupBy, offices, responsibilityCenters } = req.query;
    const requesterId = String(req.user?.id || '').trim();

    if (!requesterId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication is required to generate PDF reports.'
      });
    }

    const regionsParam = regions ?? region;
    const officesParam = offices ? (Array.isArray(offices) ? offices : [offices]) : [];
    const responsibilityCentersParam = responsibilityCenters ? (Array.isArray(responsibilityCenters) ? responsibilityCenters : [responsibilityCenters]) : [];
    let preparerScope = null;
    const userRoles = req.user?.Roles || [];
    const isPreparer = userRoles.some(r => (r && String(r).replace(/\s+/g, '_')) === 'BUDGET_PREPARER') ||
      userRoles.some(r => (r && String(r).replace(/\s+/g, ' ').trim()) === 'BUDGET PREPARER');
    if (isPreparer && req.user?.id) {
      const userIdString = String(req.user.id);
      const hua = await HierarchicalUserAssignment.findOne({ userId: userIdString, isActive: true })
        .populate('departmentId', 'Department departmentName DepartmentName')
        .lean();
      if (hua) {
        preparerScope = {
          division: hua.divisionName || '',
          department: hua.departmentId?.Department || hua.departmentId?.departmentName || hua.departmentId?.DepartmentName || '',
          assignmentLevel: hua.assignmentLevel || ''
        };
      }
    }
    const approverProposalFilter = await getRoleBasedProposalFilterFromRequest(req, regionsParam, fiscalYear, budgetType);
    const reportData = await buildComprehensiveReportData({
      regions: regionsParam,
      fiscalYear,
      budgetType,
      preparerScope,
      groupBy: groupBy || 'region',
      offices: officesParam,
      responsibilityCenters: responsibilityCentersParam,
      approverProposalFilter
    });

    if (reportData?.summary?.eligibleForGeneration === false || reportData?.summary?.reportLockedUntilSubmission) {
      const blockedMessage = reportData?.summary?.approverNoProposals
        ? 'No proposals are currently in your accessible workflow scope for the selected filters.'
        : 'Reports can only be generated after the proposal is submitted at least one workflow step beyond Draft.';
      return res.status(403).json({
        success: false,
        message: blockedMessage
      });
    }

    if (!reportData || !reportData.summary) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate comprehensive report PDF',
        error: 'Report data or summary is missing',
      });
    }

    const generateDocumentId = () => {
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 8);
      return `CR-${timestamp}-${random}`.toUpperCase();
    };
    const documentId = generateDocumentId();

    // Create temp file path for PDF output
    const tmpFilePath = path.join(
      os.tmpdir(),
      `comprehensive_report_${Date.now()}.pdf`
    );
    const tempSignatureImagePaths = [];

    const pdfSecurityEnabled = String(process.env.COMPREHENSIVE_PDF_SECURITY_ENABLED || 'true').toLowerCase() !== 'false';
    const pdfOwnerPassword = process.env.COMPREHENSIVE_PDF_OWNER_PASSWORD || `FMIS-COMP-${String(fiscalYear || 'ALL')}`;
    const pdfUserPassword = process.env.COMPREHENSIVE_PDF_USER_PASSWORD || '';
    const userProtectionFlag = Number(process.env.COMPREHENSIVE_PDF_USER_PROTECTION_FLAG || '0');

    const recipeOptions = {
      version: 1.6,
      author: 'FMIS-BUDGET',
      title: 'Corporate Operating Budget',
      subject: 'Corporate Operating Budget - Annex A',
    };

    if (pdfSecurityEnabled) {
      recipeOptions.userPassword = pdfUserPassword;
      recipeOptions.ownerPassword = pdfOwnerPassword;
      recipeOptions.userProtectionFlag = Number.isFinite(userProtectionFlag) ? userProtectionFlag : 0;
    }

    // Create PDF using Muhammara Recipe — A4 portrait (Annex A format)
    const pdfDoc = new MuhammaraRecipe('new', tmpFilePath, recipeOptions);

    // A4 portrait dimensions in points (1/72 inch)
    const PAGE_WIDTH = 595.28;
    const PAGE_HEIGHT = 841.89;

    // Standard "Narrow" Margin = 0.5 inch = 36 points
    const MARGIN_SIDE = 36;
    const MARGIN_TOP = 36;
    const MARGIN_BOTTOM = 36;

    // Text layout calculations
    const LINE_HEIGHT = 14;
    const CONTENT_LEFT = MARGIN_SIDE;
    const CONTENT_RIGHT = PAGE_WIDTH - MARGIN_SIDE;
    const CENTER_X = PAGE_WIDTH / 2;
    const AMOUNT_COL_X = CONTENT_RIGHT - 10;

    let currentY = MARGIN_TOP;
    let currentPage = 1;
    let isFirstPage = true;

    const textOpt = (opts = {}) => ({ color: '#000000', ...opts });

    const drawBorder = () => {
      pdfDoc.rectangle(MARGIN_SIDE, MARGIN_TOP, PAGE_WIDTH - MARGIN_SIDE * 2, PAGE_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM, {
        stroke: '#4d4c4c',
        lineWidth: 1.5
      });
    };

    const drawFooter = () => {
      pdfDoc.text(`Annex A (Summary)`, CONTENT_LEFT + 10, PAGE_HEIGHT - MARGIN_BOTTOM - 25, textOpt({ fontSize: 8 }));
      pdfDoc.text(`Doc ID: ${documentId}`, CONTENT_LEFT + 10, PAGE_HEIGHT - MARGIN_BOTTOM - 15, textOpt({ fontSize: 8 }));
      pdfDoc.text(`Page ${currentPage}`, CONTENT_RIGHT - 60, PAGE_HEIGHT - MARGIN_BOTTOM - 15, textOpt({ fontSize: 8 }));
    };

    const safeStr = (v) => (v != null && v !== '') ? String(v) : '';
    const requesterLabel = safeStr(req.user?.name || req.user?.UserName || req.user?.FirstName || req.user?.id || 'Authorized User');
    const watermarkText = process.env.COMPREHENSIVE_PDF_WATERMARK_TEXT || `FMIS CONFIDENTIAL • ${requesterLabel}`;
    const drawWatermark = () => {
      const centerX = PAGE_WIDTH / 2;
      const centerY = PAGE_HEIGHT / 2;

      pdfDoc.text(watermarkText, centerX, centerY - 20, textOpt({
        fontSize: 34,
        color: '#d9d9d9',
        align: 'center'
      }));

      pdfDoc.text(`Generated ${new Date().toLocaleString('en-US')}`, centerX, centerY + 18, textOpt({
        fontSize: 14,
        color: '#dddddd',
        align: 'center'
      }));
    };
    const regionsStr = reportData.summary.regions != null
      ? (Array.isArray(reportData.summary.regions) ? reportData.summary.regions.join(', ') : String(reportData.summary.regions))
      : '';

    const resolveExistingPath = (...candidates) => {
      for (const candidate of candidates) {
        if (candidate && fs.existsSync(candidate)) return candidate;
      }
      return null;
    };

    // Resolve logo paths with server + client + cwd fallbacks
    const sealPath = resolveExistingPath(
      path.join(__dirname, '../assets/Seal.png'),
      path.join(__dirname, '../../CLIENT/public/Seal.png'),
      path.join(process.cwd(), 'SERVER/assets/Seal.png'),
      path.join(process.cwd(), 'CLIENT/public/Seal.png')
    );

    const nialogoPath = resolveExistingPath(
      path.join(__dirname, '../assets/logo.png'),
      path.join(__dirname, '../../CLIENT/public/logo.png'),
      path.join(process.cwd(), 'SERVER/assets/logo.png'),
      path.join(process.cwd(), 'CLIENT/public/logo.png')
    );

    const bagongPilipinasPath = resolveExistingPath(
      path.join(__dirname, '../assets/Bagong_Pilipinas.png'),
      path.join(__dirname, '../../CLIENT/public/Bagong_Pilipinas.png'),
      path.join(process.cwd(), 'SERVER/assets/Bagong_Pilipinas.png'),
      path.join(process.cwd(), 'CLIENT/public/Bagong_Pilipinas.png')
    );
    
    const hasSeal = !!sealPath;
    const hasNiaLogo = !!nialogoPath;
    const hasBagong = !!bagongPilipinasPath;

    const drawHeader = (includeTitleSection = false) => {
      // Header section with logos
      const logoY = currentY + 1;
      const logoWidth = 44;
      const logoHeight = 44;
      
      if (hasSeal || hasNiaLogo || hasBagong) {
        // Left side: Seal.png and logo.png side by side
        if (hasSeal) {
          try {
            pdfDoc.image(sealPath, CONTENT_LEFT, logoY, { width: logoWidth, height: logoHeight });
          } catch (e) {
            console.warn('PDF seal logo load failed:', e.message);
          }
        }
        if (hasNiaLogo) {
          try {
            pdfDoc.image(nialogoPath, CONTENT_LEFT + logoWidth + 5, logoY, { width: logoWidth, height: logoHeight });
          } catch (e) {
            console.warn('PDF NIA logo load failed:', e.message);
          }
        }
        // Right side: Bagong_Pilipinas.png
        if (hasBagong) {
          try {
            pdfDoc.image(bagongPilipinasPath, CONTENT_RIGHT - logoWidth, logoY, { width: logoWidth, height: logoHeight });
          } catch (e) {
            console.warn('PDF Bagong Pilipinas logo load failed:', e.message);
          }
        }
      }

      // Header text (centered) - align higher near top section
      const headerTextY = logoY + 8;
      pdfDoc.text('Republic of the Philippines', CENTER_X, headerTextY, textOpt({ fontSize: 9, align: 'center' }));
      
      let headerLineY = headerTextY + LINE_HEIGHT * 0.95;
      pdfDoc.text('OFFICE OF THE PRESIDENT', CENTER_X, headerLineY, textOpt({ fontSize: 9, bold: true, align: 'center' }));
      
      headerLineY += LINE_HEIGHT * 0.95;
      pdfDoc.text('NATIONAL IRRIGATION ADMINISTRATION', CENTER_X, headerLineY, textOpt({ fontSize: 9, bold: true, align: 'center', color: '#292e2a' }));
      
      // Department/Division or Region
      const departmentName = safeStr(reportData.summary.department || '');
      const divisionName = safeStr(reportData.summary.division || '');
      const regionsArray = Array.isArray(reportData.summary.regions) ? reportData.summary.regions : [reportData.summary.regions];
      
      let departmentDivisionText = '';
      if (departmentName && divisionName) {
        departmentDivisionText = `${departmentName} / ${divisionName}`;
      } else if (departmentName) {
        departmentDivisionText = departmentName;
      } else if (divisionName) {
        departmentDivisionText = divisionName;
      } else {
        if (regionsArray.length > 0 && regionsArray[0]) {
          departmentDivisionText = String(regionsArray[0]);
        } else {
          departmentDivisionText = 'OFFICE / DIVISION';
        }
      }
      
      headerLineY += LINE_HEIGHT * 0.95;
      pdfDoc.text(departmentDivisionText, CENTER_X, headerLineY, textOpt({ fontSize: 9, align: 'center' }));
      
      // ANNEX A (place directly below Bagong Pilipinas logo)
      const annexAY = hasBagong ? (logoY + logoHeight + 2) : (logoY + 6);
      pdfDoc.text('ANNEX A', CONTENT_RIGHT - 56, annexAY, textOpt({ fontSize: 11, bold: true }));
      
      // Set currentY below all header text
      currentY = headerLineY + LINE_HEIGHT * 1.1;

      // Title section (only on first page or if explicitly requested)
      if (includeTitleSection) {
        pdfDoc.text('CORPORATE OPERATING BUDGET', CENTER_X, currentY, textOpt({ fontSize: 12, bold: true, align: 'center' }));
        currentY += LINE_HEIGHT * 1.2;
        pdfDoc.text(`FISCAL YEAR ${safeStr(reportData.summary.fiscalYear)}`, CENTER_X, currentY, textOpt({ fontSize: 11, bold: true, align: 'center' }));
        currentY += LINE_HEIGHT * 1.5;
      } else {
        // Continuation page - add simple note
        pdfDoc.text('(Continued)', CENTER_X, currentY, textOpt({ fontSize: 10, italic: true, align: 'center' }));
        currentY += LINE_HEIGHT * 1.5;
      }
    };

    const startNewPage = () => {
      drawFooter();
      pdfDoc.endPage();
      pdfDoc.createPage('A4');
      currentPage++;
      currentY = MARGIN_TOP + 20; // Start content a bit below the top
      drawBorder();
      drawWatermark();
      // No header on continuation pages - header only on first page
    };

    const ensureSpace = (lines = 1) => {
      const spaceNeeded = lines * LINE_HEIGHT;
      if (currentY + spaceNeeded > PAGE_HEIGHT - MARGIN_BOTTOM - 20) {
        startNewPage();
      }
    };

    // First page — A4 portrait with Annex A format
    pdfDoc.createPage('A4');
    drawBorder();
    drawWatermark();
    drawHeader(true); // true = include title section on first page

    // Personnel statistics section - Get actual counts from PersonnelServices
    const totalEmployees = Number(reportData.summary.totalEmployees) || 0;
    
    // Build base query filter
    const baseFilter = {};
    if (regionsParam && regionsParam !== 'all') baseFilter.region = regionsParam;
    if (fiscalYear) baseFilter.fiscalYear = fiscalYear;
    if (budgetType) baseFilter.budgetType = budgetType;

    // Get actual employee counts from database using statusOfAppointment field
    // Non-Casual employees (PERMANENT, etc.)
    const filledPositionCount = await PersonnelServices.countDocuments({ 
      ...baseFilter,
      statusOfAppointment: { $regex: '^PERMANENT$', $options: 'i' }
    });
    
    // Casual employees - search for "CASUAL" (case-insensitive)
    const casualCount = await PersonnelServices.countDocuments({ 
      ...baseFilter,
      statusOfAppointment: { $regex: '^CASUAL$', $options: 'i' }
    });
    
    // COS (Contract of Service) employees - query from COSPersonnel table
    const cosCount = await COSPersonnel.countDocuments({ 
      ...baseFilter
    });

    // VACANT positions - search in employeeFullName field for "VACANT"
    const vacantCount = await PersonnelServices.countDocuments({ 
      ...baseFilter,
      employeeFullName: { $regex: 'VACANT|To-Be-Filled', $options: 'i' }
    });

    const filledPositions = filledPositionCount > 0 ? filledPositionCount : 0;
    const toBeFilledPositions = vacantCount > 0 ? vacantCount : 0;
    const casualEmployees = casualCount > 0 ? casualCount : 0;
    const cosPersonnel = cosCount > 0 ? cosCount : 0;

    pdfDoc
      .text(`No. of  Monthly Personnel Per Approved Staffing Pattern`, CONTENT_LEFT + 10, currentY, textOpt({ fontSize: 9 }))
      .text(`${totalEmployees}`, AMOUNT_COL_X, currentY, textOpt({ fontSize: 9, align: 'right' }));
    currentY += LINE_HEIGHT * 0.75;
    pdfDoc
      .text(`No. of  Monthly Positions Filled Up`, CONTENT_LEFT + 10, currentY, textOpt({ fontSize: 9 }))
      .text(`${filledPositions}`, AMOUNT_COL_X, currentY, textOpt({ fontSize: 9, align: 'right' }));
    currentY += LINE_HEIGHT * 0.75;
    pdfDoc
      .text(`No. of  Monthly Positions To Be Filled Up`, CONTENT_LEFT + 10, currentY, textOpt({ fontSize: 9 }))
      .text(`${toBeFilledPositions}`, AMOUNT_COL_X, currentY, textOpt({ fontSize: 9, align: 'right' }));
    currentY += LINE_HEIGHT * 0.75;
    pdfDoc
      .text(`No. of  Appointive Casual Employees`, CONTENT_LEFT + 10, currentY, textOpt({ fontSize: 9 }))
      .text(`${casualEmployees}`, AMOUNT_COL_X, currentY, textOpt({ fontSize: 9, align: 'right' }));
    currentY += LINE_HEIGHT * 0.75;
    pdfDoc
      .text(`No. of  COS (Contract of Service) Personnel`, CONTENT_LEFT + 10, currentY, textOpt({ fontSize: 9 }))
      .text(`${cosPersonnel}`, AMOUNT_COL_X, currentY, textOpt({ fontSize: 9, align: 'right' }));
    currentY += LINE_HEIGHT * 1.2;

    // USES OF FUNDS section header
    ensureSpace(3);
    pdfDoc.text('USES OF FUNDS', CONTENT_LEFT + 10, currentY, textOpt({ fontSize: 10, bold: true, underline: true }));
    currentY += LINE_HEIGHT * 1;

    // Render sections with Annex-style hierarchy
    const formatPhp = (amount) =>
      Number(amount || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 });

    const sectionLabelMap = {
      'B.1.1': 'PERSONNEL SERVICES - REGULAR',
      'B.1.2': 'MAINTENANCE AND OTHER OPERATING EXPENDITURES',
      'B.2': 'CAPITAL OUTLAY (ANNEX E)',
    }; 

    const sectionTotalLabelMap = {
      'B.1.1': 'TOTAL PERSONNEL SERVICES (Annex B + Annex C)',
      'B.1.2': 'TOTAL MAINTENANCE & OTHER OPERATING EXPENDITURES',
      'B.2': 'TOTAL CAPITAL OUTLAY',
    };

    const usesOfFundsSections = (Array.isArray(reportData.sections) ? reportData.sections : [])
      .filter((section) => String(section?.sectionCode || '').startsWith('B'));
    const sectionsToRender = usesOfFundsSections.length > 0
      ? usesOfFundsSections
      : (Array.isArray(reportData.sections) ? reportData.sections : []);

    let sectionNumber = 1;
    let grandTotalAmount = 0;

    sectionsToRender.forEach((section) => {
      if (!section.categories) return;

      ensureSpace(4); // Ensure space for section header

      const sectionTotal = Number(section.sectionTotal) || 0;
      grandTotalAmount += sectionTotal;
      const sectionDisplayName = sectionLabelMap[section.sectionCode] || `${section.sectionName || ''}`.toUpperCase();
      const sectionTotalLabel = sectionTotalLabelMap[section.sectionCode] || `TOTAL ${section.sectionName?.toUpperCase() || 'SECTION'}`;

      // Main section header
      pdfDoc
        .text(`${sectionNumber}`, CONTENT_LEFT + 10, currentY, textOpt({ fontSize: 11, bold: true }))
        .text(
          sectionDisplayName,
          CONTENT_LEFT + 25, 
          currentY,
          textOpt({ fontSize: 11, bold: true })
        )
        .text(
          formatPhp(sectionTotal),
          AMOUNT_COL_X,
          currentY,
          textOpt({ fontSize: 11, bold: true, align: 'right' })
        );
      currentY += LINE_HEIGHT * 0.95;

      // Render categories and sub-items
      const categoryEntries = Object.entries(section.categories || {});
      
      categoryEntries.forEach(([, category], idx) => {
        ensureSpace(2); // Ensure space for category line

        const categoryAmount = Number(
          category.total ?? category.totalSubsidy ?? category.totalIncome
        ) || 0;

        pdfDoc
          .text(`${idx + 1}`, CONTENT_LEFT + 10, currentY, textOpt({ fontSize: 9, bold: true }))
          .text(String(category.name || ''), CONTENT_LEFT + 30, currentY, textOpt({ fontSize: 9, bold: true }))
          .text(formatPhp(categoryAmount), AMOUNT_COL_X, currentY, textOpt({ fontSize: 9, bold: true, align: 'right' }));
        currentY += LINE_HEIGHT * 0.78;

        const itemEntries = Array.isArray(category.items)
          ? category.items.map((item, itemIdx) => [String.fromCharCode(97 + (itemIdx % 26)), item])
          : Object.entries(category.items || {});

        itemEntries.forEach(([itemKey, item], itemIdx) => {
          ensureSpace(1); // Ensure space for sub-item

          const letter = /^[a-z]$/i.test(String(itemKey || ''))
            ? String(itemKey).toLowerCase()
            : String.fromCharCode(97 + (itemIdx % 26));
          const itemAmount = Number(item?.amount ?? item?.subsidy ?? item?.income) || 0;
          const itemName = String(item?.name || item?.title || '').trim();

          if (itemName || itemAmount > 0) {
            pdfDoc
              .text(`${letter}.`, CONTENT_LEFT + 45, currentY, textOpt({ fontSize: 8 }))
              .text(itemName || '—', CONTENT_LEFT + 58, currentY, textOpt({ fontSize: 8 }))
              .text(formatPhp(itemAmount), AMOUNT_COL_X, currentY, textOpt({ fontSize: 8, align: 'right' }));
            currentY += LINE_HEIGHT * 0.68;
          }
        });
      });

      // Section total line
      pdfDoc.rectangle(CONTENT_LEFT + 8, currentY - 3, CONTENT_RIGHT - CONTENT_LEFT - 16, 0.5, {
        stroke: '#000000',
        lineWidth: 0.5
      });
      currentY += LINE_HEIGHT * 0.45;

      pdfDoc
        .text(`${sectionTotalLabel}`, CONTENT_LEFT + 10, currentY, textOpt({ fontSize: 10, bold: true }))
        .text(
          formatPhp(sectionTotal),
          AMOUNT_COL_X,
          currentY,
          textOpt({ fontSize: 10, bold: true, align: 'right' })
        );
      currentY += LINE_HEIGHT * 1.15;

      sectionNumber++;
    });

    // Grand total at bottom with line above
    if (currentY > PAGE_HEIGHT - MARGIN_BOTTOM - 30) {
      startNewPage();
    }
    pdfDoc.rectangle(CONTENT_LEFT + 10, currentY - 3, CONTENT_RIGHT - CONTENT_LEFT - 20, 0.5, {
      stroke: '#000000',
      lineWidth: 0.5
    });
    currentY += LINE_HEIGHT * 0.8;
    
    pdfDoc
      .text('TOTAL USES OF FUNDS FOR OPERATION', CONTENT_LEFT + 10, currentY, textOpt({ fontSize: 12, bold: true }))
      .text(
        grandTotalAmount.toLocaleString('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }),
        AMOUNT_COL_X,
        currentY,
        textOpt({ fontSize: 12, bold: true, align: 'right' })
      );
    currentY += LINE_HEIGHT * 2;

    // Check if NET INCOME FROM OPERATION section fits on current page (needs only line + underline area)
    if (currentY + (LINE_HEIGHT * 3) > PAGE_HEIGHT - MARGIN_BOTTOM - 20) {
      // Not enough space, create new page without header (just border)
      drawFooter();
      pdfDoc.endPage();
      pdfDoc.createPage('A4');
      currentPage++;
      currentY = MARGIN_TOP + 20;
      drawBorder();
      drawWatermark();
    }

    // NET INCOME FROM OPERATION
    pdfDoc
      .text('NET INCOME FROM OPERATION', CONTENT_LEFT + 10, currentY, textOpt({ fontSize: 12, bold: true }))
      .text(
        grandTotalAmount.toLocaleString('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }),
        AMOUNT_COL_X,
        currentY,
        textOpt({ fontSize: 12, bold: true, align: 'right' })
      );
    
    pdfDoc.rectangle(CONTENT_LEFT + 10, currentY + 10, CONTENT_RIGHT - CONTENT_LEFT - 20, 0.5, {
      stroke: '#000000',
      lineWidth: 0.5
    });
    currentY += LINE_HEIGHT * 4;

    // Check if signature blocks fit on current page (needs ~280 points)
    if (currentY + 280 > PAGE_HEIGHT - MARGIN_BOTTOM - 20) {
      // Not enough space, create new page without header for signatures
      drawFooter();
      pdfDoc.endPage();
      pdfDoc.createPage('A4');
      currentPage++;
      currentY = MARGIN_TOP + 40;
      drawBorder();
      drawWatermark();
    }

    // Signature blocks
    const sigY = currentY + 50;
    const preparedByInfo = reportData?.summary?.preparedBy || null;
    const preparedByName = preparedByInfo?.name || 'Budget Preparer';
    const preparedByDesignation = preparedByInfo?.position || 'Budget Preparer';
    const preparedByUserId = preparedByInfo?.userId || '';
    
    const preparedBySignatureLine = preparedByInfo?.hasDigitalSignature
      ? `E-signature: ${preparedByInfo.signatureAlgorithm || 'Digitally Signed'}${preparedByInfo?.signedAt ? ` • ${new Date(preparedByInfo.signedAt).toLocaleString('en-US')}` : ''}`
      : 'E-signature: Not available';
    const preparedByAuthLine = preparedByUserId
      ? `Authentication: Verified User ID ${preparedByUserId}`
      : 'Authentication: Verified Budget Preparer account';
    
    const signatories = Array.isArray(reportData?.summary?.signatories) ? reportData.summary.signatories : [];
    const normalizeRoleKey = (value) => String(value || '').replace(/\s+/g, '_').toUpperCase();
    const reviewerSignatory = signatories.find((item) => normalizeRoleKey(item?.workflowRole) === 'BUDGET_REVIEWER');
    const approverSignatory = signatories.find((item) => normalizeRoleKey(item?.workflowRole) === 'BUDGET_APPROVER' || normalizeRoleKey(item?.workflowRole) === 'APPROVER');

    const sigWidth = 140;
    const sigSpacing = (PAGE_WIDTH - (MARGIN_SIDE * 2) - (sigWidth * 3)) / 2;
    const sig1X = CONTENT_LEFT;
    const sig2X = sig1X + sigWidth + sigSpacing;
    const sig3X = sig2X + sigWidth + sigSpacing;

    pdfDoc.text('Prepared by:', sig1X, currentY, textOpt({ fontSize: 8 }));
    pdfDoc.text('Noted by:', sig2X, currentY, textOpt({ fontSize: 8 }));
    pdfDoc.text('Approved by:', sig3X, currentY, textOpt({ fontSize: 8 }));

    pdfDoc.text('_____________________________', sig1X, sigY, textOpt({ fontSize: 9 }));
    pdfDoc.text('_____________________________', sig2X, sigY, textOpt({ fontSize: 9 }));
    pdfDoc.text('_____________________________', sig3X, sigY, textOpt({ fontSize: 9 }));

    // Prepared by Block (No visual signature, just text)
    pdfDoc.text(preparedByName, sig1X, sigY + LINE_HEIGHT, textOpt({ fontSize: 9, bold: true }));
    pdfDoc.text(preparedByDesignation, sig1X, sigY + LINE_HEIGHT * 2, textOpt({ fontSize: 8 }));

    // Render Reviewer (Noted by) Block (No visual signature, just text)
    if (reviewerSignatory) {
      const reviewerName = reviewerSignatory?.fullName || 'Budget Reviewer';
      const reviewerDesignation = reviewerSignatory?.position || 'Budget Reviewer';

      pdfDoc.text(reviewerName, sig2X, sigY + LINE_HEIGHT, textOpt({ fontSize: 9, bold: true }));
      pdfDoc.text(reviewerDesignation, sig2X, sigY + LINE_HEIGHT * 2, textOpt({ fontSize: 8 }));
    } else {
      pdfDoc.text('Budget Reviewer', sig2X, sigY + LINE_HEIGHT * 2, textOpt({ fontSize: 8 }));
    }

    // Render Approver (Approved by) Block (No visual signature, just text)
    if (approverSignatory) {
      const approverName = approverSignatory?.fullName || 'Budget Approver';
      const approverDesignation = approverSignatory?.position || 'Budget Approver';

      pdfDoc.text(approverName, sig3X, sigY + LINE_HEIGHT, textOpt({ fontSize: 9, bold: true }));
      pdfDoc.text(approverDesignation, sig3X, sigY + LINE_HEIGHT * 2, textOpt({ fontSize: 8 }));
    } else {
      pdfDoc.text('Budget Approver', sig3X, sigY + LINE_HEIGHT * 2, textOpt({ fontSize: 8 }));
    }

    currentY = sigY + LINE_HEIGHT * 5;

    if (signatories.length > 0) {
      // Fetch QR Code
      let qrImagePath = null;
      const docId = reportData?.summary?.documentId || reportData?.documentId || `COMP-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`.toUpperCase();
      reportData.summary.documentId = docId; // ensure it's saved in the object

      try {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5005';
        const verifyUrl = `${frontendUrl}/verify-document?id=${docId}`;
        
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verifyUrl)}`;
        qrImagePath = path.join(os.tmpdir(), `qr_${Date.now()}.png`);
        
        await new Promise((resolve, reject) => {
          require('https').get(qrUrl, (response) => {
            if (response.statusCode === 200) {
              const file = fs.createWriteStream(qrImagePath);
              response.pipe(file);
              file.on('finish', () => { file.close(); resolve(); });
            } else {
              reject(new Error(`Failed to fetch QR: ${response.statusCode}`));
            }
          }).on('error', reject);
        });
        tempSignatureImagePaths.push(qrImagePath);
      } catch (err) {
        console.warn('Failed to generate QR code:', err.message);
        qrImagePath = null;
      }

      const neededHeight = Math.max((signatories.length + 1.5) * LINE_HEIGHT + 10, 70);
      if (currentY + neededHeight > PAGE_HEIGHT - MARGIN_BOTTOM - 20) {
        startNewPage();
      }

      const boxTop = currentY;
      pdfDoc.rectangle(CONTENT_LEFT + 10, boxTop, CONTENT_RIGHT - CONTENT_LEFT - 20, neededHeight, {
        stroke: '#888888',
        lineWidth: 0.5,
        fill: '#fcfcfc'
      });
      
      if (qrImagePath) {
        pdfDoc.image(qrImagePath, CONTENT_LEFT + 20, boxTop + 5, { width: 60, height: 60, keepAspectRatio: true });
      }

      const textStartX = qrImagePath ? CONTENT_LEFT + 95 : CONTENT_LEFT + 20;
      currentY = boxTop + 10;

      pdfDoc.text('Workflow Digital Signatures Audit:', textStartX, currentY, textOpt({ fontSize: 8, bold: true, color: '#333333' }));
      currentY += LINE_HEIGHT;
      pdfDoc.text(`Document ID: ${docId}`, textStartX, currentY, textOpt({ fontSize: 8, bold: true, color: '#2a52be' }));
      currentY += LINE_HEIGHT;

      signatories.forEach((signatory, index) => {
        const roleLabel = roleToPositionLabel(signatory.workflowRole || '');
        const signedDate = signatory?.signedAt ? new Date(signatory.signedAt).toLocaleString('en-US') : 'N/A';
        const name = signatory.fullName || 'Unknown Signatory';
        const verifyStatus = signatory?.verificationStatus || 'Unverifiable';
        
        pdfDoc.text(`${index + 1}. ${name} (${signatory.position || roleLabel})`, textStartX, currentY, textOpt({ fontSize: 7, bold: true }));
        pdfDoc.text(`Date: ${signedDate}   |   Status: ${verifyStatus}`, textStartX + 200, currentY, textOpt({ fontSize: 7, color: '#444444' }));
        
        currentY += LINE_HEIGHT;
      });
      
      currentY = boxTop + neededHeight + LINE_HEIGHT;
    }
    
    // Final page footer
    drawFooter();

    // Close last page and finalize PDF, then stream file to response
    pdfDoc.endPage().endPDF(async (err) => {
      if (err) {
        console.error('Error finalizing PDF:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to generate comprehensive report PDF',
          error: err.message || String(err),
        });
      }
      
      // Calculate file hash and save audit log
      try {
        let fileHash = null;
        if (fs.existsSync(tmpFilePath)) {
          const crypto = require('crypto');
          const fileBuffer = fs.readFileSync(tmpFilePath);
          const hashSum = crypto.createHash('sha256');
          hashSum.update(fileBuffer);
          fileHash = hashSum.digest('hex');
        }

        if (reportData.summary.documentId && signatories.length > 0) {
          await ReportAuditLog.create({
            documentId: reportData.summary.documentId,
            reportType: 'Comprehensive Report',
            fiscalYear: String(reportData.summary.fiscalYear || ''),
            budgetType: String(reportData.summary.budgetType || ''),
            regions: Array.isArray(reportData.summary.regions) ? reportData.summary.regions : [reportData.summary.regions],
            generatedBy: safeStr(req.user?.name || req.user?.UserName || req.user?.FirstName || req.user?.id || 'System'),
            fileHash: fileHash,
            signatories: signatories.map(sig => ({
              fullName: sig.fullName,
              position: sig.position || roleToPositionLabel(sig.workflowRole),
              workflowRole: sig.workflowRole,
              signedAt: sig.signedAt,
              verificationStatus: sig.verificationStatus,
              verificationReason: sig.verificationReason,
              signatureType: sig.signatureType
            }))
          });
        }
      } catch (auditErr) {
        console.error('Failed to save Report Audit Log with file hash:', auditErr);
      }

      if (res.headersSent) return;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `inline; filename=Comprehensive_Report_${String(fiscalYear || 'AllYears')}_${String(budgetType || 'AllTypes')}.pdf`
      );
      res.setHeader('X-Document-ID', documentId);

      const readStream = fs.createReadStream(tmpFilePath);
      readStream.on('error', (streamErr) => {
        console.error('Error streaming comprehensive report PDF:', streamErr);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Failed to stream comprehensive report PDF',
            error: streamErr.message,
          });
        }
      });

      res.on('finish', () => {
        fs.unlink(tmpFilePath, () => {});
        tempSignatureImagePaths.forEach((filePath) => fs.unlink(filePath, () => {}));
      });

      readStream.pipe(res);
    });
  } catch (error) {
    console.error('Error generating comprehensive report PDF:', error);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate comprehensive report PDF',
        error: error.message || String(error),
      });
    }
  }
};
// Get available regions from all data sources
const getAvailableRegionsComprehensive = async (req, res) => {
  try {
    const [incomeRegions, psRegions, mooeRegions, coRegions] = await Promise.all([
      Income.distinct('region'),
      PersonnelServices.distinct('region'),
      MooeProposal.distinct('region'),
      CapitalOutlay.distinct('region')
    ]);
    const allRegions = new Set([...incomeRegions, ...psRegions, ...mooeRegions, ...coRegions]);
    const regions = Array.from(allRegions).filter(region => region && region.trim() !== '');
    res.status(200).json({
      success: true,
      regions: regions.sort()
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
// Get available fiscal years from all data sources
const getAvailableFiscalYears = async (req, res) => {
  try {
    const [settingsFiscalYears, incomeFiscalYears, psFiscalYears, mooeFiscalYears, coFiscalYears] = await Promise.all([
      Settings.distinct('fiscalYear'),
      Income.distinct('fiscalYear'),
      PersonnelServices.distinct('fiscalYear'),
      MooeProposal.distinct('fiscalYear'),
      CapitalOutlay.distinct('fiscalYear')
    ]);
    const allFiscalYears = new Set([...settingsFiscalYears, ...incomeFiscalYears, ...psFiscalYears, ...mooeFiscalYears, ...coFiscalYears]);
    const fiscalYears = Array.from(allFiscalYears).filter(year => year && year.trim() !== '').sort((a, b) => b.localeCompare(a));
    res.status(200).json({
      success: true,
      fiscalYears: fiscalYears
    });
  } catch (error) {
    console.error('Error fetching available fiscal years:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available fiscal years',
      error: error.message
    });
  }
};
// Get available budget types from all data sources
const getAvailableBudgetTypes = async (req, res) => {
  try {
    const [settingsBudgetTypes, incomeBudgetTypes, psBudgetTypes, mooeBudgetTypes, coBudgetTypes] = await Promise.all([
      Settings.distinct('budgetType'),
      Income.distinct('budgetType'),
      PersonnelServices.distinct('budgetType'),
      MooeProposal.distinct('budgetType'),
      CapitalOutlay.distinct('budgetType')
    ]);
    const allBudgetTypes = new Set([...settingsBudgetTypes, ...incomeBudgetTypes, ...psBudgetTypes, ...mooeBudgetTypes, ...coBudgetTypes]);
    const budgetTypes = Array.from(allBudgetTypes).filter(type => type && type.trim() !== '').sort();
    res.status(200).json({
      success: true,
      budgetTypes: budgetTypes
    });
  } catch (error) {
    console.error('Error fetching available budget types:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available budget types',
      error: error.message
    });
  }
};
// Get active settings
const getActiveSettings = async (req, res) => {
  try {
    const activeSettings = await Settings.findOne({ isActive: true });
    res.status(200).json({
      success: true,
      settings: activeSettings
    });
  } catch (error) {
    console.error('Error fetching active settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active settings',
      error: error.message
    });
  }
};

const getAvailableOfficesComprehensive = async (req, res) => {
  try {
    const { region, fiscalYear } = req.query;
    const baseQuery = {};
    if (region && region !== 'all') baseQuery.region = region;
    if (fiscalYear) baseQuery.fiscalYear = fiscalYear;
    const [incomeDepts, psDepts, mooeDepts, coDepts] = await Promise.all([
      Income.distinct('department', baseQuery),
      PersonnelServices.distinct('department', baseQuery),
      MooeProposal.distinct('department', baseQuery),
      CapitalOutlay.distinct('department', baseQuery)
    ]);
    const all = new Set([...incomeDepts, ...psDepts, ...mooeDepts, ...coDepts]);
    const offices = Array.from(all).filter(Boolean).map(String).filter(s => s.trim() !== '').sort();
    res.status(200).json({ success: true, offices });
  } catch (error) {
    console.error('Error fetching available offices:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch available offices', error: error.message });
  }
};

const getAvailableResponsibilityCentersComprehensive = async (req, res) => {
  try {
    const { region, fiscalYear } = req.query;
    const baseQuery = {};
    if (region && region !== 'all') baseQuery.region = region;
    if (fiscalYear) baseQuery.fiscalYear = fiscalYear;
    const [incomeDiv, psDiv, mooeDiv, coDiv] = await Promise.all([
      Income.distinct('division', baseQuery),
      PersonnelServices.distinct('division', baseQuery),
      MooeProposal.distinct('division', baseQuery),
      CapitalOutlay.distinct('division', baseQuery)
    ]);
    const all = new Set([...incomeDiv, ...psDiv, ...mooeDiv, ...coDiv]);
    const responsibilityCenters = Array.from(all).filter(Boolean).map(String).filter(s => s.trim() !== '').sort();
    res.status(200).json({ success: true, responsibilityCenters });
  } catch (error) {
    console.error('Error fetching available responsibility centers:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch responsibility centers', error: error.message });
  }
};

const verifyDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    if (!documentId) {
      return res.status(400).json({ success: false, message: 'Document ID is required' });
    }
    const auditLog = await ReportAuditLog.findOne({ documentId }).lean();
    if (!auditLog) {
      return res.status(404).json({ success: false, message: 'Document not found or invalid' });
    }
    return res.status(200).json({ success: true, auditLog });
  } catch (error) {
    console.error('Error verifying document:', error);
    return res.status(500).json({ success: false, message: 'Server error during verification' });
  }
};

const verifyDocumentUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    // Calculate SHA-256 hash of the uploaded file
    const crypto = require('crypto');
    const hashSum = crypto.createHash('sha256');
    hashSum.update(req.file.buffer);
    const fileHash = hashSum.digest('hex');

    // Find the document in the audit log using the hash
    const auditLog = await ReportAuditLog.findOne({ fileHash }).lean();
    if (!auditLog) {
      return res.status(404).json({ success: false, message: 'Document is altered or invalid. File hash mismatch.' });
    }

    return res.status(200).json({ success: true, auditLog });
  } catch (error) {
    console.error('Error verifying uploaded document:', error);
    return res.status(500).json({ success: false, message: 'Server error during file verification' });
  }
};

module.exports = {
  getComprehensiveReportData,
  getAvailableRegionsComprehensive,
  getAvailableOfficesComprehensive,
  getAvailableResponsibilityCentersComprehensive,
  getAvailableFiscalYears,
  getAvailableBudgetTypes,
  getActiveSettings,
  getComprehensiveReportPdf,
  verifyDocument,
  verifyDocumentUpload
};