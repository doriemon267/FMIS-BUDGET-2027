import React, { useRef, useState, useEffect, useCallback } from "react";
import ProposalCustomPage from "../components/allproposals/ProposalCustomPage";
import TextSearchable from "../global/components/TextSearchable";
import { ViewButton } from "../components/allproposals/ProposalActions";
import WorkflowActionsRefactored from "../components/workflow/WorkflowActionsRefactored";
import { useUser } from "../context/UserContext";
import { useQuery } from "@tanstack/react-query";
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
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from "@mui/material";
import Chip from '@mui/material/Chip';
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import MonetizationOnIcon from "@mui/icons-material/MonetizationOn";
import PaymentsIcon from '@mui/icons-material/Payments';
import { FaPesoSign } from "react-icons/fa6";
import AssessmentIcon from "@mui/icons-material/Assessment";
import { toast } from "react-toastify";
import api from "../config/api";
import { useLocation, useNavigate } from "react-router-dom";
import { prettyRole } from '../utils/role-utils';
import BulkOperationsToolbar from '../components/common/BulkOperationsToolbar';
import logger from '../utils/logger';
import { handleApiError } from '../utils/errorHandler';

const AllProposalsPage = () => {
  const tableRef = useRef(null);
  const { currentUser } = useUser();
  const [submittingAll, setSubmittingAll] = useState(false);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [selectedProposals, setSelectedProposals] = useState([]);
  const [stats, setStats] = useState({
    totalProposals: 0,
    totalProjectedCorporateIncome: 0,
    totalProjectedSubsidy: 0,
    totalProposedBudget: 0,
    loading: true
  });
  const [includeFinalized, setIncludeFinalized] = useState(false);
  const [submitAllConfirmOpen, setSubmitAllConfirmOpen] = useState(false);
  const [submitAllPreview, setSubmitAllPreview] = useState({ count: 0, rows: [] });
  const [submitAllNote, setSubmitAllNote] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const [deepLinkProposalId, setDeepLinkProposalId] = useState(null);

  // Using shared prettyRole helper

  // Fetch active fiscal year and budget type settings
  const { data: activeSettings } = useQuery({
    queryKey: ["activeSettings"],
    queryFn: async () => {
      try {
        const res = await api.get("/settings/active");
        return res.data;
      } catch (error) {
        console.error("Error fetching active settings:", error);
        return null;
      }
    },
  });

  // Handle table row selection changes
  const handleRowSelectionChange = (selectedIds) => {
    setSelectedProposals(selectedIds);
  };

  const refreshData = () => {
    if (tableRef.current && typeof tableRef.current.refetch === "function") {
      tableRef.current.refetch();
    }
    fetchStats(); // Refresh stats when data is refreshed
  };

  const clearDeepLinkParam = useCallback(() => {
    const params = new URLSearchParams(location.search);
    if (!params.has('proposalId')) return;

    params.delete('proposalId');
    navigate({
      pathname: location.pathname,
      search: params.toString() ? `?${params.toString()}` : "",
    }, { replace: true });
  }, [location.pathname, location.search, navigate]);

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

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const paramId = params.get('proposalId');
    if (paramId) {
      setDeepLinkProposalId(paramId);
    }
  }, [location.search]);

  useEffect(() => {
    if (!deepLinkProposalId) return;

    let cancelled = false;

    const attemptOpen = async (attempt = 0) => {
      if (cancelled) return;

      try {
        const rows = (tableRef.current && typeof tableRef.current.getRows === 'function')
          ? await tableRef.current.getRows()
          : [];
        const matchedRow = rows.find((row) => String(row._id) === String(deepLinkProposalId));

        if (matchedRow) {
          window.dispatchEvent(new CustomEvent('open-proposal-view', { detail: { row: matchedRow } }));
          clearDeepLinkParam();
          setDeepLinkProposalId(null);
          return;
        }
      } catch (error) {
        console.warn('Failed to resolve deep-linked proposal', error);
      }

      if (cancelled) return;

      if (attempt < 5) {
        setTimeout(() => {
          attemptOpen(attempt + 1);
        }, 600);
      } else {
        clearDeepLinkParam();
        setDeepLinkProposalId(null);
      }
    };

    const prepareAndOpen = async () => {
      if (tableRef.current && typeof tableRef.current.refetch === 'function') {
        try {
          await tableRef.current.refetch();
        } catch (error) {
          console.warn('Failed to refresh proposals table for deep link', error);
        }
      }
      attemptOpen();
    };

    prepareAndOpen();

    return () => {
      cancelled = true;
    };
  }, [deepLinkProposalId, clearDeepLinkParam]);

  // Open confirmation dialog for bulk submit
  const handleOpenSubmitAllDialog = async () => {
    try {
      // Ask table for current rows (ProposalCustomPage should expose getRows() via ref, else fallback to fetch)
      const rows = (tableRef.current && typeof tableRef.current.getRows === 'function')
        ? await tableRef.current.getRows()
        : null;

      if (!rows || rows.length === 0) {
        toast.error('No rows found to submit.');
        return;
      }

      const draftRows = rows.filter(row => row.status === 'Draft');
      if (draftRows.length === 0) {
        toast.error('No draft proposals found to submit.');
        return;
      }

      setSubmitAllPreview({ count: draftRows.length, rows: draftRows });
      setSubmitAllConfirmOpen(true);
    } catch (e) {
      console.error(e);
      toast.error('Failed to prepare submission preview.');
    }
  };

  // Submit all Drafts for the current scope per expenditure row
  const handleSubmitAllDrafts = async () => {
    try {
      setSubmittingAll(true);
      setSubmitAllConfirmOpen(false);

      const rows = submitAllPreview.rows;
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
          submissionNote: submitAllNote || `Submitted all drafts from ${scope} level on ${new Date().toLocaleString()}`
        });
        toast.success(`${successMessage}: ${row.cobExpenditures}`);
      }

      // Refresh table and stats
      if (tableRef.current?.refetch) await tableRef.current.refetch();
      await fetchStats();
      setSubmitAllNote('');
      setSubmitAllPreview({ count: 0, rows: [] });
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.message || e.message || 'Failed to submit all drafts');
    } finally {
      setSubmittingAll(false);
    }
  };

  // Bulk approve selected proposals (Budget Officer only)
  const handleBulkApprove = async (comment = '') => {
    if (selectedProposals.length === 0) {
      toast.error('Please select proposals to approve.');
      return;
    }

    // Check if user is Budget Officer
    const userRoles = currentUser?.Roles || [];
    if (!userRoles.includes('BUDGET_OFFICER')) {
      toast.error('Only Budget Officers can perform bulk approvals.');
      return;
    }

    try {
      setBulkApproving(true);

      const approvalComment = comment || `Bulk approved ${selectedProposals.length} proposals on ${new Date().toLocaleString()}`;

      const response = await api.post('/api/workflow/bulk-approve', {
        proposalIds: selectedProposals,
        comment: approvalComment
      });

      if (response.data.success) {
        toast.success(response.data.message);
        setSelectedProposals([]);
        refreshData();
      } else {
        throw new Error(response.data.message || 'Bulk approval failed');
      }
    } catch (error) {
      logger.error('Bulk approval error:', error);
      handleApiError(error, toast, 'Bulk approval');
    } finally {
      setBulkApproving(false);
    }
  };

  // Bulk reject handler
  const handleBulkReject = async (comment = '') => {
    if (selectedProposals.length === 0) {
      toast.error('Please select proposals to reject.');
      return;
    }

    try {
      setBulkApproving(true);
      const rejectComment = comment || `Bulk rejected ${selectedProposals.length} proposals on ${new Date().toLocaleString()}`;
      
      // Add reject logic here when endpoint is available
      toast.info('Bulk reject functionality coming soon');
      setSelectedProposals([]);
    } catch (error) {
      logger.error('Bulk reject error:', error);
      toast.error(error.response?.data?.message || error.message || 'Failed to bulk reject proposals');
    } finally {
      setBulkApproving(false);
    }
  };

  // Bulk delete handler
  const handleBulkDelete = async (comment = '') => {
    if (selectedProposals.length === 0) {
      toast.error('Please select proposals to delete.');
      return;
    }

    try {
      setBulkApproving(true);
      const deleteComment = comment || `Bulk deleted ${selectedProposals.length} proposals on ${new Date().toLocaleString()}`;
      
      // Add delete logic here when endpoint is available
      toast.info('Bulk delete functionality coming soon');
      setSelectedProposals([]);
    } catch (error) {
      logger.error('Bulk delete error:', error);
      toast.error(error.response?.data?.message || error.message || 'Failed to bulk delete proposals');
    } finally {
      setBulkApproving(false);
    }
  };

  // Bulk submit handler
  const handleBulkSubmit = async (comment = '') => {
    if (selectedProposals.length === 0) {
      toast.error('Please select proposals to submit.');
      return;
    }

    try {
      setBulkApproving(true);
      const submitComment = comment || `Bulk submitted ${selectedProposals.length} proposals on ${new Date().toLocaleString()}`;
      
      // Add submit logic here when endpoint is available
      toast.info('Bulk submit functionality coming soon');
      setSelectedProposals([]);
    } catch (error) {
      logger.error('Bulk submit error:', error);
      toast.error(error.response?.data?.message || error.message || 'Failed to bulk submit proposals');
    } finally {
      setBulkApproving(false);
    }
  };

  // Fetch statistics data
  const fetchStats = async () => {
    try {
      setStats(prev => ({ ...prev, loading: true }));
      
      // Use the same endpoint as the table to get aggregated data
      const response = await api.get("/api/my-proposals/all", { 
        params: { 
          includeFinalized: includeFinalized || undefined,
          processBy: currentUser?.Username,
          region: currentUser?.Region,
          fiscalYear: activeSettings?.fiscalYear,
          budgetType: activeSettings?.budgetType
        } 
      });

      if (response.data && response.data.summary) {
        // Use the pre-calculated summary from backend
        const { summary } = response.data;
        
        setStats({
          totalProposals: summary.totalProposals || 0,
          totalProjectedCorporateIncome: summary.totalIncome || 0,
          totalProjectedSubsidy: summary.projectedSubsidy || 0,
          totalProposedBudget: summary.proposedBudget || 0,
          loading: false
        });
      } else {
        // Fallback: set to 0 if no summary available
        setStats({
          totalProposals: 0,
          totalProjectedCorporateIncome: 0,
          totalProjectedSubsidy: 0,
          totalProposedBudget: 0,
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

  // When includeFinalized toggles, refresh table and stats
  useEffect(() => {
    if (tableRef.current?.refetch) tableRef.current.refetch();
    fetchStats();
  }, [includeFinalized]);

  // Debug function to test API access
  const testAPIAccess = async () => {
    try {
      // Test direct API call
      const response = await api.get("/api/my-proposals/all?limit=5");
      alert(`API accessible! Found ${response.data.data?.length || 0} proposals. Check console for details.`);
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
        // Prefer explicit fields, then fall back to consolidatedProposals[0] where available, then N/A
        const consolidatedFirst = (row.consolidatedProposals && row.consolidatedProposals[0]) ? row.consolidatedProposals[0] : null;
        if (workflowLevel === 'DIVISION' || workflowLevel === 'RESPONSIBILITY_CENTER') {
          return row.responsibilityCenter || row.division || (consolidatedFirst && (consolidatedFirst.division || consolidatedFirst.department)) || "N/A";
        }
        // For office-level submissions, show office/department
        else if (workflowLevel === 'OFFICE' || workflowLevel === 'DEPARTMENT') {
          return row.office || row.department || (consolidatedFirst && (consolidatedFirst.department || consolidatedFirst.division)) || "N/A";
        }
        // Default fallback
        return row.responsibilityCenter || row.office || row.division || (consolidatedFirst && (consolidatedFirst.department || consolidatedFirst.division)) || "N/A";
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
        // Status mapping based on Budget Proposal Workflow document
        const map = {
          'Draft': { color: 'warning', text: 'DRAFT', bgColor: 'warning.light' },
          'Division Submitted': { color: 'info', text: 'DIVISION SUBMITTED', bgColor: 'info.light' },
          'Office': { color: 'info', text: 'DEPARTMENT PROPOSAL', bgColor: 'info.light' },
          'Officer Approved': { color: 'success', text: 'OFFICER APPROVED', bgColor: 'success.light' },
          'Forwarded to Manager': { color: 'secondary', text: 'FORWARDED TO MANAGER', bgColor: 'secondary.light' },
          'Returned': { color: 'error', text: 'RETURNED', bgColor: 'error.light' },
          'Finalized': { color: 'success', text: 'FINALIZED', bgColor: 'success.light' },
        };
        // Display the raw status value; server normalizes to canonical 6-step statuses: Draft, Division Submitted, Forwarded to Officer, Officer Approved, Forwarded to Manager, Finalized
        const displayStatus = row.status;
        const { color = 'default', text = (displayStatus || 'Unknown'), bgColor = 'grey.100' } = map[displayStatus] || {};
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
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
              {(displayStatus || '').toLowerCase().includes('returned') && row.currentAssigneeRole && (
                <Chip label={`Returned to ${prettyRole(row.currentAssigneeRole)}`} size="small" sx={{ ml: 1, height: 22, bgcolor: '#f6f6f6', color: '#777', fontSize: '0.68rem' }} />
              )}
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
              <ViewButton row={row} refreshData={refreshData} />
            </Box>
            <WorkflowActionsRefactored
              proposal={row}
              userInfo={userInfoForWorkflow}
              restrictToRole="BUDGET PREPARER"
              onRefresh={refreshData}
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

      {/* Bulk Actions Section - Only for Budget Officers */}
      {currentUser?.Roles?.includes('BUDGET_OFFICER') && (
        <Box sx={{ mb: 3, mx: 3 }}>
          <Card sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
              ⚡ Bulk Actions
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Button
                variant="contained"
                color="success"
                onClick={handleBulkApprove}
                disabled={selectedProposals.length === 0 || bulkApproving}
                startIcon={bulkApproving ? <CircularProgress size={20} /> : null}
              >
                {bulkApproving ? 'Approving...' : `Bulk Approve (${selectedProposals.length})`}
              </Button>
              <Typography variant="body2" color="textSecondary">
                Select proposals from the table below to perform bulk approval actions.
              </Typography>
            </Box>
          </Card>
        </Box>
      )}

      {/* Bulk Submit Drafts Section */}
      {(() => {
        const scope = currentUser?.hierarchicalAccess?.scope;
        const roles = currentUser?.hierarchicalAccess?.workflowRoles || [];
        const canBulkSubmit = (scope === 'RESPONSIBILITY_CENTER' && roles.includes('responsibilityCenterCreator')) ||
                              (scope === 'OFFICE' && roles.includes('officeConsolidator'));
        return canBulkSubmit ? (
          <Box sx={{ mb: 3, mx: 3 }}>
            <Card sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                📤 Bulk Submit Drafts
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleOpenSubmitAllDialog}
                  disabled={submittingAll}
                  startIcon={submittingAll ? <CircularProgress size={20} /> : null}
                >
                  {submittingAll ? 'Submitting...' : 'Submit All Drafts'}
                </Button>
                <Typography variant="body2" color="textSecondary">
                  Submit all draft proposals shown in the table to the next workflow level.
                </Typography>
              </Box>
            </Card>
          </Box>
        ) : null;
      })()}

      {/* Include Finalized Toggle */}
      <Box sx={{ mb: 3, mx: 3 }}>
        <Card sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body1" sx={{ fontWeight: 'bold' }}>Include Finalized Proposals</Typography>
            <Button
              variant={includeFinalized ? 'contained' : 'outlined'}
              color={includeFinalized ? 'primary' : 'inherit'}
              onClick={() => setIncludeFinalized(v => !v)}
            >
              {includeFinalized ? 'Included' : 'Exclude'}
            </Button>
            <Typography variant="body2" color="textSecondary">Toggle to include proposals with Finalized status in the table.</Typography>
          </Box>
        </Card>
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
          <>
            {selectedProposals.length > 0 && (
              <BulkOperationsToolbar
                selectedCount={selectedProposals.length}
                totalCount={stats?.totalProposals || 0}
                onBulkApprove={handleBulkApprove}
                onBulkReject={handleBulkReject}
                onBulkDelete={handleBulkDelete}
                onBulkSubmit={handleBulkSubmit}
                onClearSelection={() => setSelectedProposals([])}
                isLoading={bulkApproving}
                allowedActions={['approve', 'reject', 'delete', 'submit']}
                requireComment={true}
              />
            )}
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
              description="View and manage budget proposals based on your role"
              apiPath="/api/my-proposals/all"
              apiParams={{ 
                includeFinalized,
                processBy: currentUser?.Username,
                region: currentUser?.Region,
                fiscalYear: activeSettings?.fiscalYear,
                budgetType: activeSettings?.budgetType
              }}
              groupBy={null} // No grouping - show individual entries
              showTotals={true}
              totalsData={stats}
              selectedRows={selectedProposals}
              onRowSelectionChange={handleRowSelectionChange}
            />
          </>
        );
      })()}
      
      {/* Bulk Submit Confirmation Dialog */}
      <Dialog 
        open={submitAllConfirmOpen} 
        onClose={() => !submittingAll && setSubmitAllConfirmOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Confirm Bulk Submit Drafts</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            This will submit all draft proposals shown in the table to the next workflow level.
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            Number of draft proposals to submit: <strong>{submitAllPreview.count}</strong>
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={3}
            label="Submission Note (Optional)"
            value={submitAllNote}
            onChange={(e) => setSubmitAllNote(e.target.value)}
            placeholder="Add any notes for this submission..."
          />
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setSubmitAllConfirmOpen(false)} 
            disabled={submittingAll}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmitAllDrafts} 
            disabled={submittingAll || submitAllPreview.count === 0}
            variant="contained" 
            color="primary"
            startIcon={submittingAll ? <CircularProgress size={20} /> : null}
          >
            {submittingAll ? 'Submitting...' : 'Submit All'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AllProposalsPage;
