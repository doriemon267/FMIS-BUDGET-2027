import React, { useRef, useState, useEffect } from "react";
import ProposalCustomPage from "../components/allproposals/ProposalCustomPage";
import TextSearchable from "../global/components/TextSearchable";
import { ViewButton, ApproveButton, ReturnButton } from "../components/allproposals/ProposalActions";
import { useUser } from "../context/UserContext";
import { 
  Box, 
  Button, 
  Typography, 
  Accordion, 
  AccordionSummary, 
  AccordionDetails,
  Grid,
  Card,
  CardContent,
  CircularProgress
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import MonetizationOnIcon from "@mui/icons-material/MonetizationOn";
import PaymentsIcon from '@mui/icons-material/Payments';
import { FaPesoSign } from "react-icons/fa6";
import AssessmentIcon from "@mui/icons-material/Assessment";
import api from "../config/api";

const AllProposalsPage = () => {
  const tableRef = useRef(null);
  const { currentUser } = useUser();
  const [stats, setStats] = useState({
    totalProposals: 0,
    totalProjectedCorporateIncome: 0,
    totalProjectedSubsidy: 0,
    totalProposedBudget: 0,
    loading: true
  });

  const refreshData = () => {
    if (tableRef.current && typeof tableRef.current.refetch === "function") {
      tableRef.current.refetch();
    }
    fetchStats(); // Refresh stats when data is refreshed
  };

  // Fetch statistics data
  const fetchStats = async () => {
    try {
      setStats(prev => ({ ...prev, loading: true }));
      const response = await api.get("/proposals");
      
      if (response.data && response.data.proposals) {
        const proposals = response.data.proposals;
        
        const totalProposals = proposals.length;
        const totalProjectedCorporateIncome = proposals.reduce((sum, proposal) => 
          sum + (proposal.totalIncome || 0), 0);
        const totalProjectedSubsidy = proposals.reduce((sum, proposal) => 
          sum + (proposal.totalExpenses || 0), 0);
        const totalProposedBudget = totalProjectedCorporateIncome + totalProjectedSubsidy;
        
        setStats({
          totalProposals,
          totalProjectedCorporateIncome,
          totalProjectedSubsidy,
          totalProposedBudget,
          loading: false
        });
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
      setStats(prev => ({ ...prev, loading: false }));
    }
  };

  // Fetch stats on component mount
  useEffect(() => {
    fetchStats();
  }, []);

  // Debug function to test API access
  const testAPIAccess = async () => {
    try {
      // Test direct API call
      const response = await api.get("/proposals?limit=5");
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
    totalIncome: {
      type: "number",
      label: "PROJECTED CORPORATE INCOME",
      show: true,
      customRender: (row) => (
        <TextSearchable columnName={`₱${(row.totalIncome || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
      ),
    },
    totalExpenses: {
      type: "number",
      label: "PROJECTED SUBSIDY",
      show: true,
      customRender: (row) => (
        <TextSearchable columnName={`₱${(row.totalExpenses || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
      ),
    },
    proposedBudget: {
      type: "number",
      label: "PROPOSED BUDGET",
      show: true,
      customRender: (row) => {
        const corporateIncome = row.totalIncome || 0;
        const subsidy = row.totalExpenses || 0;
        const total = corporateIncome + subsidy;
        return <TextSearchable columnName={`₱${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />;
      },
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

  // Stats Card Component
  const StatsCard = ({ title, value, icon, color = "primary" }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography color="textSecondary" gutterBottom variant="overline">
              {title}
            </Typography>
            <Typography variant="h4" component="div" color={color}>
              {stats.loading ? (
                <CircularProgress size={24} />
              ) : (
                value
              )}
            </Typography>
          </Box>
          <Box sx={{ color: `${color}.main` }}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <>
      {/* Statistics Section */}
      <Box sx={{ mb: 3, mx: 3, mt: 2 }}>
        <Typography variant="h5" gutterBottom sx={{ mb: 3, fontWeight: 'bold' }}>
          📊 Proposals Overview
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <StatsCard
              title="Total Proposals"
              value={stats.totalProposals}
              icon={<AssessmentIcon sx={{ fontSize: 40 }} />}
              color="primary"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatsCard
              title="Total Projected Corporate Income"
              value={`₱${stats.totalProjectedCorporateIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              icon={<AccountBalanceIcon sx={{ fontSize: 40 }} />}
              color="success"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatsCard
              title="Total Projected Subsidy"
              value={`₱${stats.totalProjectedSubsidy.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              icon={<PaymentsIcon sx={{ fontSize: 40 }} />}
              color="warning"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatsCard
              title="Total Proposed Budget"
              value={`₱${stats.totalProposedBudget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              icon={<TrendingUpIcon sx={{ fontSize: 40 }} />}
              color="error"
            />
          </Grid>
        </Grid>
      </Box>

      {/* Debug Section */}
      {/* <Box sx={{ mb: 2, mx: 3, mt: 2 }}>
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
      </Box> */}

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
