import React from "react";
import CustomPage from "../components/mealallowance/MealAllowanceCustomPage";
import MealAllowanceDialog from "../components/mealallowance/MealAllowanceDialog";
import formatCurrency from "../utils/formatCurrency";

const MealAllowancePage = () => {
  const schema = {
    action: { type: "action", label: "Actions" },
    employeeNumber: { type: "text", label: "Employee Number", searchable: true },
    employeeFullName: { type: "text", label: "Full Name", show: true, searchable: true },
    positionTitle: { type: "text", label: "Position Title", show: true, searchable: true },
    department: { type: "text", label: "Department", show: true, searchable: true },
    division: { type: "text", label: "Division", show: true, searchable: true },
    region: { type: "text", label: "Region", show: true, searchable: true },
    amount: {
      type: "number",
      label: "Meal Allowance (Annual)",
      show: true,
      searchable: true,
      customRender: (row) => {
        // Safely convert monthly amount to annual amount
        const monthlyAmount = parseFloat(row.amount) || 0;
        const annualAmount = monthlyAmount * 12;
        
        return (
          <span>
            {annualAmount.toLocaleString("en-PH", {
              style: "currency",
              currency: "PHP",
            })}
          </span>
        );
      }
    },
    processBy: { type: "text", label: "Processed By" },
    processDate: { type: "date", label: "Processed Date" },
    fiscalYear: { type: "text", label: "Fiscal Year" },
    budgetType: { type: "text", label: "Budget Type" },
    createdAt: { type: "date", label: "Created At" },
  };

  return (
    <CustomPage
      dataListName="meal-allowance"
      schema={schema}
      hasAdd={true}
      hasEdit={false}
      hasDelete={true}
      customAddElement={
        <MealAllowanceDialog
          schema={schema}
          endpoint="/meal-allowance"
          dataListName="meal-allowance"
        />
      }
      additionalMenuOptions={[
        ({ row, endpoint, dataListName }) => (
          <MealAllowanceDialog
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

export default MealAllowancePage;
