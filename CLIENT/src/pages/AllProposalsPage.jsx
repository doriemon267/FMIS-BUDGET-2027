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
      const response = await api.get("/proposals");
      
      if (response.data && response.data.proposals) {
        const proposals = response.data.proposals;
        
        const totalProposals = proposals.length;
        
        // Calculate Corporate Income correctly - from Income entries and MOOE/Capital income
        const totalProjectedCorporateIncome = proposals.reduce((sum, proposal) => {
          // Corporate Income from Income entries
          if (proposal.cobExpenditures === 'Corporate Income') {
            return sum + (proposal.amount || 0);
          }
          // Income from MOOE and Capital Outlay
          if (proposal.cobExpenditures === 'MOOE' || proposal.cobExpenditures === 'Capital Outlay') {
            return sum + (proposal.income || 0);
          }
          return sum;
        }, 0);
        
        // Calculate Subsidy correctly - from expenses only (Personnel + MOOE + Capital costs)
        const totalProjectedSubsidy = proposals.reduce((sum, proposal) => {
          if (proposal.cobExpenditures && proposal.cobExpenditures.includes('Personnel Services')) {
            // For personnel, calculate total from all allowance fields, fallback to aggregated Total if present
            const breakdownTotal = (proposal.annualSalary || 0) + 
                                   (proposal.RATA || 0) + 
                                   (proposal.PERA || 0) + 
                                   (proposal.uniformALLOWANCE || 0) + 
                                   (proposal.productivityIncentive || 0) + 
                                   (proposal.medical || 0) + 
                                   (proposal.childrenAllowance || 0) + 
                                   (proposal.meal || 0) + 
                                   (proposal.cashGift || 0) + 
                                   (proposal.subsistenceAllowanceMDS || 0) + 
                                   (proposal.subsistenceAllowanceST || 0) + 
                                   (proposal.midyearBonus || 0) + 
                                   (proposal.yearEndBonus || 0) + 
                                   (proposal.gsisPremium || 0) + 
                                   (proposal.philhealthPremium || 0) + 
                                   (proposal.pagibigPremium || 0) + 
                                   (proposal.employeeCompensation || 0);
            const personnelTotal = breakdownTotal > 0 ? breakdownTotal : (proposal.Total || 0);
            return sum + (personnelTotal || 0);
          } else if (proposal.cobExpenditures === 'MOOE') {
            return sum + (proposal.subsidy || proposal.amount || 0);
          } else if (proposal.cobExpenditures === 'Capital Outlay') {
            return sum + (proposal.subsidy || proposal.cost || 0);
          }
          return sum;
        }, 0);
        
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
    office: {
      type: "text",
      label: (() => {
        const scope = currentUser?.hierarchicalAccess?.scope;
        if (scope === 'RESPONSIBILITY_CENTER') return 'RESPONSIBILITY CENTER';
        if (scope === 'OFFICE') return 'OFFICE';
        return 'OFFICE';
      })(),
      show: true,
      customRender: (row) => {
        // Show the most specific organizational level available
        if (row.responsibilityCenter && String(row.responsibilityCenter).trim() !== "") {
          return `Responsibility Center: ${row.responsibilityCenter}`;
        } else if (row.office && String(row.office).trim() !== "") {
          return `Office: ${row.office}`;
        } else {
          return row.office ? `Office: ${row.office}` : "CENTRAL OFFICE";
        }
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
    workflowLevel: {
      type: "text",
      label: "WORKFLOW LEVEL",
      show: true,
      customRender: (row) => {
        // Use the workflowLevel field directly if available
        let level = "Unknown";
        let levelColor = "default";

        if (row.workflowLevel) {
          // Use the workflowLevel field directly
          switch (row.workflowLevel.toUpperCase()) {
            case 'DIVISION':
              level = "Division";
              levelColor = "primary";
              break;
            case 'DEPARTMENT':
              level = "Department";
              levelColor = "secondary";
              break;
            case 'REGION':
              level = "Region";
              levelColor = "success";
              break;
            case 'RESPONSIBILITY_CENTER':
              level = "Responsibility Center";
              levelColor = "warning";
              break;
            case 'OFFICE':
              level = "Office";
              levelColor = "info";
              break;
            default:
              level = row.workflowLevel;
              levelColor = "default";
          }
        } else if (row.originalLevel) {
          // Fallback to originalLevel if workflowLevel is not available
          switch (row.originalLevel.toUpperCase()) {
            case 'DIVISION':
              level = "Division";
              levelColor = "primary";
              break;
            case 'DEPARTMENT':
              level = "Department";
              levelColor = "secondary";
              break;
            case 'REGION':
              level = "Region";
              levelColor = "success";
              break;
            case 'RESPONSIBILITY_CENTER':
              level = "Responsibility Center";
              levelColor = "warning";
              break;
            case 'OFFICE':
              level = "Office";
              levelColor = "info";
              break;
            default:
              level = row.originalLevel;
              levelColor = "default";
          }
        }

        return (
          <Typography
            variant="body2"
            sx={{
              color: `${levelColor}.main`,
              fontWeight: 'medium'
            }}
          >
            {level}
          </Typography>
        );
      }
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
        let incomeAmount = 0;
        
        // Corporate Income entries
        if (row.cobExpenditures === 'Corporate Income') {
          incomeAmount = row.amount || 0;
        }
        // Income from MOOE and Capital Outlay
        else if (row.cobExpenditures === 'MOOE' || row.cobExpenditures === 'Capital Outlay') {
          incomeAmount = row.income || 0;
        }
        // Fallback to totalIncome field
        else {
          incomeAmount = row.totalIncome || 0;
        }
        
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
        let subsidyAmount = 0;
        
        // Personnel Services - calculate total from individual fields
        if (row.cobExpenditures && row.cobExpenditures.includes('Personnel Services')) {
          subsidyAmount = (row.annualSalary || 0) + 
                          (row.RATA || 0) + 
                          (row.PERA || 0) + 
                          (row.uniformALLOWANCE || 0) + 
                          (row.productivityIncentive || 0) + 
                          (row.medical || 0) + 
                          (row.childrenAllowance || 0) + 
                          (row.meal || 0) + 
                          (row.cashGift || 0) + 
                          (row.subsistenceAllowanceMDS || 0) + 
                          (row.subsistenceAllowanceST || 0) + 
                          (row.midyearBonus || 0) + 
                          (row.yearEndBonus || 0) + 
                          (row.gsisPremium || 0) + 
                          (row.philhealthPremium || 0) + 
                          (row.pagibigPremium || 0) + 
                          (row.employeeCompensation || 0) ||
                          row.Total || 0; // Fallback to Total field if individual fields not available
        }
        // MOOE - use subsidy or amount field
        else if (row.cobExpenditures === 'MOOE') {
          subsidyAmount = row.subsidy || row.amount || 0;
        }
        // Capital Outlay - use subsidy or cost field
        else if (row.cobExpenditures === 'Capital Outlay') {
          subsidyAmount = row.subsidy || row.cost || 0;
        }
        // Fallback to totalExpenses field
        else {
          subsidyAmount = row.totalExpenses || 0;
        }
        
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
        // Compute corporate income like in totalIncome column
        let incomeAmount = 0;
        if (row.cobExpenditures === 'Corporate Income') {
          incomeAmount = row.amount || row.totalIncome || 0;
        } else if (row.cobExpenditures === 'MOOE' || row.cobExpenditures === 'Capital Outlay') {
          incomeAmount = row.income || 0;
        } else {
          incomeAmount = row.totalIncome || 0; // fallback if provided
        }

        // Compute subsidy like in totalExpenses column
        let subsidyAmount = 0;
        if (row.cobExpenditures && row.cobExpenditures.includes('Personnel Services')) {
          subsidyAmount = (row.annualSalary || 0) + 
                          (row.RATA || 0) + 
                          (row.PERA || 0) + 
                          (row.uniformALLOWANCE || 0) + 
                          (row.productivityIncentive || 0) + 
                          (row.medical || 0) + 
                          (row.childrenAllowance || 0) + 
                          (row.meal || 0) + 
                          (row.cashGift || 0) + 
                          (row.subsistenceAllowanceMDS || 0) + 
                          (row.subsistenceAllowanceST || 0) + 
                          (row.midyearBonus || 0) + 
                          (row.yearEndBonus || 0) + 
                          (row.gsisPremium || 0) + 
                          (row.philhealthPremium || 0) + 
                          (row.pagibigPremium || 0) + 
                          (row.employeeCompensation || 0) ||
                          row.Total || row.totalExpenses || 0;
        } else if (row.cobExpenditures === 'MOOE') {
          subsidyAmount = row.subsidy || row.amount || 0;
        } else if (row.cobExpenditures === 'Capital Outlay') {
          subsidyAmount = row.subsidy || row.cost || 0;
        } else {
          subsidyAmount = row.totalExpenses || 0; // fallback if provided
        }

        const total = Number(incomeAmount) + Number(subsidyAmount);
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
        // Normalize status to new 6-step workflow
        const map = {
          'Draft': { color: 'warning', text: 'Draft' },
          'Responsibility Center Submitted': { color: 'info', text: 'Responsibility Center Submitted' },
          'Office Verified': { color: 'secondary', text: 'Office Verified' },
          'Office Submitted': { color: 'info', text: 'Office Submitted' },
          'Office Approved': { color: 'success', text: 'Office Approved' },
          'Finalized': { color: 'success', text: 'Finalized' },
          'Submitted': { color: 'info', text: 'Submitted' }, // legacy
          'Approved': { color: 'success', text: 'Approved' }, // legacy
          'Returned': { color: 'error', text: 'Returned' },
        };
        const { color = 'default', text = (row.status || 'Unknown') } = map[row.status] || {};
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography 
              variant="body2" 
              sx={{ 
                color: `${color}.main`,
                fontWeight: 'bold',
                textTransform: 'uppercase'
              }}
            >
              {text}
            </Typography>
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

      {/* User Role Information */}
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
        const scope = currentUser?.hierarchicalAccess?.scope;
        const groupByField = scope === 'DIVISION' ? 'division' : (scope === 'DEPARTMENT' ? 'department' : 'region');
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
            apiPath="/proposals"
            groupBy={groupByField}
          />
        );
      })()}
    </>
  );
};

export default AllProposalsPage;
