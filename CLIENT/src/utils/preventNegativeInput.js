/**
 * Prevent minus sign and other characters that would allow negative numbers.
 * Use onKeyDown for numeric inputs (amount, subsidy, cost, income, etc.).
 */

/**
 * Blocks key if it would produce a negative value.
 * Call: onKeyDown={preventNegativeNumericKey}
 * @param {React.KeyboardEvent} e
 */
export function preventNegativeNumericKey(e) {
  const key = e.key;
  // Block minus, plus (optional), and 'e'/'E' (scientific notation, can produce negative exponent)
  if (key === '-' || key === '+' || key === 'e' || key === 'E') {
    e.preventDefault();
    return;
  }
}

/**
 * Sanitize string so it never represents a negative number.
 * Use in onChange when parsing: if result would be negative, treat as 0 or ignore.
 * @param {string} value - Raw input value (e.g. with commas)
 * @returns {number} Non-negative number
 */
export function toNonNegativeNumber(value) {
  if (value === '' || value === null || value === undefined) return 0;
  const cleaned = String(value).replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  if (Number.isNaN(num)) return 0;
  return num < 0 ? 0 : num;
}

export default preventNegativeNumericKey;
