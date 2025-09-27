import React, { useRef, useState, useEffect } from "react";
import ProposalCustomPage from "../components/allproposals/ProposalCustomPage";
import TextSearchable from "../global/components/TextSearchable";
import { ViewButton } from "../components/allproposals/ProposalActions";
import WorkflowActions from "../components/workflow/WorkflowActions";
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
import { toast } from "react-toastify";
import api from "../config/api";

const AllProposalsPage = () => {
  const tableRef = useRef(null);
  const { currentUser } = useUser();
  const [submittingAll, setSubmittingAll] = useState(false);
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

  // Helper: map COB to entity key used by submission workflow
  const mapCobToEntity = (cob) => {
    if (!cob) return 'personnel';
    const s = String(cob).toLowerCase();
    if (s.includes('personnel')) return 'personnel';
    if (s.includes('mooe')) return 'mooe';
    if (s.includes('capital')) return 'capital';
    if (s.includes('income') || s.includes('corporate')) return 'income';
    return 'personnel';
  };

  // Submit all Drafts for the current scope per expenditure row
  const handleSubmitAllDrafts = async () => {
    try {
      setSubmittingAll(true);
      // Ask table for current rows (ProposalCustomPage should expose getRows() via ref, else fallback to fetch)
      const rows = (tableRef.current && typeof tableRef.current.getRows === 'function')
        ? await tableRef.current.getRows()
        : null;

      if (!rows || rows.length === 0) {
        toast.error('No rows found to submit.');
        return;
      }

      const scope = currentUser?.hierarchicalAccess?.scope;
      const roles = currentUser?.hierarchicalAccess?.workflowRoles || [];

      for (const row of rows) {
        if (row.status !== 'Draft') continue;
        const entity = mapCobToEntity(row.cobExpenditures);
        // Build params identical to ProposalActions fetchIdsForRow
        const params = {
          fiscalYear: row.fiscalYear,
          budgetType: row.budgetType,
          processBy: row.processBy,
          region: row.region,
        };
        let url = '';
        switch (entity) {
          case 'personnel': url = '/getpersonnels/byParams'; break;
          case 'mooe': url = '/mooe/getByParams'; break;
          case 'capital': url = '/capital-outlay/getByParams'; break;
          case 'income': url = '/income/getByParams'; break;
          default: url = '/getpersonnels/byParams';
        }
        const resp = await api.get(url, { params });
        const list = Array.isArray(resp.data) ? resp.data : (resp.data?.data || []);
        const ids = list.filter(i => String(i.status).toLowerCase() === 'draft').map(i => i._id).filter(Boolean);
        if (!ids.length) continue;

        // Choose endpoint based on scope (reuse same behavior as SubmitDraftButton)
        let endpoint = '';
        let successMessage = '';
        if (scope === 'RESPONSIBILITY_CENTER' && roles.includes('responsibilityCenterCreator')) {
          endpoint = '/api/submission-workflow/responsibility-center/submit-to-office';
          successMessage = 'Submitted to Office';
        } else if (scope === 'OFFICE' && roles.includes('officeConsolidator')) {
          endpoint = '/api/submission-workflow/office/submit-own';
          successMessage = 'Finalized';
        } else {
          // Skip if user lacks role for this scope
          continue;
        }

        await api.post(endpoint, {
          ids,
          entity,
          submissionNote: `Submitted all drafts from ${scope} level on ${new Date().toLocaleString()}`
        });
        toast.success(`${successMessage}: ${row.cobExpenditures}`);
      }

      // Refresh table and stats
      if (tableRef.current?.refetch) await tableRef.current.refetch();
      await fetchStats();
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.message || e.message || 'Failed to submit all drafts');
    } finally {
      setSubmittingAll(false);
    }
  };

  // Fetch statistics data
  const fetchStats = async () => {
    try {
      setStats(prev => ({ ...prev, loading: true }));

      // Use the same endpoint as the table to get aggregated data
      const response = await api.get("/proposals?divisionOnly=true");

      if (response.data && response.data.proposals) {
        const proposals = response.data.proposals;

        const totalProposals = proposals.length;

        // For aggregated data, sum up the values from each aggregated row
        const totalProjectedCorporateIncome = proposals.reduce((sum, proposal) => {
          // Use the totalIncome field from aggregated data
          return sum + (proposal.totalIncome || 0);
        }, 0);

        const totalProjectedSubsidy = proposals.reduce((sum, proposal) => {
          // Use the totalExpenses field from aggregated data
          return sum + (proposal.totalExpenses || 0);
        }, 0);

        const totalProposedBudget = proposals.reduce((sum, proposal) => {
          // Use the proposedBudget field from aggregated data
          return sum + (proposal.proposedBudget || 0);
        }, 0);

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
    office: {
      type: "text",
      label: "RESPONSIBILITY CENTER",
      show: true,
      customRender: (row) => {
        // For division-level submissions, show responsibility center
        const workflowLevel = (row.workflowLevel || row.originalLevel || '').toUpperCase();
        if (workflowLevel === 'DIVISION' || workflowLevel === 'RESPONSIBILITY_CENTER') {
          // Try responsibilityCenter first, then division, then show N/A for missing data
          return row.responsibilityCenter || row.division || "N/A";
        }
        // For office-level submissions, show office/department
        else if (workflowLevel === 'OFFICE' || workflowLevel === 'DEPARTMENT') {
          return row.office || row.department || "N/A";
        }
        // Default fallback
        return row.responsibilityCenter || row.office || row.division || "N/A";
      }
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
        // Check for various date fields that indicate submission
        const submissionDate = row.submittedDate || 
                               row.processDate || 
                               row.createdAt || 
                               (row.divisionApproved?.at) ||
                               (row.departmentSubmitted?.at) ||
                               (row.updatedAt);
        
        if (!submissionDate) return "N/A";
        
        try {
          return new Date(submissionDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          });
        } catch (error) {
          return "Invalid Date";
        }
      }
    },
    totalIncome: {
      type: "number",
      label: "PROJECTED CORPORATE INCOME",
      show: true,
      customRender: (row) => {
        // For aggregated data, use the totalIncome field directly
        const incomeAmount = row.totalIncome || 0;

        return (
          <TextSearchable 
            columnName={`₱${incomeAmount.toLocaleString('en-US', { 
              minimumFractionDigits: 2, 
              maximumFractionDigits: 2 
            })}`} 
          />
        );
      },
    },
    totalExpenses: {
      type: "number",
      label: "PROJECTED SUBSIDY",
      show: true,
      customRender: (row) => {
        // For aggregated data, use the totalExpenses field directly
        const subsidyAmount = row.totalExpenses || 0;

        return (
          <TextSearchable 
            columnName={`₱${subsidyAmount.toLocaleString('en-US', { 
              minimumFractionDigits: 2, 
              maximumFractionDigits: 2 
            })}`} 
          />
        );
      },
    },
    proposedBudget: {
      type: "number",
      label: "PROPOSED BUDGET",
      show: true,
      customRender: (row) => {
        // For aggregated data, use the proposedBudget field directly
        const total = row.proposedBudget || 0;

        return (
          <TextSearchable 
            columnName={`₱${(isFinite(total) ? total : 0).toLocaleString('en-US', { 
              minimumFractionDigits: 2, 
              maximumFractionDigits: 2 
            })}`} 
          />
        );
      },
    },
    status: {
      type: "text",
      label: "STATUS",
      show: true,
      customRender: (row) => {
        // Simplified role-based workflow status mapping
        const map = {
          'Draft': { color: 'warning', text: 'DRAFT', bgColor: 'warning.light' },
          'Submitted to Officer': { color: 'info', text: 'OFFICER REVIEW', bgColor: 'info.light' },
          'Officer Approved': { color: 'secondary', text: 'MANAGER REVIEW', bgColor: 'secondary.light' },
          'Officer Returned': { color: 'error', text: 'OFFICER RETURNED', bgColor: 'error.light' },
          'Submitted to Manager': { color: 'secondary', text: 'MANAGER REVIEW', bgColor: 'secondary.light' },
          'Manager Approved': { color: 'success', text: 'FINAL REVIEW', bgColor: 'success.light' },
          'Manager Returned': { color: 'error', text: 'MANAGER RETURNED', bgColor: 'error.light' },
          'Finalized': { color: 'success', text: 'FINALIZED', bgColor: 'success.light' },
          // Legacy status mappings for backward compatibility
          'Responsibility Center Submitted': { color: 'info', text: 'OFFICER REVIEW', bgColor: 'info.light' },
          'Division Submitted': { color: 'info', text: 'OFFICER REVIEW', bgColor: 'info.light' },
          'Office Verified': { color: 'secondary', text: 'MANAGER REVIEW', bgColor: 'secondary.light' },
          'Office Submitted': { color: 'secondary', text: 'MANAGER REVIEW', bgColor: 'secondary.light' },
          'Office Approved': { color: 'success', text: 'FINAL REVIEW', bgColor: 'success.light' },
          'Submitted': { color: 'info', text: 'OFFICER REVIEW', bgColor: 'info.light' },
          'Approved': { color: 'success', text: 'FINAL REVIEW', bgColor: 'success.light' },
          'Returned': { color: 'error', text: 'RETURNED', bgColor: 'error.light' },
        };
        const { color = 'default', text = (row.status || 'Unknown'), bgColor = 'grey.100' } = map[row.status] || {};
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Box
              sx={{
                px: 2,
                py: 0.5,
                borderRadius: 2,
                backgroundColor: bgColor,
                border: `1px solid ${color}.main`,
                minWidth: 'fit-content'
              }}
            >
              <Typography 
                variant="body2" 
                sx={{ 
                  color: `${color}.main`,
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  fontSize: '0.75rem',
                  textAlign: 'center'
                }}
              >
                {text}
              </Typography>
            </Box>
          </Box>
        );
      }
    },
    action: {
      type: "action",
      label: "ACTIONS",
      show: true,
      customRender: (row) => {
        const userInfoForWorkflow = {
          assignmentLevel: currentUser?.hierarchicalAccess?.assignmentLevel,
          accessScope: currentUser?.hierarchicalAccess?.scope,
          scope: currentUser?.hierarchicalAccess?.scope,
          workflowRoles: currentUser?.hierarchicalAccess?.workflowRoles || []
        };

        return (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'center' }}>
            {/* Hidden ViewButton instance to ensure the dialog exists for this row */}
            <Box sx={{ display: 'none' }}>
              <ViewButton row={row} />
            </Box>
            <WorkflowActions
              proposal={row}
              userInfo={userInfoForWorkflow}
              onRefresh={refreshData}
              onView={() => {
                window.dispatchEvent(new CustomEvent('open-proposal-view', { detail: { row } }));
              }}
            />
          </Box>
        );
      }
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

      {/* User Role Information — hidden per UI alignment */}
      {false && (
        <Box sx={{ mb: 3, mx: 3 }}>
          <Card sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
              👤 Your Workflow Roles
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {currentUser?.hierarchicalAccess?.workflowRoles?.length > 0 ? (
                currentUser.hierarchicalAccess.workflowRoles.map((role, index) => (
                  <Typography
                    key={index}
                    variant="body2"
                    sx={{
                      bgcolor: 'primary.light',
                      color: 'primary.contrastText',
                      px: 1,
                      py: 0.5,
                      borderRadius: 1,
                      fontSize: '0.75rem',
                      fontWeight: 'medium'
                    }}
                  >
                    {role.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </Typography>
                ))
              ) : (
                <Typography variant="body2" color="textSecondary">
                  No workflow roles assigned
                </Typography>
              )}
            </Box>
            <Typography variant="body2" sx={{ mt: 1, color: 'textSecondary' }}>
              Your roles determine which actions you can perform on proposals.
            </Typography>
          </Card>
        </Box>
      )}

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

      {(() => {
        // For AllProposals, don't group by default - show individual entries
        // Users can see aggregated data through the totals row
        return (
          <ProposalCustomPage
            tableRef={tableRef}
            dataListName="proposals"
            schema={proposalSchema}
            hasEdit={false}
            hasDelete={false}
            hasAdd={false}
            additionalMenuOptions={[ViewButton]}
            refreshData={refreshData}
            title="All Proposals"
            description="View and manage all submitted proposals"
            apiPath="/proposals?divisionOnly=true"
            groupBy={null} // No grouping - show individual entries
            showTotals={true}
            totalsData={stats}
          />
        );
      })()}
    </>
  );
};

export default AllProposalsPage;
