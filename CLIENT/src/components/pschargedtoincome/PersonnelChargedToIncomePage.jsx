import React from "react";
import PersonnelChargedToIncomeTable from "./PersonnelChargedToIncomeTable";

const PersonnelChargedToIncomePage = ({ dataListName, proposalId }) => {
  // Use a unique cache key for charged-to-income queries - append "ChargedToIncome" to distinguish from regular personnel queries
  const chargedToIncomeCacheKey = dataListName ? `${dataListName}_ChargedToIncome` : "personnelServices_ChargedToIncome";
  
  // For PersonnelChargedToIncome, we ALWAYS use the personnel schema, not the passed schema
  // The passed schema might be for a different entity type (like proposals/tests)
  const personnelServicesSchema = {
    action: {
      type: "action",
      label: "ACTIONS",
    },
    employeeFullName: {
      type: "text",
      label: "EMPLOYEE NAME",
      searchable: true,
      show: true,
    },
    positionTitle: {
      type: "text",
      label: "POSITION TITLE",
      searchable: true,
      show: true,
    },
    statusOfAppointment: {
      type: "text",
      label: "STATUS OF APPOINTMENT",
      show: false,
    },
    gradelevel_SG: {
      type: "text",
      label: "SG",
      show: true,
    },
    step: {
      type: "text",
      label: "STEP",
      show: true,
    },
    gradelevel_JG: {
      type: "text",
      label: "JG",
      show: true,
    },
    noOfDependent: {
      type: "number",
      label: "NO. OF DEPENDENTS",
      show: true,
      customRender: (row) => row.noOfDependent || 0,
    },
    monthlySalary: {
      type: "number",
      label: "MONTHLY SALARY",
      show: true,
    },
    medical: {
      type: "number",
      label: "MEDICAL ALLOWANCE",
      show: true,
    },
    childrenAllowance: {
      type: "number",
      label: "CHILDREN ALLOWANCE",
      show: true,
    },
    meal: {
      type: "number",
      label: "MEAL ALLOWANCE",
      show: true,
    },
    subsistenceAllowanceMDS: {
      type: "number",
      label: "SUBSISTENCE ALLOWANCE MDS",
      show: true,
    },
    subsistenceAllowanceST: {
      type: "number",
      label: "SUBSISTENCE ALLOWANCE ST",
      show: true,
    },
    loyaltyAward: {
      type: "number",
      label: "LOYALTY AWARD",
      show: true,
    },
    overtimePay: {
      type: "number",
      label: "OVERTIME PAY",
      show: true,
    },
    cpcs1MonthlySalary: { type: "number", label: "CPCS 1 MONTHLY / SUBSIDY", show: true, readOnly: true },
    cpcs2MonthlySalary: { type: "number", label: "CPCS 2 MONTHLY", show: true, readOnly: true },
    monthlySalaryIncrement: {
      type: "number",
      label: "MONTHLY INCREASE / INCOME",
      readOnly: true,
      show: true,
      default: 0,
      customRender: (row) => (Number(row.monthlySalaryIncrement) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    },
    annualSalary: {
      type: "number",
      label: "ANNUAL SALARY",
      show: true,
    },
    RATA: {
      type: "number",
      label: "RATA",
      show: true,
    },
    PERA: {
      type: "number",
      label: "PERA",
      show: true,
    },
    uniformALLOWANCE: {
      type: "number",
      label: "UNIFORM ALLOWANCE",
      show: true,
    },
    productivityIncentive: {
      type: "number",
      label: "PRODUCTIVITY INCENTIVE",
      show: true,
    },
    honoraria: {
      type: "number",
      label: "HONORARIA",
      show: true,
    },
    hazardPay: {
      type: "number",
      label: "HAZARD PAY",
      show: true,
    },
    cashGift: {
      type: "number",
      label: "CASH GIFT",
      show: true,
    },
    midyearBonus: {
      type: "number",
      label: "MIDYEAR BONUS",
      show: true,
    },
    yearEndBonus: {
      type: "number",
      label: "YEAR END BONUS",
      show: true,
    },
    gsisPremium: {
      type: "number",
      label: "GSIS PREMIUM",
      show: true,
    },
    pagibigPremium: {
      type: "number",
      label: "PAG-IBIG PREMIUM",
      show: true,
    },
    philhealthPremium: {
      type: "number",
      label: "PHILHEALTH PREMIUM",
      show: true,
    },
    employeeCompensation: {
      type: "number",
      label: "EMPLOYEE COMPENSATION",
      show: true,
    },
    courtAppearance: {
      type: "number",
      label: "COURT APPEARANCE",
      show: true,
    },
    earnedLeaves: {
      type: "number",
      label: "EARNED LEAVES",
      show: true,
    },
    retirementBenefits: {
      type: "number",
      label: "RETIREMENT BENEFITS",
      show: true,
    },
    terminalLeave: {
      type: "number",
      label: "TERMINAL LEAVE",
      show: true,
    },
    subsidyEligible: {
      type: "text",
      label: "SUBSIDY TAG",
      show: false,
      customRender: (row) => (row.subsidyEligible ? "Tagged" : "—"),
    },
    subsidyAmount: {
      type: "number",
      label: "SUBSIDY (₱)",
      show: false,
      customRender: (row) =>
        row.subsidyEligible
          ? (Number(row.subsidyAmount) || 0).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : "—",
    },
    chargedToIncomeMonthlyAmount: {
      type: "number",
      label: "MONTHLY INCOME ALLOCATION",
      show: true,
    },
    chargedToIncomeAmount: {
      type: "number",
      label: "ANNUAL INCOME ALLOCATION",
      show: true,
    },
    chargedToSubsidyAmount: {
      type: "number",
      label: "SUBSIDY BALANCE",
      show: true,
    },
    Total: {
      type: "number",
      label: "SUBTOTAL",
      show: true,
    },
  };

  return (
    <PersonnelChargedToIncomeTable
      dataListName={chargedToIncomeCacheKey}
      title="Personnel Services - Charged to Income"
      description="Personnel tagged as Charged to Income"
      schema={personnelServicesSchema}
      searchable={true}
      hasEdit={true}
      hasDelete={false}
      ROWS_PER_PAGE={10}
      proposalId={proposalId}
    />
  );
};

export default PersonnelChargedToIncomePage;
