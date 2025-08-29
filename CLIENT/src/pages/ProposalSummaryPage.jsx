import React from "react";
import CustomPage from "../components/proposalsummary/PSCustomPage";
import TextSearchable from "../global/components/TextSearchable";
import PersonnelAggregates from "../components/proposalsummary/PersonnelAggregates";

const ProposalSummaryPage = () => {
  const proposalSchema = {
    type: {
      type: "text",
      label: "Type",
      required: true,
      searchable: true,
      show: true,
    },
    department: {
      type: "text",
      label: "Department",
      searchable: true,
      show: true,
    },
    region: {
      type: "text",
      label: "Region",
      searchable: true,
      show: true,
    },
    fiscal_year: {
      type: "number",
      label: "Fiscal Year",
      searchable: true,
    },
    status: {
      type: "text",
      label: "Status",
      searchable: true,
    },
    processBy: {
      type: "text",
      label: "Processed By",
      searchable: true,
    },
    processDate: {
      type: "date",
      label: "Process Date",
      show: true,
    },
    amount: {
      type: "number",
      label: "Amount",
      searchable: false,
      show: true,
      customRender: (row) => <TextSearchable columnName={row.amount} />,
    },
    action: {
      type: "action",
      label: "Actions",
    },
  };

  return (
    <div>
      <CustomPage dataListName="proposalsummary" schema={proposalSchema} />
      <PersonnelAggregates />
    </div>
  );
};

export default ProposalSummaryPage;
