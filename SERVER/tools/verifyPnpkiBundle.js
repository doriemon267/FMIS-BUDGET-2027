const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const parsePemCertificates = (pemText = '') => {
  const matches = String(pemText).match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
  return matches || [];
};

const usage = () => {
  console.log('Usage:');
  console.log('  node ./tools/verifyPnpkiBundle.js');
  console.log('  node ./tools/verifyPnpkiBundle.js --leaf ./certs/signer.pem --chain ./certs/intermediate.pem');
  console.log('');
  console.log('Reads PNPKI_TRUST_BUNDLE_PATH from .env and validates certificate parsing/validity.');
};

const readArgValue = (flag) => {
  const index = process.argv.findIndex((arg) => arg === flag);
  if (index < 0) return null;
  return process.argv[index + 1] || null;
};

const toX509ListFromFile = (filePath) => {
  if (!filePath) return [];
  const resolved = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`File not found: ${resolved}`);
  }
  const text = fs.readFileSync(resolved, 'utf8');
  const certs = parsePemCertificates(text);
  return certs.map((pem) => new crypto.X509Certificate(pem));
};

const verifyChainToTrust = (leafCert, chainCerts, trustCerts) => {
  const pool = [...chainCerts, ...trustCerts];
  const bySubject = new Map();
  for (const cert of pool) {
    if (!bySubject.has(cert.subject)) {
      bySubject.set(cert.subject, cert);
    }
  }

  let current = leafCert;
  const visited = new Set();

  while (current) {
    if (trustCerts.some((trusted) => trusted.fingerprint256 === current.fingerprint256)) {
      return true;
    }

    if (visited.has(current.fingerprint256)) {
      return false;
    }
    visited.add(current.fingerprint256);

    if (current.issuer === current.subject) {
      return false;
    }

    const issuer = bySubject.get(current.issuer);
    if (!issuer) return false;
    if (!current.verify(issuer.publicKey)) return false;

    current = issuer;
  }

  return false;
};

const formatValidity = (cert) => `${cert.validFrom} -> ${cert.validTo}`;

const run = () => {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    usage();
    process.exit(0);
  }

  const bundlePath = process.env.PNPKI_TRUST_BUNDLE_PATH;
  if (!bundlePath) {
    console.error('PNPKI_TRUST_BUNDLE_PATH is empty in SERVER/.env');
    process.exit(1);
  }

  const resolvedBundlePath = path.resolve(process.cwd(), bundlePath);
  if (!fs.existsSync(resolvedBundlePath)) {
    console.error(`Trust bundle file not found: ${resolvedBundlePath}`);
    process.exit(1);
  }

  const bundleText = fs.readFileSync(resolvedBundlePath, 'utf8');
  const bundleCerts = parsePemCertificates(bundleText);
  if (bundleCerts.length === 0) {
    console.error(`No PEM certificates found in trust bundle: ${resolvedBundlePath}`);
    process.exit(1);
  }

  const trustCerts = bundleCerts.map((pem) => new crypto.X509Certificate(pem));

  console.log(`✔ Trust bundle loaded: ${resolvedBundlePath}`);
  console.log(`✔ Certificates found: ${trustCerts.length}`);
  trustCerts.forEach((cert, index) => {
    console.log(`  [${index + 1}] Subject: ${cert.subject}`);
    console.log(`      Issuer : ${cert.issuer}`);
    console.log(`      Valid  : ${formatValidity(cert)}`);
  });

  const now = new Date();
  const expired = trustCerts.filter((cert) => now > new Date(cert.validTo));
  if (expired.length > 0) {
    console.warn(`⚠ ${expired.length} certificate(s) in bundle are expired.`);
  } else {
    console.log('✔ No expired certificates found in trust bundle.');
  }

  const leafPath = readArgValue('--leaf');
  const chainPath = readArgValue('--chain');

  if (leafPath) {
    const leafList = toX509ListFromFile(leafPath);
    if (leafList.length === 0) {
      throw new Error('Leaf file has no PEM certificate');
    }
    const leafCert = leafList[0];
    const chainCerts = toX509ListFromFile(chainPath);
    const trusted = verifyChainToTrust(leafCert, chainCerts, trustCerts);
    if (!trusted) {
      console.error('✖ Leaf certificate chain is NOT trusted by PNPKI bundle.');
      process.exit(2);
    }
    console.log('✔ Leaf certificate chain is trusted by PNPKI bundle.');
  }

  console.log('PNPKI trust bundle verification complete.');
};

try {
  run();
} catch (error) {
  console.error('PNPKI bundle verification failed:', error.message);
  process.exit(1);
}
