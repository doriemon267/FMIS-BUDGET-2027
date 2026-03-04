const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SUPPORTED_VERIFY_ALGORITHMS = new Set([
  'RSA-SHA256',
  'sha256',
  'sha256WithRSAEncryption'
]);

const isProduction = () => {
  const nodeEnvProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
  const productionModeFlag = String(process.env.PRODUCTION_MODE || '').trim() !== '';
  return nodeEnvProd || productionModeFlag;
};
const isNonProduction = () => !isProduction();
const isDebugMode = () => String(process.env.DEBUG_MODE || '').toLowerCase() === 'true';
const isMockSignatureFallbackEnabled = () => {
  if (isProduction()) return false;
  const explicit = String(process.env.PNPKI_ALLOW_MOCK_SIGNATURE || '').toLowerCase() === 'true';
  return explicit || isNonProduction() || isDebugMode();
};

const parsePemCertificates = (pemText = '') => {
  if (!pemText || typeof pemText !== 'string') return [];
  const matches = pemText.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
  return matches || [];
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

const normalizeStatus = (status) => {
  if (!status) return 'DRAFT';
  if (STATUS_TO_CANONICAL[status]) return STATUS_TO_CANONICAL[status];
  return String(status).trim().toUpperCase().replace(/\s+/g, '_');
};

const toPemArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .flatMap((entry) => parsePemCertificates(String(entry || '')))
      .filter(Boolean);
  }
  return parsePemCertificates(String(value));
};

let cachedTrustedCertificates = null;

const loadTrustedCertificates = () => {
  if (cachedTrustedCertificates) return cachedTrustedCertificates;

  const trustBundlePath = process.env.PNPKI_TRUST_BUNDLE_PATH;
  if (!trustBundlePath) {
    cachedTrustedCertificates = [];
    return cachedTrustedCertificates;
  }

  const resolved = path.resolve(trustBundlePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`PNPKI trust bundle not found at ${resolved}`);
  }

  const bundle = fs.readFileSync(resolved, 'utf8');
  const certPems = parsePemCertificates(bundle);
  cachedTrustedCertificates = certPems.map((pem) => new crypto.X509Certificate(pem));
  return cachedTrustedCertificates;
};

const isCertificateTrustedByChain = (leafCert, chainCertificates, trustedCertificates) => {
  if (!leafCert) return false;

  const possibleIssuers = [...chainCertificates, ...trustedCertificates];
  const subjectMap = new Map();
  for (const cert of possibleIssuers) {
    if (!subjectMap.has(cert.subject)) {
      subjectMap.set(cert.subject, cert);
    }
  }

  let current = leafCert;
  const visited = new Set();

  while (current) {
    const currentFingerprint = current.fingerprint256;
    if (visited.has(currentFingerprint)) break;
    visited.add(currentFingerprint);

    const isTrusted = trustedCertificates.some((trusted) => trusted.fingerprint256 === currentFingerprint);
    if (isTrusted) return true;

    if (current.issuer === current.subject) {
      return false;
    }

    const issuerCandidate = subjectMap.get(current.issuer);
    if (!issuerCandidate) {
      return false;
    }

    if (!current.verify(issuerCandidate.publicKey)) {
      return false;
    }

    current = issuerCandidate;
  }

  return false;
};

const buildWorkflowSigningPayload = ({
  proposal,
  action,
  fromStatus,
  toStatus,
  comment,
  signedBy,
  signedAt
}) => {
  const payload = {
    proposalId: String(proposal._id),
    title: String(proposal.title || ''),
    fiscalYear: Number(proposal.fiscalYear),
    modelType: String(proposal.modelType || proposal.budgetType || ''),
    action: String(action),
    fromStatus: String(normalizeStatus(fromStatus)),
    toStatus: String(normalizeStatus(toStatus)),
    comment: String(comment || ''),
    signedBy: String(signedBy),
    signedAt: String(signedAt)
  };

  return JSON.stringify(payload);
};

const buildExpectedMockSignature = ({ payload, signedAt, action }) =>
  Buffer.from(`${String(payload || '')}::${String(signedAt || '')}::${String(action || '')}`, 'utf8').toString('base64');

const resolveMockAction = (payload, fallbackAction) => {
  try {
    if (!payload || typeof payload !== 'string') return fallbackAction;
    const parsed = JSON.parse(payload);
    if (parsed && typeof parsed.action === 'string' && parsed.action.trim()) {
      return parsed.action.trim();
    }
    return fallbackAction;
  } catch (_) {
    return fallbackAction;
  }
};

