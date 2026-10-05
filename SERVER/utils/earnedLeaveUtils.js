/** Calculate leave monetization using the linked compensation's days and factor. */
function calculateEarnedLeaves(monthlySalary, settings = {}) {
  // Nullish defaults preserve an explicit zero-day budget and legacy zero rates.
  const days = settings.earnedLeaveDays ?? 30;
  const factor = settings.earnedLeaves ?? 0.0481927;
  return monthlySalary * days * factor;
}

module.exports = { calculateEarnedLeaves };
