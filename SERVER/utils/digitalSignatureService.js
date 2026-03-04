const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SUPPORTED_VERIFY_ALGORITHMS = new Set([
  'RSA-SHA256',
  'sha256',
  'sha256WithRSAEncryption'
]);

const parsePemCertificates = (pemText = '') => {
  if (!pemText || typeof pemText !== 'string') return [];
  const matches = pemText.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
  return matches || [];
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
    modelType: String(proposal.modelType || ''),
    action: String(action),
    fromStatus: String(fromStatus),
    toStatus: String(toStatus),
    comment: String(comment || ''),
    signedBy: String(signedBy),
    signedAt: String(signedAt)
  };

  return JSON.stringify(payload);
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

  const signedAtDate = new Date(signedAt);
  if (Number.isNaN(signedAtDate.getTime())) {
    throw new Error('Invalid signedAt value in digital signature');
  }

  const leafCert = new crypto.X509Certificate(certificatePem);
  const now = new Date();
  const notBefore = new Date(leafCert.validFrom);
  const notAfter = new Date(leafCert.validTo);
  if (now < notBefore || now > notAfter) {
    throw new Error('Signer certificate is not currently valid');
  }

  const trustedCertificates = loadTrustedCertificates();
  const chainCertificates = toPemArray(certificateChainPem).map((pem) => new crypto.X509Certificate(pem));

  if (trustedCertificates.length > 0) {
    const chainTrusted = isCertificateTrustedByChain(leafCert, chainCertificates, trustedCertificates);
    if (!chainTrusted) {
      throw new Error('Certificate chain is not trusted by configured PNPKI trust bundle');
    }
  }

  const expectedPayload = buildWorkflowSigningPayload({
    proposal,
    action,
    fromStatus,
    toStatus,
    comment,
    signedBy,
    signedAt
  });

  if (signedPayload && signedPayload !== expectedPayload) {
    throw new Error('Signed payload does not match expected workflow payload');
  }

  const verifier = crypto.createVerify(algorithm);
  verifier.update(expectedPayload);
  verifier.end();

  const isValidSignature = verifier.verify(leafCert.publicKey, Buffer.from(signature, 'base64'));
  if (!isValidSignature) {
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