const buildMockVerificationResult = ({ expectedPayload }) => ({
  valid: true,
  signedPayload: expectedPayload,
  certificateSubject: 'CN=FMIS Mock PNPKI Signer, O=FMIS Development',
  certificateIssuer: 'CN=FMIS Mock PNPKI Signer, O=FMIS Development',
  certificateSerialNumber: 'MOCK-SERIAL',
  certificateFingerprint256: 'MOCK-FINGERPRINT',
  certificateValidFrom: new Date().toISOString(),
  certificateValidTo: new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000).toISOString(),
  trustBundleConfigured: false
});

const normalizeSignedAt = (value) => {
  const asDate = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(asDate.getTime())) {
    throw new Error('Invalid signedAt value in digital signature');
  }
  return asDate.toISOString();
};

const verifyWorkflowDigitalSignature = ({
  proposal,
  action,
  fromStatus,
  toStatus,
  comment,
  signedBy,
  digitalSignature
}) => {
  if (!digitalSignature || typeof digitalSignature !== 'object') {
    throw new Error('Missing digital signature payload');
  }

  const {
    signature,
    certificatePem,
    certificateChainPem,
    signedPayload,
    signedAt,
    algorithm = 'RSA-SHA256'
  } = digitalSignature;

  if (!signature || !certificatePem || !signedAt) {
    throw new Error('Digital signature requires signature, certificatePem, and signedAt');
  }

  if (!SUPPORTED_VERIFY_ALGORITHMS.has(algorithm)) {
    throw new Error(`Unsupported digital signature algorithm: ${algorithm}`);
  }

  const normalizedSignedAt = normalizeSignedAt(signedAt);

  const expectedPayload = buildWorkflowSigningPayload({
    proposal,
    action,
    fromStatus,
    toStatus,
    comment,
    signedBy,
    signedAt: normalizedSignedAt
  });

  const tryMockFallback = (payloadForSignature = expectedPayload) => {
    if (!isMockSignatureFallbackEnabled()) return null;
    const actionForSignature = resolveMockAction(payloadForSignature, action);
    const expectedMockSignature = buildExpectedMockSignature({
      payload: payloadForSignature,
      signedAt: normalizedSignedAt,
      action: actionForSignature
    });

    if (signature === expectedMockSignature) {
      return buildMockVerificationResult({ expectedPayload: payloadForSignature });
    }

    return null;
  };

  if (signedPayload && signedPayload !== expectedPayload) {
    const mockResult = tryMockFallback(signedPayload);
    if (mockResult) return mockResult;
    throw new Error('Signed payload does not match expected workflow payload');
  }

  let leafCert;
  try {
    leafCert = new crypto.X509Certificate(certificatePem);
  } catch (certificateError) {
    const mockResult = tryMockFallback(signedPayload || expectedPayload);
    if (mockResult) return mockResult;
    throw certificateError;
  }

  const now = new Date();
  const notBefore = new Date(leafCert.validFrom);
  const notAfter = new Date(leafCert.validTo);
  if (now < notBefore || now > notAfter) {
    throw new Error('Signer certificate is not currently valid');
  }

  const trustedCertificates = loadTrustedCertificates();
  if (isProduction() && trustedCertificates.length === 0) {
    throw new Error('PNPKI trust bundle is required in production (set PNPKI_TRUST_BUNDLE_PATH)');
  }
  const chainCertificates = toPemArray(certificateChainPem).map((pem) => new crypto.X509Certificate(pem));

  if (trustedCertificates.length > 0) {
    const chainTrusted = isCertificateTrustedByChain(leafCert, chainCertificates, trustedCertificates);
    if (!chainTrusted) {
      throw new Error('Certificate chain is not trusted by configured PNPKI trust bundle');
    }
  }

  const verifier = crypto.createVerify(algorithm);
  verifier.update(expectedPayload);
  verifier.end();

  const isValidSignature = verifier.verify(leafCert.publicKey, Buffer.from(signature, 'base64'));
  if (!isValidSignature) {
    const mockResult = tryMockFallback(signedPayload || expectedPayload);
    if (mockResult) return mockResult;
    throw new Error('Invalid digital signature');
  }

  return {
    valid: true,
    signedPayload: expectedPayload,
    certificateSubject: leafCert.subject,
    certificateIssuer: leafCert.issuer,
    certificateSerialNumber: leafCert.serialNumber,
    certificateFingerprint256: leafCert.fingerprint256,
    certificateValidFrom: leafCert.validFrom,
    certificateValidTo: leafCert.validTo,
    trustBundleConfigured: trustedCertificates.length > 0
  };
};

module.exports = {
  buildWorkflowSigningPayload,
  verifyWorkflowDigitalSignature
};
