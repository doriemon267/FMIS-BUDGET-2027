/**
 * Round to 2 decimal places for all monetary totals.
 * Avoids floating-point errors that produce 3+ decimals (e.g. 12345.678901234).
 */
const roundTo2Decimals = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

module.exports = { roundTo2Decimals };
