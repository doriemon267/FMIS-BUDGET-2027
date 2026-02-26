/**
 * Generate next Employee Number for a given prefix (e.g. V for VACANT, E for regular).
 * Queries the given model for max existing prefix in the same fiscalYear (and optionally region).
 * @param {Model} model - Mongoose model (EmployeeMaster or EmployeeList)
 * @param {string} prefix - Single letter prefix (e.g. 'V', 'E')
 * @param {string} fiscalYear - Fiscal year
 * @param {string} [region] - Optional region to scope the max query
 * @returns {Promise<string>} e.g. "V00001" or "E00001"
 */
async function getNextEmployeeNumberWithPrefix(model, prefix, fiscalYear, region) {
  const p = (prefix || 'E').toUpperCase().charAt(0);
  const regex = new RegExp(`^${p}\\d{5}$`, 'i');
  const query = {
    EmployeeID: regex,
    fiscalYear: fiscalYear != null ? String(fiscalYear) : undefined
  };
  if (region && String(region).trim()) query.Region = new RegExp(`^${String(region).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
  const last = await model.findOne(query).sort({ EmployeeID: -1 }).select('EmployeeID').lean();
  const nextNum = last && last.EmployeeID
    ? (parseInt(String(last.EmployeeID).replace(/^[A-Z]/i, ''), 10) + 1)
    : 1;
  return p + String(nextNum).padStart(5, '0');
}

/** VACANT: V + 5 digits (e.g. V00001). */
async function getNextVacantEmployeeNumber(model, fiscalYear, region) {
  return getNextEmployeeNumberWithPrefix(model, 'V', fiscalYear, region);
}

/** Regular employees without number: E + 5 digits (e.g. E00001). */
async function getNextRegularEmployeeNumber(model, fiscalYear, region) {
  return getNextEmployeeNumberWithPrefix(model, 'E', fiscalYear, region);
}

module.exports = {
  getNextVacantEmployeeNumber,
  getNextRegularEmployeeNumber,
  getNextEmployeeNumberWithPrefix
};
