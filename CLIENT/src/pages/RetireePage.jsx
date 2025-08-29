import React from "react";
import CustomPage from "../components/retiree/RetireeCustomPage";
import RetireeDialog from "../components/retiree/RetireeDialog";

const RetireePage = () => {
  const schema = {
    action: {
      type: "action",
      label: "Actions",
    },
    employeeNumber: {
      type: "text",
      label: "Employee No.",
      searchable: true,
      show: true,
    },
    employeeFullName: {
      type: "text",
      label: "Employee Name",
      required: true,
      searchable: true,
      show: true,
    },
    positionTitle: {
      type: "text",
      label: "Position",
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
    },
    region: {
      type: "text",
      label: "Region",
      show: true,
    },
    retirementType: {
      type: "text",
      label: "Type",
      show: true,
      searchable: true,
    },
    dateOfRetirement: {
      type: "date",
      label: "Retirement Date",
      show: true,
    },
    terminalLeave: {
      type: "number",
      label: "Terminal Leave",
      show: true,
      customRender: (row) =>
        `₱${(row.terminalLeave || 0).toLocaleString("en-PH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
    },
    retirementGratuity: {
      type: "number",
      label: "Retirement Gratuity",
      show: true,
      customRender: (row) =>
        `₱${(row.retirementGratuity || 0).toLocaleString("en-PH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
    },
    total: {
      type: "number",
      label: "Total",
      show: true,
      customRender: (row) =>
        `₱${(row.total || 0).toLocaleString("en-PH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
    },
    createdAt: {
      type: "date",
      label: "Created At",
    },
  };

  return (
    <CustomPage
      dataListName="retiree"
      schema={schema}
      hasAdd={true}
      hasEdit={false}
      hasDelete={true}
      hasClose={false}
      customAddElement={
        <RetireeDialog
          schema={schema}
          endpoint="/retiree"
          dataListName="retiree"
        />
      }
      additionalMenuOptions={[
        ({ row, endpoint, dataListName }) => (
          <RetireeDialog
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

export default RetireePage;

