const normalizeUacsCode = (value = "") =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

const isMooe502Account = (uacsCode) => normalizeUacsCode(uacsCode).startsWith("502");

const hasSemiExpendableLabel = (...values) =>
  values.some((value) => /semi[\s-]*expendable/i.test(String(value || "")));

const normalizeAccountLabel = (value = "") =>
  String(value || "").trim().toUpperCase();

const normalizeCapitalOutlayCategoryName = (value = "") =>
  String(value || "")
    .normalize("NFKC")
    .replace(/^\s*(?:[IVXLCDM]+|\d+)\s*[.)-]\s*/i, "")
    .trim()
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const findConfiguredCapitalOutlayCategory = (title, categories = []) => {
  const normalizedTitle = normalizeCapitalOutlayCategoryName(title);
  if (!normalizedTitle) return null;

  const rawTitle = String(title || "").trim().toUpperCase();
  const matches = categories.filter(
    (category) =>
      normalizeCapitalOutlayCategoryName(category?.categoryName) === normalizedTitle
  );

  return matches
    .sort((a, b) => {
      // Categories configured from /categories normally have subline items,
      // while old upload-created duplicates do not. Prefer the configured one.
      const aConfigured = Array.isArray(a?.sublineItems) && a.sublineItems.length > 0 ? 1 : 0;
      const bConfigured = Array.isArray(b?.sublineItems) && b.sublineItems.length > 0 ? 1 : 0;
      if (aConfigured !== bConfigured) return bConfigured - aConfigured;

      const aExact = String(a?.categoryName || "").trim().toUpperCase() === rawTitle ? 1 : 0;
      const bExact = String(b?.categoryName || "").trim().toUpperCase() === rawTitle ? 1 : 0;
      return bExact - aExact;
    })[0] || null;
};

const validateCapitalOutlayAccount = ({
  uacsCode,
  sublineItem,
  accountingTitle,
} = {}) => {
  if (isMooe502Account(uacsCode)) {
    return {
      valid: false,
      code: "MOOE_502_NOT_ALLOWED_IN_CAPITAL_OUTLAY",
      message: `UACS code "${uacsCode}" is a 5-02 MOOE account and cannot be used under Capital Outlay. Use the applicable Capital Outlay account (for example, Machinery and Equipment) instead.`,
    };
  }

  if (hasSemiExpendableLabel(sublineItem, accountingTitle)) {
    return {
      valid: false,
      code: "SEMI_EXPENDABLE_NOT_ALLOWED_IN_CAPITAL_OUTLAY",
      message: "Semi-expendable accounts belong under MOOE and cannot be used under Capital Outlay. Use the applicable Capital Outlay subline item, such as Machinery and Equipment.",
    };
  }

  return { valid: true };
};

const isAllowedCapitalOutlayAccount = (account = {}) =>
  validateCapitalOutlayAccount(account).valid;

const selectCapitalOutlayMapping = (candidates = [], {
  sublineItem,
  accountingTitle,
  allowedSublineItems = [],
} = {}) => {
  const requestedSubline = normalizeAccountLabel(sublineItem);
  const requestedAccountingTitle = normalizeAccountLabel(accountingTitle);
  const allowedSublines = new Set(
    allowedSublineItems.map(normalizeAccountLabel).filter(Boolean)
  );

  return candidates
    .filter((candidate) => isAllowedCapitalOutlayAccount(candidate))
    .filter((candidate) => {
      if (allowedSublines.size === 0) return true;
      return allowedSublines.has(normalizeAccountLabel(candidate.sublineItem));
    })
    .sort((a, b) => {
      const score = (candidate) => {
        let value = 0;
        if (requestedSubline && normalizeAccountLabel(candidate.sublineItem) === requestedSubline) value += 8;
        if (requestedAccountingTitle && normalizeAccountLabel(candidate.accountingTitle) === requestedAccountingTitle) value += 4;
        if (normalizeUacsCode(candidate.uacsCode).startsWith("506")) value += 2;
        return value;
      };
      return score(b) - score(a);
    })[0] || null;
};

module.exports = {
  normalizeUacsCode,
  normalizeAccountLabel,
  normalizeCapitalOutlayCategoryName,
  findConfiguredCapitalOutlayCategory,
  isMooe502Account,
  hasSemiExpendableLabel,
  validateCapitalOutlayAccount,
  isAllowedCapitalOutlayAccount,
  selectCapitalOutlayMapping,
};
