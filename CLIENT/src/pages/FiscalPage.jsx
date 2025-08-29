import React from "react";
import CustomPage from "../../src/components/fiscalyear/FiscalYearDialog";
import TextSearchable from "../global/components/TextSearchable";

const FiscalPage = () => {
  const fiscalSchema = {
    year: {
      type: "text",
      label: "Fiscal Year",
      required: true,
      searchable: true,
      show: true,
    },
    description: {
      type: "textarea",
      label: "Description",
      searchable: true,
      show: true,
    },
    budget: {
      type: "number",
      label: "Budget",
      default: 0,
      customRender: (row) => <TextSearchable columnName={row.budget} />,
      show: true,
    },
    isActive: {
      type: "boolean",
      label: "Active",
      default: true,
      show: true,
    },
    createdAt: {
      type: "date",
      label: "Created At",
      show: true,
    },
    action: {
      type: "action",
      label: "Actions",
    },
  };

  return <CustomPage dataListName="fiscalYears" schema={fiscalSchema} />;
};

export default FiscalPage;