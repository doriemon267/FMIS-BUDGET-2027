export const UACS_OTHER_MOOE_BASE = 'Other Maintenance and Operating Expenses';

export const shouldHideGenericOtherUacs = (uacsCode, _sublineItem) => {
  if (!uacsCode) return false;
  // Hide all variants that have a suffix after the base 5-02-99-990 (e.g., 5-02-99-990-1, 5-02-99-990-NIS)
  // Keep the base '5-02-99-990' visible
  const basePrefix = '5-02-99-990-';
  return uacsCode.startsWith(basePrefix);
};

export const displayUacs = (uacsCode, sublineItem) => {
  return shouldHideGenericOtherUacs(uacsCode, sublineItem) ? '' : (uacsCode || '—');
};

export const getIndentLevelFromSubline = (sublineItem, uacsCode = '') => {
  if (!sublineItem && !uacsCode) return 0;
  const base = UACS_OTHER_MOOE_BASE;
  // Indent if subline is a child variant like 'Other Maintenance and Operating Expenses - Meals & Snacks'
  if (sublineItem && sublineItem.startsWith(base) && sublineItem.trim() !== base) return 1;
  // Or indent if uacsCode is a variant (like 5-02-99-990-1) under Other Maintenance and Operating Expenses
  if (uacsCode && uacsCode.startsWith('5-02-99-990-')) return 1;
  return 0;
};

export default {
  shouldHideGenericOtherUacs,
  displayUacs,
  getIndentLevelFromSubline,
};
