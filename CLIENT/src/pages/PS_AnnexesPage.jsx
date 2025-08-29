import React from "react";
import PS_AnnexesCustomPage from "../components/ps_annexes/PS_AnnexesCustompage";
import TextSearchable from "../global/components/TextSearchable";

const PS_AnnexesPage = () => {
  const psAnnexesSchema = {
    action: {
      type: "action",
      label: "ACTIONS",
    },

    annexName: {
      type: "text",
      label: "ANNEX",
      required: true,
      show: true,
    },

    employeeFullName: {
      type: "text",
      label: "EMPLOYEE FULL NAME",
      required: true,
      searchable: true,
      show: true,
    },
    positionTitle: {
      type: "text",
      label: "POSITION TITLE",
      required: true,
      searchable: true,
      show: true,
    },
    Department: {
      type: "text",
      label: "DEPARTMENT",

      searchable: true,
      show: true,
    },
    Division: {
      type: "text",
      label: "DIVISION",

      searchable: true,
      show: true,
    },
    Amount: {
      type: "number",
      label: "AMOUNT",
      required: true,
      show: true,
    },
  };
  return (
    <PS_AnnexesCustomPage
      dataListName="ps_annexes"
      schema={psAnnexesSchema}
      title="PERSONNEL SERVICE REFERENCES"
      
      buttonLabel="Add Personnel Service Reference"
      subtitle="List of Personnel Service References"
    />
  );
};

export default PS_AnnexesPage;
