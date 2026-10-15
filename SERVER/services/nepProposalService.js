const Income = require('../models/Income');
const PersonnelServices = require('../models/PersonnelServices');
const MooeProposal = require('../models/mooeProposals');
const CapitalOutlay = require('../models/CapitalOutlay');
const CapitalOutlayDetails = require('../models/CapitalOutlayDetails');
const Proposal = require('../models/Proposal');
const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');

const PREPARER_ROLES = [
  'BUDGET_PREPARER',
  'BUDGET PREPARER',
  'divisionCreator',
  'officeCreator',
  'departmentCreator',
  'regionCreator'
];

const NEP_GENERATION_MODES = Object.freeze({
  PREPARER: 'PREPARER',
  BRD: 'BRD'
});

const PERSONNEL_NEP_FIELDS = [
  'annualSalary', 'PERA', 'RATA', 'honoraria', 'uniformALLOWANCE',
  'childrenAllowance', 'medical', 'additionalMedical', 'meal',
  'subsistenceAllowance', 'subsistenceAllowanceMDS', 'subsistenceAllowanceST',
  'loyaltyAward', 'overtimePay', 'productivityIncentive', 'cashGift',
  'midyearBonus', 'yearEndBonus', 'hazardPay', 'retirementBenefits',
  'terminalLeave', 'gsisPremium', 'pagibigPremium', 'philhealthPremium',
  'employeeCompensation', 'providentFund', 'earnedLeaves'
];

const buildPersonnelNepSnapshot = row => {
  const initialValues = {};
  const initialAllocations = {};
  const salaryIncome = Math.min(
    Math.max(0, Number(row?.annualSalary) || 0),
    row?.chargedToIncomeEligible === false
      ? 0
      : Math.max(0, Number(row?.chargedToIncomeAmount) || 0)
  );

  PERSONNEL_NEP_FIELDS.forEach(field => {
    const value = Math.max(0, Number(row?.[field]) || 0);
    const income = field === 'annualSalary' ? salaryIncome : 0;
    initialValues[field] = value;
    initialAllocations[field] = { income, subsidy: Math.max(0, value - income) };
  });

  return {
    nepInitialValues: initialValues,
    nepInitialAllocations: initialAllocations,
    nepAllocations: initialAllocations
  };
};

const normalizeText = value => String(value || '').trim().toUpperCase();

const normalizeNepGenerationMode = value => (
  normalizeText(value) === NEP_GENERATION_MODES.BRD
    ? NEP_GENERATION_MODES.BRD
    : NEP_GENERATION_MODES.PREPARER
);

const buildNepGenerationAssignment = ({ generationMode, preparers = [], brdUser }) => {
  const normalizedMode = normalizeNepGenerationMode(generationMode);

  if (normalizedMode === NEP_GENERATION_MODES.BRD) {
    if (!brdUser?.userId) {
      throw new Error('The BRD user generating the NEP proposal could not be identified');
    }

    return {
      generationMode: normalizedMode,
      editor: brdUser,
      workflowStatus: 'FORWARDED_TO_BRD_ANALYST',
      currentAssigneeRole: 'BUDGET PLANNING ANALYST',
      legacyCurrentAssigneeRole: 'BUDGET_PLANNING_ANALYST',
      legacyStatus: 'Forwarded to Budget Planning Analyst',
      legacyWorkflowLevel: 'BUDGET_PLANNING_ANALYST',
      legacyCurrentStep: 'BUDGET_PLANNING_ANALYST_REVIEW',
      assignedPreparerUserIds: [],
      assignedPreparerNames: []
    };
  }

  const primaryPreparer = preparers[0];
  if (!primaryPreparer?.userId) {
    throw new Error('No Budget Preparer assignment found for this allocation');
  }

  return {
    generationMode: normalizedMode,
    editor: primaryPreparer,
    workflowStatus: 'DRAFT',
    currentAssigneeRole: 'BUDGET PREPARER',
    legacyCurrentAssigneeRole: 'BUDGET PREPARER',
    legacyStatus: 'Draft',
    legacyWorkflowLevel: 'BUDGET PREPARER',
    legacyCurrentStep: 'PREPARER_DRAFT',
    assignedPreparerUserIds: preparers.map(preparer => preparer.userId),
    assignedPreparerNames: preparers.map(preparer => preparer.userName)
  };
};

