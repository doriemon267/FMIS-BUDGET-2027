/**
 * Environment variable validation at startup
 * Validates critical env vars and exits with clear messages if missing
 */

const REQUIRED = [
  { key: 'MONGODB_URI', aliases: ['MONGODB_BUDGET_URL', 'MONGODB_MAIN_URL', 'MONGODB_URL'] },
  { key: 'JWT_SECRET_KEY', aliases: ['JWT_SECRET', 'SECRET_KEY'] },
];

const OPTIONAL_BUT_RECOMMENDED = [
  'APP_PORT',
  'NODE_ENV',
];

function getValue(entry) {
  const keys = [entry.key, ...(entry.aliases || [])];
  for (const k of keys) {
    const v = process.env[k];
    if (v && String(v).trim()) return v;
  }
  return null;
}

function validateEnv(options = {}) {
  const { exitOnMissing = true, silent = false } = options;
  const missing = [];
  const warnings = [];

  for (const entry of REQUIRED) {
    const val = getValue(entry);
    if (!val) {
      missing.push(entry.key + (entry.aliases?.length ? ` (or ${entry.aliases.join(', ')})` : ''));
    }
  }

  for (const key of OPTIONAL_BUT_RECOMMENDED) {
    if (!process.env[key] || !String(process.env[key]).trim()) {
      warnings.push(key);
    }
  }

  if (missing.length > 0) {
    const msg = `[Server] ❌ Missing required environment variable(s):\n${missing.map((m) => `   - ${m}`).join('\n')}\n\nAdd them to SERVER/.env and restart.`;
    if (silent) {
      console.warn(msg);
    } else {
      console.error(msg);
      if (exitOnMissing) {
        process.exit(1);
      }
    }
  }

  if (warnings.length > 0 && !silent) {
    console.warn(`[Server] ⚠️ Optional env vars not set: ${warnings.join(', ')}`);
  }

  return { valid: missing.length === 0, missing, warnings };
}

module.exports = { validateEnv, getValue };
