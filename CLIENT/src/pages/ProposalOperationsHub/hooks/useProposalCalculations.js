import { useCallback, useMemo } from "react";

// Sum Other Compensation from personnel row (for PS tab display)
export const getOtherCompensation = (p) =>
  (Number(p?.uniformALLOWANCE) || 0) +
  (Number(p?.productivityIncentive) || 0) +
  (Number(p?.medical) || 0) +
  (Number(p?.additionalMedical) || 0) +
  (Number(p?.childrenAllowance) || 0) +
  (Number(p?.meal) || 0) +
  (Number(p?.cashGift) || 0) +
  (Number(p?.subsistenceAllowance) || 0) +
  (Number(p?.subsistenceAllowanceMDS) || 0) +
  (Number(p?.subsistenceAllowanceST) || 0) +
  (Number(p?.midyearBonus) || 0) +
  (Number(p?.yearEndBonus) || 0) +
  (Number(p?.loyaltyAward) || 0) +
  (Number(p?.overtimePay) || 0) +
  (Number(p?.earnedLeaves) || 0) +
  (Number(p?.retirementBenefits) || 0) +
  (Number(p?.terminalLeave) || 0) +
  (Number(p?.courtAppearance) || 0);

// Sum Government Share from personnel row (for PS tab display)
export const getGovernmentShare = (p) =>
  (Number(p?.gsisPremium) || 0) +
  (Number(p?.providentFund) || 0) +
  (Number(p?.philhealthPremium) || 0) +
  (Number(p?.pagibigPremium) || 0) +
  (Number(p?.employeeCompensation) || 0);

export const useProposalCalculations = () => {
  // Calculate projected subsidy from MOOE + Personnel Services + Capital Outlay
  const calculateProjectedSubsidy = useCallback((proposalDetails, selectedProposal) => {
    // If we have detailed line items, compute from them (subsidy-only fields)
    if (proposalDetails) {
      let total = 0;

      // MOOE subsidy
      if (proposalDetails.mooe?.length) {
        total += proposalDetails.mooe.reduce((sum, item) => {
          const val = Number(item.subsidy || item.totalSubsidy || 0);
          return sum + (isNaN(val) ? 0 : val);
        }, 0);
      }

      // Personnel Services subsidy
      // Align with Personnel Services table and BudgetarySupportTable:
      // only NON charged-to-income personnel are counted as subsidy.
      if (proposalDetails.personnel?.length) {
        const sameDivision = selectedProposal?.division
          ? proposalDetails.personnel.filter(
              (p) => p.division === selectedProposal.division && p.chargedToIncomeEligible !== true
            )
          : proposalDetails.personnel.filter((p) => p.chargedToIncomeEligible !== true);

        total += sameDivision.reduce((sum, item) => {
          return sum + (Number(item.Total) || 0);
        }, 0);
      }

      // Capital Outlay subsidy only (no income)
      if (proposalDetails.capitalOutlay?.length) {
        total += proposalDetails.capitalOutlay.reduce((sum, item) => {
          const val = Number(item.subsidy || item.totalSubsidy || 0);
          return sum + (isNaN(val) ? 0 : val);
        }, 0);
      }

      return total;
    }

    // Fallbacks when details are not yet loaded: use backend-calculated subsidy, else total expenses, else amount
    return Number(
      selectedProposal?.projectedSubsidy ??
        selectedProposal?.totalExpenses ??
        selectedProposal?.amount ??
        0
    );
  }, []);

  // Calculate projected income from PS Charged + MOOE Income + CO Income (excluding Corporate Income)
  const calculateProjectedIncome = useCallback((proposalDetails, selectedProposal) => {
    // If we have detailed line items, compute from them
    if (proposalDetails) {
      let total = 0;

      // NOTE: Corporate Income (Income model) is NOT included in Projected Income

      // Personnel Services Charged to Income
      if (proposalDetails.personnel?.length) {
        const sameDivision = selectedProposal?.division
          ? proposalDetails.personnel.filter((p) => p.division === selectedProposal.division)
          : proposalDetails.personnel;
        total += sameDivision.reduce(
          (sum, item) => sum + (Number(item.chargedToIncomeAmount) || 0),
          0
        );
      }

      // MOOE Income
      if (proposalDetails.mooe?.length) {
        total += proposalDetails.mooe.reduce((sum, item) => sum + (Number(item.income) || 0), 0);
      }

      // Capital Outlay Income
      if (proposalDetails.capitalOutlay?.length) {
        total += proposalDetails.capitalOutlay.reduce(
          (sum, item) => sum + (Number(item.income) || 0),
          0
        );
      }

      return total;
    }

    // Fallback to backend value
    return Number(selectedProposal?.projectedCorporateIncome || 0);
  }, []);

  const getAuthoritativeProjectedIncome = useCallback((selectedProposal, proposalDetails) => {
    return Number(
      selectedProposal?.projectedCorporateIncome ??
        calculateProjectedIncome(proposalDetails, selectedProposal) ??
        0
    );
  }, [calculateProjectedIncome]);

  const getAuthoritativeProjectedSubsidy = useCallback((selectedProposal, proposalDetails) => {
    return Number(
      selectedProposal?.projectedSubsidy ??
        selectedProposal?.totalExpenses ??
        calculateProjectedSubsidy(proposalDetails, selectedProposal) ??
        0
    );
  }, [calculateProjectedSubsidy]);

  const getAuthoritativeProposedBudget = useCallback((selectedProposal, proposalDetails) => {
    return Number(
      selectedProposal?.proposedBudget ??
        getAuthoritativeProjectedIncome(selectedProposal, proposalDetails) +
          getAuthoritativeProjectedSubsidy(selectedProposal, proposalDetails)
    );
  }, [getAuthoritativeProjectedIncome, getAuthoritativeProjectedSubsidy]);

  const calculateTotalBudget = useCallback((selectedProposal, proposalDetails) => {
    return getAuthoritativeProposedBudget(selectedProposal, proposalDetails);
  }, [getAuthoritativeProposedBudget]);

  // Helper function to calculate displayed amounts for any proposal in the table
  const getDisplayAmounts = useCallback((proposal) => {
    // CRITICAL: Always use backend-calculated projectedSubsidy and proposedBudget
    // The backend calculations are authoritative and properly exclude charged-to-income
    return {
      projectedSubsidy: Number(proposal?.projectedSubsidy ?? proposal?.totalExpenses ?? 0),
      proposedBudget: Number(proposal?.proposedBudget ?? proposal?.amount ?? 0),
    };
  }, []);

  return useMemo(() => ({
    calculateProjectedSubsidy,
    calculateProjectedIncome,
    getAuthoritativeProjectedIncome,
    getAuthoritativeProjectedSubsidy,
    getAuthoritativeProposedBudget,
    calculateTotalBudget,
    getDisplayAmounts,
    getOtherCompensation,
    getGovernmentShare,
  }), [
    calculateProjectedSubsidy,
    calculateProjectedIncome,
    getAuthoritativeProjectedIncome,
    getAuthoritativeProjectedSubsidy,
    getAuthoritativeProposedBudget,
    calculateTotalBudget,
    getDisplayAmounts
  ]);
};

