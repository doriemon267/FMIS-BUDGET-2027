const SIGNATURE_REQUIRED_ACTIONS = new Set([
  'submit-to-reviewer',
  'submit-to-approver',
  'forward-to-officer',
  'forward-to-manager',
  'finalize'
]);

const isSigningEnabled =
  String(import.meta.env.VITE_PNPKI_SIGNING_ENABLED || '').toLowerCase() === 'true';

const ACTION_TO_NEXT_STATUS = {
  'submit-to-reviewer': 'FORWARDED_TO_REVIEWER',
  'submit-to-approver': 'FORWARDED_TO_APPROVER',
  'submit-to-analyst': 'FORWARDED_TO_BRD_ANALYST',
  'forward-to-officer': 'FORWARDED_TO_BRD_OFFICER',
  'forward-to-manager': 'FORWARDED_TO_BRD_MANAGER',
  'finalize': 'FINALIZED',
  'return-to-preparer': 'RETURNED_TO_PREPARER',
  'return-to-reviewer': 'RETURNED_TO_REVIEWER'
};

const STATUS_TO_CANONICAL = {
  Draft: 'DRAFT',
  'Forwarded to Reviewer': 'FORWARDED_TO_REVIEWER',
  'Forwarded to Approver': 'FORWARDED_TO_APPROVER',
  'Forwarded to Budget Planning Analyst': 'FORWARDED_TO_BRD_ANALYST',
  'Forwarded to Budget Officer': 'FORWARDED_TO_BRD_OFFICER',
  'Forwarded to Overall Budget Approver': 'FORWARDED_TO_BRD_MANAGER',
  Finalized: 'FINALIZED',
  Returned: 'RETURNED_TO_PREPARER',
  'Returned to Preparer': 'RETURNED_TO_PREPARER',
  'Returned to Reviewer': 'RETURNED_TO_REVIEWER',
  'Returned to Approver': 'RETURNED_TO_APPROVER',
  'Returned to Budget Planning Analyst': 'RETURNED_TO_PLANNING_ANALYST',
  'Returned to Budget Officer': 'RETURNED_TO_OFFICER'
};

const getTokenPayload = () => {
  try {
    const token = localStorage.getItem('token');
    if (!token) return null;
    const encodedPayload = token.split('.')[1];
    if (!encodedPayload) return null;
    return JSON.parse(atob(encodedPayload));
  } catch (_) {
    return null;
  }
};

const resolveSignedByUserId = (userInfo = {}) => {
  const candidates = [
    userInfo?.id,
    userInfo?._id,
    userInfo?.userId,
    userInfo?.UserId,
    userInfo?.Id,
    userInfo?.uid
  ].filter(Boolean);

  if (candidates.length > 0) {
    return String(candidates[0]);
  }

  const tokenPayload = getTokenPayload();
  const tokenCandidates = [
    tokenPayload?.id,
    tokenPayload?._id,
    tokenPayload?.userId,
    tokenPayload?.UserId,
    tokenPayload?.sub
  ].filter(Boolean);

  if (tokenCandidates.length > 0) {
    return String(tokenCandidates[0]);
  }

  throw new Error('Unable to resolve signedBy user ID for digital signature');
};

const normalizeStatus = (status) => {
  if (!status) return 'DRAFT';
  if (STATUS_TO_CANONICAL[status]) return STATUS_TO_CANONICAL[status];
  return String(status).trim().toUpperCase().replace(/\s+/g, '_');
};

const buildWorkflowSigningPayload = ({
  proposal,
  workflowAction,
  comment,
  signedBy,
  signedAt
}) => {
  const fromStatus = normalizeStatus(proposal?.status);
  const toStatus = ACTION_TO_NEXT_STATUS[workflowAction];

  if (!toStatus) {
    throw new Error(`Unsupported workflow action for digital signature: ${workflowAction}`);
  }

  return JSON.stringify({
    proposalId: String(proposal?._id || proposal?.id || ''),
    title: String(proposal?.title || ''),
    fiscalYear: Number(proposal?.fiscalYear),
    modelType: String(proposal?.modelType || ''),
    action: String(workflowAction),
    fromStatus: String(fromStatus),
    toStatus: String(toStatus),
    comment: String(comment || ''),
    signedBy: String(signedBy),
    signedAt: String(signedAt)
  });
};

const requestPnpkiSignature = async ({ payload, signedAt, workflowAction, proposalId }) => {
  const signer = typeof window !== 'undefined' ? window.PNPKISigner : null;

  if (!signer || typeof signer.signWorkflowPayload !== 'function') {
    throw new Error('PNPKI signer is not available in this browser session');
  }

  const signatureResult = await signer.signWorkflowPayload(payload, {
    signedAt,
    action: workflowAction,
    proposalId
  });

  if (!signatureResult?.signature || !signatureResult?.certificatePem) {
    throw new Error('PNPKI signer did not return signature and certificatePem');
  }

  return {
    signature: String(signatureResult.signature),
    certificatePem: String(signatureResult.certificatePem),
    certificateChainPem: signatureResult.certificateChainPem || signatureResult.chain || null,
    algorithm: signatureResult.algorithm || 'RSA-SHA256'
  };
};

export const actionRequiresDigitalSignature = (workflowAction) =>
  isSigningEnabled && SIGNATURE_REQUIRED_ACTIONS.has(String(workflowAction || ''));

export const createWorkflowDigitalSignature = async ({
  proposal,
  workflowAction,
  comment,
  userInfo
}) => {
  if (!actionRequiresDigitalSignature(workflowAction)) {
    return null;
  }

  const signedBy = resolveSignedByUserId(userInfo);
  const signedAt = new Date().toISOString();

  const signedPayload = buildWorkflowSigningPayload({
    proposal,
    workflowAction,
    comment,
    signedBy,
    signedAt
  });

  const signerResponse = await requestPnpkiSignature({
    payload: signedPayload,
    signedAt,
    workflowAction,
    proposalId: proposal?._id || proposal?.id
  });

  return {
    signature: signerResponse.signature,
    certificatePem: signerResponse.certificatePem,
    certificateChainPem: signerResponse.certificateChainPem,
    signedPayload,
    signedAt,
    algorithm: signerResponse.algorithm
  };
};
