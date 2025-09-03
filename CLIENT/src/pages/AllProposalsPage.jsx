import React, { useRef } from "react";
import ProposalCustomPage from "../components/allproposals/ProposalCustomPage";
import TextSearchable from "../global/components/TextSearchable";
import { ViewButton, ApproveButton, ReturnButton } from "../components/allproposals/ProposalActions";
import { useUser } from "../context/UserContext";
import { Box, Button, Typography, Accordion, AccordionSummary, AccordionDetails } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import api from "../config/api";

const AllProposalsPage = () => {
  const tableRef = useRef(null);
  const { currentUser } = useUser();

  const refreshData = () => {
    if (tableRef.current && typeof tableRef.current.refetch === "function") {
      tableRef.current.refetch();
    }
  };

  // Debug function to test API access
  const testAPIAccess = async () => {
    try {
      console.log("🔍 Testing API access...");
      console.log("👤 Current user:", currentUser);
      
      // Test direct API call
      const response = await api.get("/proposals?limit=5");
      console.log("✅ API Response:", response.data);
      alert(`API accessible! Found ${response.data.proposals?.length || 0} proposals. Check console for details.`);
    } catch (error) {
      console.error("❌ API Error:", error);
      console.error("❌ Error response:", error.response?.data);
      alert(`API Error: ${error.response?.data?.message || error.message}. Check console for details.`);
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
    <>
      {/* Debug Section */}
      <Box sx={{ mb: 2, mx: 3, mt: 2 }}>
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">🔧 Debug Information</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="body2">
                <strong>User:</strong> {currentUser?.FirstName} {currentUser?.LastName} ({currentUser?.Username})
              </Typography>
              <Typography variant="body2">
                <strong>Roles:</strong> {JSON.stringify(currentUser?.Roles)}
              </Typography>
              <Typography variant="body2">
                <strong>Region:</strong> {currentUser?.Region}
              </Typography>
              <Button 
                variant="outlined" 
                onClick={testAPIAccess}
                size="small"
                sx={{ alignSelf: 'flex-start' }}
              >
                Test API Access
              </Button>
            </Box>
          </AccordionDetails>
        </Accordion>
      </Box>

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
    </>
  );
};

export default AllProposalsPage;
