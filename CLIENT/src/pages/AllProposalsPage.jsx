import React, { useRef } from "react";
import ProposalCustomPage from "../components/allproposals/ProposalCustomPage";
import TextSearchable from "../global/components/TextSearchable";
import { ViewButton, ApproveButton, ReturnButton } from "../components/allproposals/ProposalActions";

const AllProposalsPage = () => {
  const tableRef = useRef(null);

  const refreshData = () => {
    if (tableRef.current && typeof tableRef.current.refetch === "function") {
      tableRef.current.refetch();
    }
  };

  const proposalSchema = {
    cobExpenditures: {  // Changed from processBy to cobExpenditures
      type: "text",
      label: "EXPENDITURE TYPE",
      show: true,
    },
    region: {
      type: "text",
      label: "REGION",
      show: true,
    },
    fiscalYear: {
      type: "text",
      label: "FISCAL YEAR",
      show: true,
    },
    budgetType: {
      type: "text",
      label: "BUDGET TYPE",
      show: true,
    },
    submittedDate: {
      type: "date",
      label: "SUBMITTED DATE",
      show: true,
      customRender: (row) => {
        if (!row.submittedDate) return "N/A";
        return new Date(row.submittedDate).toLocaleDateString();
      }
    },
    totalExpenses: {
      type: "number",
      label: "TOTAL EXPENSES",
      show: true,
      customRender: (row) => (
        <TextSearchable columnName={(row.totalExpenses || 0).toLocaleString()} />
      ),
    },
    totalIncome: {
      type: "number",
      label: "TOTAL INCOME",
      show: true,
      customRender: (row) => (
        <TextSearchable columnName={(row.totalIncome || 0).toLocaleString()} />
      ),
    },
    status: {
      type: "text",
      label: "STATUS",
      show: true,
    },
    action: {
      type: "action",
      label: "ACTIONS",
      show: true,
    },
  };

  return (
    <ProposalCustomPage
      tableRef={tableRef}
      dataListName="proposals"
      schema={proposalSchema}
      hasEdit={false}
      hasDelete={false}
      hasAdd={false}
      additionalMenuOptions={[ViewButton, ApproveButton, ReturnButton]}
      refreshData={refreshData}
      title="All Proposals"
      description="View and manage all submitted proposals"
      apiPath="/proposals"
      groupBy="region" // Make sure this is being passed
    />
  );
};

export default AllProposalsPage;
