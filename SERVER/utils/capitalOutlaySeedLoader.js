const fs = require("fs");
const path = require("path");

let cachedSeed = null;
let cachedPath = null;

const REASONS = {
  MISSING_FILE: "missing-file",
  EMPTY_FILE: "empty-file",
  INVALID_JSON: "invalid-json",
  INVALID_STRUCTURE: "invalid-structure",
};

const resolveSeedFilePath = () => {
  const envPath = process.env.CAPITAL_OUTLAY_SEED_FILE;
  if (envPath) {
    return path.isAbsolute(envPath) ? envPath : path.resolve(process.cwd(), envPath);
  }
  return path.resolve(__dirname, "../database-scripts/seeds/CapitalOutlayChartOfAccounts.json");
};

const normalizeSeedEntries = (data) => {
  if (Array.isArray(data)) {
    return data;
  }
  if (data && Array.isArray(data.entries)) {
    return data.entries;
  }
  return null;
};

const loadCapitalOutlaySeedEntries = ({ forceReload = false } = {}) => {
  const seedPath = resolveSeedFilePath();

  if (!forceReload && cachedSeed && cachedPath === seedPath) {
    return cachedSeed;
  }

  const result = {
    entries: [],
    seedPath,
    reason: null,
  };

  if (!fs.existsSync(seedPath)) {
    result.reason = REASONS.MISSING_FILE;
    cachedSeed = result;
    cachedPath = seedPath;
    return result;
  }

  try {
    const rawContent = fs.readFileSync(seedPath, "utf8");
    if (!rawContent.trim()) {
      result.reason = REASONS.EMPTY_FILE;
      cachedSeed = result;
      cachedPath = seedPath;
      return result;
    }

    const parsed = JSON.parse(rawContent);
    const entries = normalizeSeedEntries(parsed);

    if (!Array.isArray(entries)) {
      result.reason = REASONS.INVALID_STRUCTURE;
      cachedSeed = result;
      cachedPath = seedPath;
      return result;
    }

    result.entries = entries.filter(Boolean).map((entry) => ({ ...entry }));
    cachedSeed = result;
    cachedPath = seedPath;
    return result;
  } catch (error) {
    result.reason = REASONS.INVALID_JSON;
    result.error = error.message;
    cachedSeed = result;
    cachedPath = seedPath;
    return result;
  }
};

module.exports = {
  loadCapitalOutlaySeedEntries,
  resolveSeedFilePath,
  REASONS,
};