const uniqueStrings = values => Array.from(
  new Set(values.map(value => String(value || '').trim()).filter(Boolean))
);

const getReferenceValues = (reference, nameFields = []) => {
  if (!reference) return [];
  if (typeof reference !== 'object') return [String(reference)];

  return uniqueStrings([
    reference._id,
    reference.id,
    ...nameFields.map(field => reference[field])
  ]);
};

const assignmentRoles = assignment => uniqueStrings([
  assignment?.userRole,
  ...(assignment?.userRoles || []),
  ...(assignment?.workflowRoles || [])
]);

const isPreparerAssignment = assignment => {
  const allowed = new Set(PREPARER_ROLES.map(normalizeText));
  return assignmentRoles(assignment).some(role => allowed.has(normalizeText(role)));
};

const assignmentMatchesAny = (values, candidates) => {
  const normalizedCandidates = new Set(candidates.map(normalizeText).filter(Boolean));
  return values.some(value => normalizedCandidates.has(normalizeText(value)));
};

const resolvePreparerAssignments = async ({
  initialProposals = [],
  allocation = {},
  ceilingRegion
}) => {
  const sourceCreators = initialProposals
    .map(proposal => ({
      userId: String(proposal?.createdBy || '').trim(),
      userName: String(proposal?.createdByName || '').trim()
    }))
    .filter(candidate => candidate.userId);

  const assignments = await HierarchicalUserAssignment.find({
    isActive: true,
    $or: [
      { userRole: { $in: PREPARER_ROLES } },
      { userRoles: { $in: PREPARER_ROLES } },
      { workflowRoles: { $in: PREPARER_ROLES } }
    ]
  })
    .populate('regionId', 'Region regionName RegionName name')
    .populate('departmentId', 'Department departmentName DepartmentName name')
    .lean();

  const activePreparers = assignments.filter(isPreparerAssignment);
  const allocationDivision = String(allocation.division || '').trim();
  const isConsolidatedAllocation = /\(consolidated\)/i.test(allocationDivision);
  // "<Region> (Consolidated)" is a display/grouping label, not an actual
  // organizational division. Matching it against divisionName would exclude
  // the real Budget Preparers assigned at department or regional level.
  const divisionCandidates = isConsolidatedAllocation
    ? []
    : uniqueStrings([allocationDivision]);
  const departmentCandidates = uniqueStrings([allocation.department]);
  const regionCandidates = uniqueStrings([
    ceilingRegion,
    ...initialProposals.flatMap(proposal => getReferenceValues(
      proposal?.region,
      ['Region', 'regionName', 'RegionName', 'name']
    ))
  ]);

  const scopedAssignments = activePreparers.filter(assignment => {
    const assignmentDivision = uniqueStrings([assignment.divisionName]);
    const assignmentDepartment = getReferenceValues(
      assignment.departmentId,
      ['Department', 'departmentName', 'DepartmentName', 'name']
    );
    const assignmentRegion = getReferenceValues(
      assignment.regionId,
      ['Region', 'regionName', 'RegionName', 'name']
    );

    const divisionMatches =
      !divisionCandidates.length || assignmentMatchesAny(assignmentDivision, divisionCandidates);
    const departmentMatches =
      !departmentCandidates.length || assignmentMatchesAny(assignmentDepartment, departmentCandidates);
    const hasExactDepartmentOrDivisionScope =
      divisionCandidates.length > 0 || departmentCandidates.length > 0;
    // Central-office assignments can legitimately have a null regionId, but
    // only accept that fallback when department/division matched exactly.
    const regionMatches =
      !regionCandidates.length ||
      (!assignmentRegion.length && hasExactDepartmentOrDivisionScope) ||
      assignmentMatchesAny(assignmentRegion, regionCandidates);

    return divisionMatches && departmentMatches && regionMatches;
  });

  const sourceCreatorIds = new Set(sourceCreators.map(candidate => candidate.userId));
  const prioritizedAssignments = [...scopedAssignments].sort((left, right) => {
    const leftIsSource = sourceCreatorIds.has(String(left.userId));
    const rightIsSource = sourceCreatorIds.has(String(right.userId));
    if (leftIsSource !== rightIsSource) return leftIsSource ? -1 : 1;
    return String(left.userName || left.userId).localeCompare(String(right.userName || right.userId));
  });

  const resolved = prioritizedAssignments.map(assignment => ({
    userId: String(assignment.userId),
    userName: String(assignment.userName || assignment.userId)
  }));

  // Older installations can have valid source ownership without a migrated
  // HierarchicalUserAssignment. Preserve that owner as a safe fallback.
  if (!resolved.length) {
    resolved.push(...sourceCreators);
  }

  const uniqueByUserId = Array.from(
    new Map(resolved.map(candidate => [candidate.userId, candidate])).values()
  );

  if (!uniqueByUserId.length) {
    throw new Error(
      `No Budget Preparer assignment found for ${allocation.division || allocation.department || 'allocation'}`
    );
  }

  return uniqueByUserId;
};

