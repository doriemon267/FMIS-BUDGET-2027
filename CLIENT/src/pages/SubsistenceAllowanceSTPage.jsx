import React from "react";
import CustomPage from "../components/subsistenceallowancest/SubsistenceAllowanceCustomPage";
import TextSearchable from "../global/components/TextSearchable";
import SubsistenceAllowanceSTDialog from "../components/subsistenceallowancest/SubsistenceAllowanceSTDialog";

const SubsistenceAllowanceSTPage = () => {
  const schema = {
    action: {
      type: "action",
      label: "Actions",
    },
    employeeNumber: {
      type: "text",
      label: "Employee Number",
      searchable: true,
    },
    employeeFullName: {
      type: "text",
      label: "Full Name",
      required: true,
      searchable: true,
      show: true,
    },
    positionTitle: {
      type: "text",
      label: "Position Title",
      show: true,
      searchable: true,
    },
    department: {
      type: "text",
      label: "Department",
      show: true,
      searchable: true,
    },
    division: {
      type: "text",
      label: "Division",
      show: true,
      searchable: true,
    },
    region: {
      type: "text",
      label: "Region",
      show: true,
      searchable: true,
    },
    monthlySalary: {
      type: "number",
      label: "Monthly Salary",
      show: true,
    },
    actualExposureDays: {
      type: "text",
      label: "Exposure Days",
      show: true,
    },
    riskLevel: {
      type: "text",
      label: "Risk Level",
      show: true,
    },
    amount: {
      type: "number",
      label: "Hazard Allowance Amount",
      required: true,
      searchable: true,
      show: true,
      customRender: (row) =>
        `₱${(row.amount || 0).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
    },
    processBy: {
      type: "text",
      label: "Processed By",
      searchable: true,
    },
    processDate: {
      type: "date",
      label: "Processed Date",
    },
    fiscalYear: {
      type: "text",
      label: "Fiscal Year",
      searchable: true,
    },
    budgetType: {
      type: "text",
      label: "Budget Type",
    },
    createdAt: {
      type: "date",
      label: "Created At",
    },
  };

  return (
    <CustomPage
      dataListName="subsistence-allowance-st"
      schema={schema}
      hasAdd={true}
      hasEdit={false}
      hasDelete={true}
      customAddElement={
        <SubsistenceAllowanceSTDialog
          schema={schema}
          endpoint="/subsistence-allowance-st"
          dataListName="subsistence-allowance-st"
        />
      }
      additionalMenuOptions={[
        ({ row, endpoint, dataListName }) => (
          <SubsistenceAllowanceSTDialog
            row={row}
            schema={schema}
            endpoint={endpoint}
            dataListName={dataListName}
          />
        ),
      ]}
    />
  );
};

export default SubsistenceAllowanceSTPage;
