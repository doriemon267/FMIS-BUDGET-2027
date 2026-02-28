/**
 * Round to 2 decimal places. Use for all monetary totals to avoid 3+ decimals.
 */
export const roundTo2Decimals = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

export default function formatCurrency(amount) {
  const amountNumber = roundTo2Decimals(amount);
  return (
    "₱" +
    amountNumber.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}