const buildSourceLineQuery = async initialProposals => {
  const workflowIds = initialProposals.map(proposal => proposal._id).filter(Boolean);
  const legacyProposals = workflowIds.length
    ? await Proposal.find({
      $or: [
        { workflowRef: { $in: workflowIds } },
        { proposalId: { $in: workflowIds } }
      ]
    }).select('_id workflowRef proposalId').lean()
    : [];
  const legacyIds = legacyProposals.map(proposal => proposal._id);

  const orConditions = [];
  if (workflowIds.length) orConditions.push({ workflowRef: { $in: workflowIds } });
  if (legacyIds.length || workflowIds.length) {
    orConditions.push({ proposalId: { $in: [...legacyIds, ...workflowIds] } });
  }

  if (!orConditions.length) return { sourceQuery: null, legacyProposals: [] };
  return {
    sourceQuery: orConditions.length === 1 ? orConditions[0] : { $or: orConditions },
    legacyProposals
  };
};

const loadSourceRows = async (Model, sourceQuery, embeddedRows = []) => {
  const linkedRows = sourceQuery ? await Model.find(sourceQuery).lean() : [];
  const rowsByKey = new Map();

  linkedRows.forEach((row, index) => {
    rowsByKey.set(row?._id ? String(row._id) : `linked-${index}`, row);
  });
  embeddedRows.filter(Boolean).forEach((row, index) => {
    const key = row?._id ? String(row._id) : `embedded-${index}`;
    if (!rowsByKey.has(key)) rowsByKey.set(key, row);
  });

  return Array.from(rowsByKey.values());
};

const stripPersonnelWorkflowFields = row => {
  const cloned = { ...row };
  [
    '_id', '__v', 'createdAt', 'updatedAt', 'proposalId', 'workflowRef',
    'status', 'workflowLevel', 'processBy', 'processDate', 'date_process',
    'username_process', 'createdBy', 'submittedDate', 'reviewedBy',
    'reviewedAt', 'approvedBy', 'approvedAt', 'rejectionReason', 'finalNote',
    'nepInitialValues', 'nepInitialAllocations', 'nepAllocations'
  ].forEach(field => delete cloned[field]);
  return cloned;
};

