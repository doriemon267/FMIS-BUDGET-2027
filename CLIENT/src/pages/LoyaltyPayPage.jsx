import React from "react";
import CustomPage from "../components/loyaltypay/LoyaltyPayCustomPage";
import LoyaltyPayDialog from "../components/loyaltypay/LoyaltyPayDialog";

const LoyaltyPayPage = () => {
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
    },
    division: {
      type: "text",
      label: "Division",
    },
    region: {
      type: "text",
      label: "Region",
    },
    yearsInService: {
      type: "text",
      label: "Years in Service",
      show: true,
    },
    budgetType: {
      type: "text",
      label: "Budget Type",
   
    },
    amount: {
      type: "number",
      label: "Amount",
      show: true,
      customRender: (row) =>
        `₱${(row.amount || 0).toLocaleString("en-PH", {
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
      searchable: true,
    },
    createdAt: {
      type: "date",
      label: "Created At",
    },
  };

  return (
    <CustomPage
      dataListName="loyalty-pay"
      schema={schema}
      hasAdd={true}
      hasEdit={false}
      hasDelete={true}
      hasClose={false}
      customAddElement={
        <LoyaltyPayDialog
          schema={schema}
          endpoint="/loyalty-pay"
          dataListName="loyalty-pay"
        />
      }
      additionalMenuOptions={[
        ({ row, endpoint, dataListName }) => (
          <LoyaltyPayDialog
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

export default LoyaltyPayPage;
