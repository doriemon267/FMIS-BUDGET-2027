const FINALIZED_PROPOSAL_STATUS = 'FINALIZED';
const UNKNOWN_PROPOSAL_STATUS = 'UNKNOWN';

const normalizeProposalStatus = (status) => String(status || '')
  .trim()
  .replace(/[\s-]+/g, '_')
  .toUpperCase();

const isFinalizedProposalStatus = (status) => (
  normalizeProposalStatus(status) === FINALIZED_PROPOSAL_STATUS
);

const extractProposalStatus = (source) => {
  if (typeof source === 'string') return source;
  if (!source || typeof source !== 'object') return '';

  if (source.isFinalized === true) return FINALIZED_PROPOSAL_STATUS;
  if (source.isFinalized === false) return 'DRAFT';

  return source.proposalStatus
    || source.workflowStatus
    || source.status
    || '';
};

const flattenRecords = (sources) => sources.flatMap((source) => {
  if (Array.isArray(source)) return flattenRecords(source);
  return source == null ? [] : [source];
});

const shouldShowDraftWatermark = (...sources) => {
  const records = flattenRecords(sources);
  if (records.length === 0) return true;

  return records.some((record) => !isFinalizedProposalStatus(extractProposalStatus(record)));
};

const getWorkflowRefId = (record) => {
  if (!record || typeof record !== 'object') return '';
  const workflowRef = record.workflowRef || record.proposalWorkflowRef;
  const rawId = workflowRef && typeof workflowRef === 'object'
    ? (workflowRef._id || workflowRef.id)
    : workflowRef;
  return rawId ? String(rawId) : '';
};

const resolveDraftWatermarkForRecords = async (records, WorkflowModel) => {
  const flatRecords = flattenRecords([records]);
  if (flatRecords.length === 0) return true;

  const workflowIds = [...new Set(flatRecords.map(getWorkflowRefId).filter(Boolean))];
  const workflowStatuses = new Map();

  if (workflowIds.length > 0 && WorkflowModel?.find) {
    try {
      let workflowQuery = WorkflowModel.find({ _id: { $in: workflowIds } });
      if (workflowQuery?.select) workflowQuery = workflowQuery.select('_id status');
      if (workflowQuery?.lean) workflowQuery = workflowQuery.lean();
      const workflows = await workflowQuery;

      (workflows || []).forEach((workflow) => {
        const workflowId = workflow?._id || workflow?.id;
        if (workflowId) workflowStatuses.set(String(workflowId), workflow?.status);
      });
    } catch (error) {
      // A status lookup must never make the PDF unavailable. Direct proposal-row
      // statuses are still evaluated below, and unresolved rows remain DRAFT.
    }
  }

  const resolvedStatuses = flatRecords.map((record) => {
    const workflowRefId = getWorkflowRefId(record);
    if (workflowRefId && workflowStatuses.has(workflowRefId)) {
      return workflowStatuses.get(workflowRefId);
    }
    return extractProposalStatus(record) || UNKNOWN_PROPOSAL_STATUS;
  });

  return shouldShowDraftWatermark(resolvedStatuses);
};

const drawMuhammaraDraftWatermark = (pdfContext, {
  show = true,
  pageWidth,
  pageHeight,
  text = 'DRAFT',
  fontSize = 54,
  color = '#e4c8c8',
} = {}) => {
  if (!show || !pdfContext?.text) return false;

  const width = Number(pageWidth) || 595;
  const height = Number(pageHeight) || 842;
  pdfContext.text(text, width / 2, (height / 2) - (fontSize / 2), {
    align: 'center',
    bold: true,
    color,
    fontSize,
  });
  return true;
};

module.exports = {
  FINALIZED_PROPOSAL_STATUS,
  UNKNOWN_PROPOSAL_STATUS,
  normalizeProposalStatus,
  isFinalizedProposalStatus,
  extractProposalStatus,
  shouldShowDraftWatermark,
  resolveDraftWatermarkForRecords,
  drawMuhammaraDraftWatermark,
};
