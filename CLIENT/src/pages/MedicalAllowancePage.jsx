import React from "react";
import CustomPage from "../components/medicalallowance/MedicalAllowanceCustomPage";
import MedicalAllowanceDialog from "../components/medicalallowance/MedicalAllowanceDialog";

const MedicalAllowancePage = () => {
  const schema = {
    action: { type: "action", label: "Actions", show: true },
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
      label: "Number of Dependents", 
      show: true, 
      searchable: true 
    },
    amount: {
      type: "number",
      label: "Medical Allowance Amount",
      show: true,
      searchable: true,
      customRender: (row) => {
        const amount = parseFloat(row.amount) || 0;
        return (
          <span>
            {amount.toLocaleString("en-PH", {
              style: "currency",
              currency: "PHP",
            })}
          </span>
        );
      },
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
      dataListName="medical-allowance"
      schema={schema}
      hasAdd={true}
      hasEdit={false}
      hasDelete={true}
      customAddElement={
        <MedicalAllowanceDialog
          schema={schema}
          endpoint="/medical-allowance"
          dataListName="medical-allowance"
        />
      }
      additionalMenuOptions={[
        ({ row, endpoint, dataListName }) => (
          <MedicalAllowanceDialog
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

export default MedicalAllowancePage;
