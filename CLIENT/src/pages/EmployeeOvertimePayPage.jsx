import React from "react";
import CustomPage from "../components/overtimepay/OvertimePayCustomPage";

const EmployeeOvertimePayPage = () => {
  const schema = {
    employeeNumber: {
      type: "text",
      label: "Employee Number",
    },
    employeeFullName: {
      type: "text",
      label: "Full Name",
      show: true,
      searchable: true,
    },
    positionTitle: {
      type: "text",
      label: "Position Title",
    },
    weekdayHours: {
      type: "text",
      label: "Weekday Hours",
      show: true,
    },
    weekendHours: {
      type: "text",
      label: "Weekend Hours",
      show: true,
    },
    amount: {
      type: "number",
      label: "Overtime Pay Amount",
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
    },
    processDate: {
      type: "date",
      label: "Processed Date",
    },
    fiscalYear: {
      type: "text",
      label: "Fiscal Year",
    },
    createdAt: {
      type: "date",
      label: "Created At",
    },
    action: {
      type: "action",
      label: "Actions",
      show: true,
    },
  };

  return (
    <CustomPage
      dataListName="overtime-pay"
      schema={schema}
      hasAdd={false}  // Using inline addition and editing
      hasEdit={false} // Inline editing is handled in the table rows
      hasDelete={true}
      title="Overtime Pay Management"
      description="Manage employee overtime pay records and allowances"
    />
  );
};

export default EmployeeOvertimePayPage;
