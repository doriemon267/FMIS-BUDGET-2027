import React from "react";
import PSCasualCustomPageTable from "./PersonnelCustomPageTable";

const PersonnelCasualServicesPage = () => {
  const personnelServicesSchema = {
    action: {
      type: "action",
      label: "ACTIONS",
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
    employeeFullName: {
      type: "text",
      label: "EMPLOYEE NAME",
      searchable: true,
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
    subsistenceAllowance: {
      type: "number",
      label: "SUBSISTENCE ALLOWANCE",
      show: true,
    },
    annualSalary: {
      type: "number",
      label: "ANNUAL SALARY",
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
    medical: {
      type: "number",
      label: "MEDICAL ALLOWANCE",
      show: true,
    },
    additionalMedical: {
      type: "number",
      label: "ADDITIONAL MEDICAL",
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
      label: "PG (PAG-IBIG)",
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
    loyaltyAward: {
      type: "number",
      label: "LOYALTY AWARD",
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
    Total: {
      type: "number",
      label: "SUBTOTAL",
      show: true,
    },
  };

  return (
    <PSCasualCustomPageTable
      dataListName="personnelServices" // Ang API endpoint ay "/personnelServices"
      title="Personnel Casual Services"
      description="This is the Personnel Casual Services Table"
      schema={personnelServicesSchema}
      searchable={true}
      hasEdit={true}
      hasDelete={false}
      ROWS_PER_PAGE={10}
    />
  );
};

export default PersonnelCasualServicesPage;
