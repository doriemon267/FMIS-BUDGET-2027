#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function deriveKey(passphrase) {
  return crypto.createHash('sha256').update(String(passphrase)).digest();
}

function encryptString(plain, passphrase) {
  const key = deriveKey(passphrase);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `ENC(${iv.toString('base64')}:${ciphertext.toString('base64')}:${tag.toString('base64')})`;
}

function printUsage() {
  console.log('Usage: node tools/encryptEnv.js --value <value> --key <passphrase>');
  console.log('  or:  node tools/encryptEnv.js --file <.env path> --keys key1,key2 --key <passphrase>');
}

function parseArgs(raw) {
  const out = {};
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    const v = raw[i + 1] && !raw[i + 1].startsWith('--') ? raw[i + 1] : true;
    out[k] = v;
    if (v !== true) i++;
  }
  return out;
}

const argv = parseArgs(process.argv.slice(2));
const pass = argv.key || process.env.ENV_ENCRYPTION_KEY;
if (!pass) {
  console.error('ERROR: passphrase required via --key or ENV_ENCRYPTION_KEY');
  printUsage();
  process.exit(2);
}

if (argv.value) {
  console.log(encryptString(argv.value, pass));
  process.exit(0);
}

if (argv.file && argv.keys) {
  const filePath = path.resolve(process.cwd(), argv.file);
  if (!fs.existsSync(filePath)) {
    console.error('ERROR: file not found:', filePath);
    process.exit(2);
  }
  const keys = String(argv.keys).split(',').map(s => s.trim()).filter(Boolean);
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const backup = filePath + '.bak';
  fs.writeFileSync(backup, content, 'utf8');
  const out = lines.map(line => {
    if (!line || line.trim().startsWith('#')) return line;
    const idx = line.indexOf('=');
    if (idx === -1) return line;
    const k = line.slice(0, idx).trim();
    if (!keys.includes(k)) return line;
    const v = line.slice(idx + 1);
    if (v.startsWith('ENC(') && v.endsWith(')')) return line; // already encrypted
    const enc = encryptString(v, pass);
    console.log(`Encrypted ${k}`);
    return `${k}=${enc}`;
  }).join('\n');
  fs.writeFileSync(filePath, out, 'utf8');
  console.log(`Updated ${filePath} (backup at ${backup})`);
  process.exit(0);
}

printUsage();
process.exit(2);
