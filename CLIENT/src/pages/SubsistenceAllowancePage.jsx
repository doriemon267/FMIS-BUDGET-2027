import React from "react";
import CustomPage from "../components/subsistenceallowance/SubsistenceAllowanceCustomPage";
import SubsistenceAllowanceDialog from "../components/subsistenceallowance/SubsistenceAllowanceDialog";

const SubsistenceAllowancePage = () => {
  const schema = {
    action: { type: "action", label: "Actions" },
    employeeNumber: { type: "text", label: "Employee Number", searchable: true },
    employeeFullName: { type: "text", label: "Full Name", required: true, searchable: true, show: true },
    positionTitle: { type: "text", label: "Position Title", show: true, searchable: true },
    department: { type: "text", label: "Department", show: true, searchable: true },
    division: { type: "text", label: "Division", show: true, searchable: true },
    region: { type: "text", label: "Region", show: true, searchable: true },
    noOfHrsPerDay: { type: "number", label: "No. of Hrs/Day", searchable: true, show: true },
    monthlyAmount: { type: "number", label: "AMOUNT (Monthly)", searchable: true, show: true },
    Amount: { type: "number", label: "AMOUNT (Annual)", required: true, searchable: true, show: true },
    processBy: { type: "text", label: "Processed By", searchable: true },
    processDate: { type: "date", label: "Processed Date" },
    fiscalYear: { type: "text", label: "Fiscal Year", searchable: true },
    budgetType: { type: "text", label: "Budget Type" },
    createdAt: { type: "date", label: "Created At" },
  };

  return (
    <CustomPage
      dataListName="subsistence-allowance"
      schema={schema}
      hasAdd={true}
      hasEdit={false}
      hasDelete={true}
      customAddElement={
        <SubsistenceAllowanceDialog
          schema={schema}
          endpoint="/subsistence-allowance"
          dataListName="subsistence-allowance"
        />
      }
      additionalMenuOptions={[
        ({ row, endpoint, dataListName }) => (
          <SubsistenceAllowanceDialog
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

export default SubsistenceAllowancePage;
