export default function formatCurrency(amount) {
  const amountNumber = Number(amount); // Use Number() to preserve decimals
  return (
    "₱" +
    amountNumber.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}
