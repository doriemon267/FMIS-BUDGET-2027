export const normalizeProposalStatus = (status) => String(status || '')
  .trim()
  .replace(/[\s-]+/g, '_')
  .toUpperCase();

const extractProposalStatus = (source) => {
  if (typeof source === 'string') return source;
  if (!source || typeof source !== 'object') return '';
  if (source.isFinalized === true) return 'FINALIZED';
  if (source.isFinalized === false) return 'DRAFT';
  return source.proposalStatus || source.workflowStatus || source.status || '';
};

const flattenSources = (sources) => sources.flatMap((source) => (
  Array.isArray(source) ? flattenSources(source) : (source == null ? [] : [source])
));

export const shouldShowDraftWatermark = (...sources) => {
  const records = flattenSources(sources);
  if (records.length === 0) return true;
  return records.some((record) => normalizeProposalStatus(extractProposalStatus(record)) !== 'FINALIZED');
};
