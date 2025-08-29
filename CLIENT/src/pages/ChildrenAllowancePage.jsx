import React from "react";
import CustomPage from "../components/childrenallowance/ChildrenAllowanceCustomPage";
import ChildrenAllowanceDialog from "../components/childrenallowance/ChildrenAllowanceDialog";
import formatCurrency from "../utils/formatCurrency";

const ChildrenAllowancePage = () => {
  const schema = {
    action: { type: "action", label: "Actions" },
    employeeNumber: { 
      type: "text", 
      label: "Employee Number", 
     
      searchable: true 
    },
    employeeFullName: { 
      type: "text", 
      label: "Full Name", 
      show: true, 
      searchable: true 
    },
    positionTitle: { 
      type: "text", 
      label: "Position Title", 
      show: true, 
      searchable: true 
    },
    department: { 
      type: "text", 
      label: "Department", 
      show: true, 
      searchable: true 
    },
    division: { 
      type: "text", 
      label: "Division", 
      show: true, 
      searchable: true 
    },
    region: { 
      type: "text", 
      label: "Region", 
      show: true, 
      searchable: true 
    },
    noOfDependents: { 
      type: "text", 
      label: "No. of Dependents", 
      show: true, 
      searchable: true 
    },
    amount: {
      type: "number",
      label: "Amount (Annual)",
      show: true,
      searchable: true,
      customRender: (row) => {
        const annualAmount = parseFloat(row.amount) || 0;
        return (
          <span>
            {annualAmount.toLocaleString("en-PH", {
              style: "currency",
              currency: "PHP",
            })}
          </span>
        );
      },
    },
    fiscalYear: { type: "text", label: "Fiscal Year" },
  };

  return (
    <CustomPage
      dataListName="children-allowance"
      schema={schema}
      hasAdd={true}
      hasEdit={false}
      hasDelete={true}
      customAddElement={
        <ChildrenAllowanceDialog
          schema={schema}
          endpoint="/children-allowance"
          dataListName="children-allowance"
        />
      }
      additionalMenuOptions={[
        ({ row, endpoint, dataListName }) => (
          <ChildrenAllowanceDialog
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

export default ChildrenAllowancePage;