const cloneProposalLineItems = async ({
  initialProposals,
  targetWorkflowId,
  targetLegacyProposalId,
  fiscalYear,
  regionName,
  department,
  division,
  preparer,
  workflowAssignment = {}
}) => {
  const { sourceQuery } = await buildSourceLineQuery(initialProposals);
  const now = new Date();
  const fiscalYearString = String(fiscalYear);
  const fiscalYearNumber = Number(fiscalYear);
  const targetBase = {
    proposalId: targetLegacyProposalId,
    workflowRef: targetWorkflowId,
    budgetType: 'NEP',
    status: workflowAssignment.legacyStatus || 'Draft',
    workflowLevel: workflowAssignment.legacyWorkflowLevel || 'BUDGET PREPARER',
    processBy: preparer.userName,
    processDate: now,
    createdBy: preparer.userId
  };

  const embeddedIncome = initialProposals.flatMap(proposal => proposal.incomeData || []);
  const embeddedPersonnel = initialProposals.flatMap(proposal => proposal.personnelData || []);
  const embeddedMooe = initialProposals.flatMap(proposal => proposal.mooeData || []);
  const embeddedCapital = initialProposals.flatMap(proposal => proposal.capitalData || []);

  const [incomeRows, personnelRows, mooeRows, capitalRows] = await Promise.all([
    loadSourceRows(Income, sourceQuery, embeddedIncome),
    loadSourceRows(PersonnelServices, sourceQuery, embeddedPersonnel),
    loadSourceRows(MooeProposal, sourceQuery, embeddedMooe),
    loadSourceRows(CapitalOutlay, sourceQuery, embeddedCapital)
  ]);

  const incomeDocs = incomeRows.map(row => ({
    particulars: row.particulars,
    cost: Number(row.cost ?? row.amount ?? 0),
    incomecategory: row.incomecategory,
    subcategory: row.subcategory,
    category: row.category,
    amount: Number(row.amount || 0),
    fiscalYear: fiscalYearString,
    region: regionName || row.region,
    department: department || row.department,
    division: division || row.division,
    originalLevel: row.originalLevel || null,
    consolidatedFrom: row.consolidatedFrom || null,
    ...targetBase
  }));

  const personnelDocs = personnelRows.map(row => ({
    ...stripPersonnelWorkflowFields(row),
    ...buildPersonnelNepSnapshot(row),
    region: regionName || row.region,
    department: department || row.department,
    division: division || row.division,
    fiscalYear: fiscalYearString,
    fiscal_year: fiscalYearNumber,
    date_process: now,
    username_process: preparer.userName,
    ...targetBase
  }));

  const mooeDocs = mooeRows.map(row => ({
    uacsCode: row.uacsCode,
    accountingTitle: row.accountingTitle,
    sublineItem: row.sublineItem,
    income: Number(row.income || 0),
    subsidy: Number(row.subsidy || 0),
    amount: Number(row.amount || 0),
    nis: Number(row.nis || 0),
    cis: Number(row.cis || 0),
    region: regionName || row.region,
    department: department || row.department,
    division: division || row.division,
    fiscalYear: fiscalYearString,
    originalLevel: row.originalLevel || null,
    ...targetBase
  }));

  // CapitalOutlay has a unique business-key index. Consolidated Initial
  // proposals can legitimately contribute the same account from multiple
  // source proposals, so aggregate those parent rows before inserting the
  // generated NEP data. Their detail rows are still copied individually.
  const capitalDocsByKey = new Map();
  const capitalKeyBySourceId = new Map();
  capitalRows.forEach((row, index) => {
    const doc = {
      particulars: row.particulars,
      cost: Number(row.cost || 0),
      income: Number(row.income || 0),
      subsidy: Number(row.subsidy || 0),
      category: row.category,
      sublineItem: row.sublineItem,
      accountingTitle: row.accountingTitle,
      uacsCode: row.uacsCode,
      region: regionName || row.region,
      department: department || row.department,
      division: division || row.division,
      fiscalYear: fiscalYearString,
      fiscal_year: fiscalYearNumber,
      date_process: now,
      username_process: preparer.userName,
      ...targetBase
    };
    const businessKey = [
      String(targetLegacyProposalId || ''),
      String(doc.uacsCode || ''),
      String(doc.region || ''),
      String(doc.department || ''),
      String(doc.division || ''),
      String(doc.fiscalYear || ''),
      String(doc.sublineItem || ''),
      String(doc.category || '')
    ].join('\u001f');

    if (capitalDocsByKey.has(businessKey)) {
      const existing = capitalDocsByKey.get(businessKey);
      existing.cost += doc.cost;
      existing.income += doc.income;
      existing.subsidy += doc.subsidy;
    } else {
      capitalDocsByKey.set(businessKey, doc);
    }

    const sourceKey = row?._id ? String(row._id) : `source-${index}`;
    capitalKeyBySourceId.set(sourceKey, businessKey);
  });
  const capitalEntries = Array.from(capitalDocsByKey.entries());
  const capitalDocs = capitalEntries.map(([, doc]) => doc);

  const [incomeInserted, personnelInserted, mooeInserted, capitalInserted] = await Promise.all([
    incomeDocs.length ? Income.insertMany(incomeDocs) : [],
    personnelDocs.length ? PersonnelServices.insertMany(personnelDocs) : [],
    mooeDocs.length ? MooeProposal.insertMany(mooeDocs) : [],
    capitalDocs.length ? CapitalOutlay.insertMany(capitalDocs) : []
  ]);

  const insertedCapitalIdByKey = new Map();
  capitalEntries.forEach(([businessKey], index) => {
    if (capitalInserted[index]?._id) {
      insertedCapitalIdByKey.set(businessKey, capitalInserted[index]._id);
    }
  });
  const capitalIdMap = new Map();
  capitalRows.forEach((source, index) => {
    if (!source?._id) return;
    const sourceKey = String(source._id || `source-${index}`);
    const targetId = insertedCapitalIdByKey.get(capitalKeyBySourceId.get(sourceKey));
    if (targetId) capitalIdMap.set(sourceKey, targetId);
  });

  let capitalDetailsInserted = [];
  if (capitalIdMap.size) {
    const details = await CapitalOutlayDetails.find({
      capital_outlay_id: { $in: Array.from(capitalIdMap.keys()) }
    }).lean();
    const detailDocs = details
      .filter(detail => capitalIdMap.has(String(detail.capital_outlay_id)))
      .map(detail => ({
        capital_outlay_id: capitalIdMap.get(String(detail.capital_outlay_id)),
        particulars: detail.particulars,
        income_amount: Number(detail.income_amount || 0),
        subsidy_amount: Number(detail.subsidy_amount || 0),
        processBy: preparer.userName,
        processDate: now
      }));
    capitalDetailsInserted = detailDocs.length
      ? await CapitalOutlayDetails.insertMany(detailDocs)
      : [];
  }

  return {
    income: incomeInserted.length,
    personnel: personnelInserted.length,
    mooe: mooeInserted.length,
    capitalOutlay: capitalInserted.length,
    capitalOutlayDetails: capitalDetailsInserted.length
  };
};

const cleanupGeneratedNepData = async ({ workflowId, legacyProposalId }) => {
  const clauses = [];
  if (workflowId) clauses.push({ workflowRef: workflowId });
  if (legacyProposalId) clauses.push({ proposalId: legacyProposalId });
  if (!clauses.length) return;

  const query = clauses.length === 1 ? clauses[0] : { $or: clauses };
  const capitalRows = await CapitalOutlay.find(query).select('_id').lean();
  const capitalIds = capitalRows.map(row => row._id);
  if (capitalIds.length) {
    await CapitalOutlayDetails.deleteMany({ capital_outlay_id: { $in: capitalIds } });
  }

  await Promise.all([
    Income.deleteMany(query),
    PersonnelServices.deleteMany(query),
    MooeProposal.deleteMany(query),
    CapitalOutlay.deleteMany(query)
  ]);
};

module.exports = {
  NEP_GENERATION_MODES,
  normalizeNepGenerationMode,
  buildNepGenerationAssignment,
  resolvePreparerAssignments,
  cloneProposalLineItems,
  cleanupGeneratedNepData,
  normalizeText
};
