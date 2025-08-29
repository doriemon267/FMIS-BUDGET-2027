import React, { useRef } from "react";
import CustomPage from "../../src/components/myproposal/ProposalCustomPage";
import TextSearchable from "../global/components/TextSearchable";
import {
  ViewMenuItem,
  ApproveMenuItem,
  RejectMenuItem,
} from "../../src/components/myproposal/ProposalActions";

const AllProposalsPage = () => {
  const tableRef = useRef(null); // Reference to the CustomTable

  // Function to refresh the table data
  const refreshData = () => {
    if (tableRef.current) {
      tableRef.current.refetch();
    }
  };

  const proposalSchema = {
    action: {
      type: "action",
      label: "ACTIONS",
    },
    processBy: {
      type: "text",
      label: "SUBMITTED BY",
      searchable: true,
      show: true,
    },
    budgetType: {
      type: "text",
      label: "BUDGET TYPE",
      searchable: true,
      show: true,
    },
    region: {
      type: "text",
      label: "REGION",
      searchable: true,
      show: true,
    },
    fiscalYear: {
      type: "text",
      label: "FISCAL YEAR",
      show: true,
    },
    submittedDate: {
      type: "date",
      label: "SUBMITTED DATE",
      show: true,
    },
    cobExpenditures: {
      type: "text",
      label: "COB EXPENDITURES",
      show: true,
    },
    totalExpenses: {
      type: "number",
      label: "TOTAL EXPENSES",
      customRender: (row) => (
        <TextSearchable columnName={(row.totalExpenses || 0).toLocaleString()} />
      ),
      show: true,
    },
    totalIncome: {
      type: "number",
      label: "TOTAL INCOME",
      customRender: (row) => (
        <TextSearchable columnName={(row.totalIncome || 0).toLocaleString()} />
      ),
      show: true,
    },
    status: {
      type: "text",
      label: "STATUS",
      show: true,
    },
  };

  return (
    <CustomPage
      dataListName="proposals"
      schema={proposalSchema}
      hasEdit={false}
      hasDelete={false}
      additionalMenuOptions={[ViewMenuItem, ApproveMenuItem, RejectMenuItem]}
      refreshData={refreshData} // Pass the refreshData function
      tableRef={tableRef} // Pass the tableRef to CustomPage
    />
  );
};

export default AllProposalsPage;
