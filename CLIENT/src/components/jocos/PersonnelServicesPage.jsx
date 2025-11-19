import React from "react";
import CustomPageTable from "./PersonnelCustomPageTable";

const COSPersonnelServicesPage = () => {
  // Enhanced table schema with better organization
  const cospersonnelSchema = {
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
    gradelevel_SG: {
      type: "text",
      label: "SG",
      show: true,
    },
    employeeFullName: {
      type: "text",
      label: "EMPLOYEE NAME",
      searchable: true,
      show: true,
    },
    employeeNumber: {
      type: "text",
      label: "EMPLOYEE NUMBER",
      show: true,
    },
    department: {
      type: "text",
      label: "DEPARTMENT",
      show: true,
    },
    region: {
      type: "text",
      label: "REGION",
      show: true,
    },
    division: {
      type: "text",
      label: "DIVISION",
      show: true,
    },
    monthlySalary: {
      type: "number",
      label: "MONTHLY SALARY",
      show: true,
      alignRight: true,
      customRender: (row) => row.monthlySalary ? `₱${row.monthlySalary.toLocaleString()}` : "₱0",
    },
    annualSalary: {
      type: "number",
      label: "ANNUAL SALARY",
      show: true,
      alignRight: true,
      customRender: (row) => row.annualSalary ? `₱${row.annualSalary.toLocaleString()}` : "₱0",
    },
    subsidyEligible: {
      type: "text",
      label: "SUBSIDY TAG",
      show: false,
      customRender: (row) => (row.subsidyEligible ? "Tagged" : "—"),
    },
    subsidyAmount: {
      type: "number",
      label: "PROJECTED SUBSIDY",
      show: false,
      alignRight: true,
      customRender: (row) =>
        row.subsidyEligible
          ? `₱${(Number(row.subsidyAmount) || 0).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`
          : "—",
    },
    Total: {
      type: "number",
      label: "TOTAL",
      show: true,
      alignRight: true,
      customRender: (row) => row.Total ? `₱${row.Total.toLocaleString()}` : "₱0",
    },
    // Hidden fields for filtering/processing
    budgetType: {
      type: "text",
      label: "BUDGET TYPE",
      show: false,
    },
    processBy: {
      type: "text",
      label: "PROCESSED BY",
      show: false,
    },
    processDate: {
      type: "date",
      label: "PROCESS DATE",
      show: false,
    },
    fiscalYear: {
      type: "text",
      label: "FISCAL YEAR",
      show: false,
    },
  };

  return (
    <CustomPageTable
      dataListName="cosPersonnels"
      title="COS Personnel Services"
      description="This is the COS Personnel Services Table"
      schema={cospersonnelSchema}
      searchable={true}
      hasEdit={true}
      hasDelete={false}
      hasAdd={true}
      ROWS_PER_PAGE={10}
    />
  );
};

export default COSPersonnelServicesPage;
