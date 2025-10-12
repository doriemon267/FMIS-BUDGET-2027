import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  Divider,
  Paper,
  LinearProgress,
  Grid,
  Avatar
} from '@mui/material';
import { getUserInfo } from '../../utils/auth';
import api from '../../config/api';
import { getProposalForEdit, getComparisonData } from '../../services/budgetOfficerEditService';
import BudgetOfficerEditView from './BudgetOfficerEditView';
import BudgetAnalystComparisonView from './BudgetAnalystComparisonView';
import BudgetManagerSubmissionView from './BudgetManagerSubmissionView';
import WorkflowActions from '../workflow/WorkflowActions';
import RefreshIcon from '@mui/icons-material/Refresh';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import PublicIcon from '@mui/icons-material/Public';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import MoneyIcon from '@mui/icons-material/Money';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ApartmentIcon from '@mui/icons-material/Apartment';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import VerifiedIcon from '@mui/icons-material/Verified';

const CACHE_TTL = 60 * 1000; // 1 minute cache for proposal details

const ProposalDetailsDialog = ({ open, onClose, proposal }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [proposalData, setProposalData] = useState(null);
  const [comparisonData, setComparisonData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const cacheRef = useRef(new Map());
  const abortControllerRef = useRef(null);
  const proposalKey = proposal?._id || null;

  const normalizedAssignmentLevel = useMemo(() => {
    const direct = String(userInfo?.assignmentLevel || '').toUpperCase();
    const hier = String(userInfo?.hierarchicalAccess?.scope || '').toUpperCase();
    return direct || hier;
  }, [userInfo]);

  const normalizedWorkflowRoles = useMemo(() => {
    const a = (userInfo?.workflowRoles || []).map((role) => String(role || '').toLowerCase());
    const b = (userInfo?.hierarchicalAccess?.workflowRoles || []).map((role) => String(role || '').toLowerCase());
    return Array.from(new Set([...(a || []), ...(b || [])]));
  }, [userInfo]);

  const normalizedPrimaryRoles = useMemo(() => {
    const collected = [];
    if (Array.isArray(userInfo?.roles)) collected.push(...userInfo.roles);
    if (Array.isArray(userInfo?.Roles)) collected.push(...userInfo.Roles);
    if (Array.isArray(userInfo?.hierarchicalAccess?.roles)) collected.push(...userInfo.hierarchicalAccess.roles);
    if (userInfo?.role) collected.push(userInfo.role);
    if (userInfo?.primaryRole) collected.push(userInfo.primaryRole);
    return collected.map((role) => String(role || '').toUpperCase());
  }, [userInfo]);

  const isManagerLevel = useMemo(() => {
    if (!userInfo) return false;
    const scope = normalizedAssignmentLevel;
    const canApprove = userInfo?.hierarchicalFlags?.canApproveProposals === true || userInfo?.hierarchicalAccess?.rolePermissions?.canApproveProposals === true;
    if (scope === 'REGION' || scope === 'FULL') return true;
    if (canApprove && (scope === 'OFFICE' || scope === 'DEPARTMENT' || scope === 'REGION' || scope === 'FULL')) return true;
    if (normalizedPrimaryRoles.some((role) => role.includes('BUDGET MANAGER') || role.includes('BUDGET ADMIN'))) return true;
    return normalizedWorkflowRoles.some((role) => (
      role === 'regionfinalverifier' ||
      role === 'regionalfinalverifier' ||
      role === 'managerapprover'
    ));
  }, [normalizedAssignmentLevel, normalizedPrimaryRoles, normalizedWorkflowRoles, userInfo]);

  // Budget Officer: Can edit proposals (Department/Office level consolidators)
  const isBudgetOfficer = useMemo(() => {
    if (!userInfo || isManagerLevel) return false;
    if (normalizedAssignmentLevel === 'DEPARTMENT' || normalizedAssignmentLevel === 'OFFICE') {
      return true;
    }
    return normalizedWorkflowRoles.some((role) => (
      role === 'departmentconsolidator' ||
      role === 'officeconsolidator' ||
      role === 'officefinalverifier'
    ));
  }, [userInfo, isManagerLevel, normalizedAssignmentLevel, normalizedWorkflowRoles]);

  // Budget Analyst: Can view comparisons (Division creators)
  const isBudgetAnalyst = useMemo(() => {
    if (!userInfo || isManagerLevel) return false;
    if (normalizedAssignmentLevel === 'DIVISION') {
      return true;
    }
    return normalizedWorkflowRoles.some((role) => role === 'divisioncreator' || role === 'divisionpreparer');
  }, [userInfo, isManagerLevel, normalizedAssignmentLevel, normalizedWorkflowRoles]);

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const info = await getUserInfo();
        setUserInfo(info);
      } catch (error) {
        console.error('Failed to get user info:', error);
      }
    };
    fetchUserInfo();
  }, []);

  const loadData = useCallback(async (forceRefresh = false) => {
    if (!proposalKey || !userInfo) return;

    const cache = cacheRef.current;
    const cachedEntry = cache.get(proposalKey);
    const now = Date.now();
    const hasCache = Boolean(cachedEntry);
    const isFresh = cachedEntry?.timestamp && (now - cachedEntry.timestamp < CACHE_TTL);

    if (hasCache) {
      if (cachedEntry.proposalData) setProposalData(cachedEntry.proposalData);
      if (cachedEntry.comparisonData) setComparisonData(cachedEntry.comparisonData);
    }

    if (!forceRefresh && isFresh) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    // Allow fetching for read-only final statuses even if role detection says no
  const requiresReadOnlyData = isReadOnlyMode;

    if (!isBudgetOfficer && !isBudgetAnalyst && !isManagerLevel && !requiresReadOnlyData) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const showFullLoader = !hasCache || forceRefresh;
    if (showFullLoader) {
      setLoading(true);
      setRefreshing(false);
    } else {
      setLoading(false);
      setRefreshing(true);
    }

    abortControllerRef.current?.abort?.();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setError(null);

    const cacheUpdate = { ...(cachedEntry || {}) };

    try {
      const requests = [];

      if (isBudgetOfficer || isManagerLevel || requiresReadOnlyData) {
        requests.push(
          (async () => {
            try {
              const response = await getProposalForEdit(proposalKey, { signal: controller.signal });
              const data = response?.data || response;
              setProposalData(data);
              cacheUpdate.proposalData = data;
            } catch (err) {
              // Fallback to read-only submission datasets if forbidden or read-only statuses
              const status = err?.response?.status;
              if (status === 403 || requiresReadOnlyData) {
                const params = {
                  fiscalYear: proposal?.fiscalYear,
                  budgetType: proposal?.budgetType,
                  processBy: proposal?.processBy,
                  region: proposal?.region
                };
                try {
                  const [incomeResp, psResp, mooeResp, coResp] = await Promise.all([
                    api.get('/income/getByParams', { params, signal: controller.signal }),
                    api.get('/getpersonnels/byParams', { params, signal: controller.signal }),
                    api.get('/mooe/getByParams', { params, signal: controller.signal }),
                    api.get('/capital-outlay/getByParams', { params, signal: controller.signal })
                  ]);
                  const normalize = (r) => Array.isArray(r?.data) ? r.data : (r?.data?.data || []);
                  const fallbackData = {
                    income: normalize(incomeResp),
                    personnelServices: normalize(psResp),
                    mooe: normalize(mooeResp),
                    capitalOutlay: normalize(coResp)
                  };
                  setProposalData(fallbackData);
                  cacheUpdate.proposalData = fallbackData;
                } catch (fallbackErr) {
                  throw fallbackErr;
                }
              } else {
                throw err;
              }
            }
          })()
        );
      }

      // Prefetch comparison data for all roles (helps quick view toggles)
      if (isBudgetAnalyst || requiresReadOnlyData || true) {
        requests.push(
          getComparisonData(proposalKey, { signal: controller.signal }).then((response) => {
            const data = response?.data || response;
            setComparisonData(data);
            cacheUpdate.comparisonData = data;
          })
        );
      }

      if (requests.length === 0) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      await Promise.all(requests);
      cacheUpdate.timestamp = Date.now();
      cache.set(proposalKey, cacheUpdate);
    } catch (err) {
      if (controller.signal.aborted || err.name === 'CanceledError') {
        return;
      }
      console.error('Error fetching proposal data:', err);
      setError(err.response?.data?.message || 'Failed to load proposal data');
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [proposalKey, userInfo, isBudgetOfficer, isBudgetAnalyst, isManagerLevel]);

  useEffect(() => {
    if (open && proposalKey && userInfo) {
      loadData();
    }
    if (!open) {
      abortControllerRef.current?.abort?.();
      setRefreshing(false);
    }
  }, [open, proposalKey, userInfo, loadData]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort?.();
    };
  }, []);

  const handleClose = () => {
    abortControllerRef.current?.abort?.();
    setLoading(false);
    setRefreshing(false);
    setProposalData(null);
    setComparisonData(null);
    setError(null);
    onClose();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getDisplayText = (value) => {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length ? trimmed : '';
    }
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value.toLocaleString() : '';
    }
    return '';
  };

  const consolidatedFirst = Array.isArray(proposal?.consolidatedProposals) && proposal.consolidatedProposals.length > 0
    ? proposal.consolidatedProposals[0]
    : null;

  const originCandidates = [
    {
      label: 'Responsibility Center',
      icon: ApartmentIcon,
      raw: proposal?.responsibilityCenter || consolidatedFirst?.responsibilityCenter
    },
    {
      label: 'Division',
      icon: ApartmentIcon,
      raw: proposal?.division || proposal?.divisionName || consolidatedFirst?.division
    },
    {
      label: 'Office',
      icon: BusinessCenterIcon,
      raw: proposal?.office || proposal?.officeName || consolidatedFirst?.office
    },
    {
      label: 'Department',
      icon: BusinessCenterIcon,
      raw: proposal?.department || proposal?.departmentName || consolidatedFirst?.department
    },
    {
      label: 'Region',
      icon: PublicIcon,
      raw: proposal?.region || consolidatedFirst?.region
    }
  ];

  const resolvedOrigin = originCandidates.reduce((found, candidate) => {
    if (found) return found;
    const value = getDisplayText(candidate.raw);
    return value ? { label: candidate.label, icon: candidate.icon, value } : null;
  }, null);

  const originMetric = {
    key: 'origin-unit',
    label: resolvedOrigin?.label || 'Origin',
    value: resolvedOrigin?.value || '—',
    icon: resolvedOrigin?.icon || PublicIcon
  };

  const summaryMetrics = [
    {
      key: 'process-by',
      label: 'Processed By',
      value: proposal?.processBy || '—',
      icon: PersonOutlineIcon
    },
    originMetric,
    {
      key: 'fiscal-year',
      label: 'Fiscal Year',
      value: proposal?.fiscalYear || '—',
      icon: CalendarMonthIcon
    },
    {
      key: 'budget-type',
      label: 'Budget Type',
      value: proposal?.budgetType || '—',
      icon: AccountBalanceWalletIcon
    }
  ];

  const totalAmount = formatCurrency(proposal?.totalExpenses || 0);
  const timelineLabel = proposal?.updatedAt
    ? `Last updated ${formatDate(proposal.updatedAt)}`
    : proposal?.createdAt
      ? `Created ${formatDate(proposal.createdAt)}`
      : 'Awaiting recent activity';

  const getStatusColor = (status) => {
    switch (status) {
      case 'Approved': return 'success';
      case 'Office Approved': return 'info';
      case 'Office Submitted': return 'secondary';
      case 'Submitted': return 'warning';
      case 'Returned': return 'error';
      case 'Draft': return 'default';
      default: return 'default';
    }
  };

  // Manager can edit when Office Submitted (per requirement)
  const managerCanEditNow = isManagerLevel && (proposal?.status === 'Office Submitted');

  // Read-only statuses (view mode)
  const readOnlyStatuses = useMemo(() => (
    ['Office Approved', 'Manager Approved', 'Approved', 'Finalized']
  ), []);
  const isReadOnlyMode = useMemo(() => readOnlyStatuses.includes(proposal?.status), [proposal?.status, readOnlyStatuses]);
  // Collapsible Summary: collapsed by default in read-only mode
  const [summaryCollapsed, setSummaryCollapsed] = useState(false);
  useEffect(() => {
    setSummaryCollapsed(isReadOnlyMode);
  }, [isReadOnlyMode]);

  return (
    <Dialog 
      open={open} 
      onClose={(event, reason) => {
        if (reason === 'backdropClick') return; // ignore outside clicks
        handleClose();
      }} 
      maxWidth="xl" 
      fullWidth
      PaperProps={{
        sx: { height: '90vh' }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
          <Typography variant="h5">Proposal Details</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Chip 
              label={proposal?.status || 'Unknown'} 
              color={getStatusColor(proposal?.status)} 
              sx={{ fontWeight: 'bold' }}
            />
            <Button
              size="small"
              variant="outlined"
              startIcon={(loading || refreshing) ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
              onClick={() => loadData(true)}
              disabled={loading || refreshing}
            >
              Refresh
            </Button>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {refreshing && !loading && (
          <LinearProgress sx={{ mb: 2 }} />
        )}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          <>
            {/* Summary Section (collapsible) */}
            <Paper
              elevation={1}
              sx={(theme) => ({
                p: 2,
                mb: 2,
                borderRadius: 2,
                position: 'relative',
                overflow: 'hidden',
                background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 55%)`,
                color: theme.palette.common.white
              })}
            >
              <Box
                sx={{
                  position: 'absolute',
                  top: -60,
                  right: -40,
                  width: 200,
                  height: 200,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255,255,255,0.12)'
                }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Box>
                  <Typography
                    variant="overline"
                    sx={{ letterSpacing: 1, textTransform: 'uppercase', opacity: 0.8 }}
                  >
                    Summary
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
                    Budget Snapshot
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, opacity: 0.85, mt: 0.5 }}>
                    <AccessTimeIcon fontSize="small" />
                    <Typography variant="body2">{timelineLabel}</Typography>
                  </Box>
                </Box>
                <Box sx={{ textAlign: { xs: 'left', md: 'right' }, minWidth: 260 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: { xs: 'flex-start', md: 'flex-end' },
                      gap: 1,
                      opacity: 0.85
                    }}
                  >
                    <MoneyIcon fontSize="small" />
                    <Typography variant="overline" sx={{ letterSpacing: 1.5 }}>
                      Total Amount
                    </Typography>
                  </Box>
                  <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
                    {totalAmount}
                  </Typography>
                  {proposal?.budgetType && (
                    <Chip
                      label={proposal.budgetType}
                      variant="outlined"
                      sx={{
                        mt: 0.5,
                        borderColor: 'rgba(255,255,255,0.4)',
                        color: 'inherit',
                        fontWeight: 500
                      }}
                    />
                  )}
                </Box>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                <Button size="small" variant="outlined" onClick={() => setSummaryCollapsed(v => !v)} sx={{ color: 'inherit', borderColor: 'rgba(255,255,255,0.4)' }}>
                  {summaryCollapsed ? 'Expand Summary' : 'Collapse Summary'}
                </Button>
              </Box>

              {!summaryCollapsed && (
                <Grid container spacing={1.5} sx={{ mt: 1.5 }}>
                {summaryMetrics.map((metric) => {
                  const IconComponent = metric.icon;
                  return (
                    <Grid item xs={12} sm={6} md={3} key={metric.key}>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                          p: 1.5,
                          minHeight: 72,
                          borderRadius: 1.5,
                          backgroundColor: 'rgba(255,255,255,0.16)',
                          border: '1px solid rgba(255,255,255,0.2)',
                          backdropFilter: 'blur(2px)'
                        }}
                      >
                        <Avatar
                          variant="rounded"
                          sx={{
                            bgcolor: 'rgba(0,0,0,0.18)',
                            width: 40,
                            height: 40
                          }}
                        >
                          <IconComponent />
                        </Avatar>
                        <Box>
                          <Typography
                            variant="caption"
                            sx={{
                              textTransform: 'uppercase',
                              letterSpacing: 1.1,
                              opacity: 0.75
                            }}
                          >
                            {metric.label}
                          </Typography>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            {metric.value}
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>
                  );
                })}
                </Grid>
              )}
            </Paper>

            {/* Verification and Consolidation Status */}
            {(proposal?.verifiedByOfficer || proposal?.consolidatedOrigin) && (
              <Paper elevation={2} sx={{ p: 2, mb: 3, backgroundColor: '#f5f5f5' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                  Workflow Status
                </Typography>
                <Grid container spacing={2}>
                  {proposal?.verifiedByOfficer && (
                    <Grid item xs={12} md={6}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <VerifiedIcon color="success" />
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: 'success.main' }}>
                            Verified by Budget Officer
                          </Typography>
                          <Typography variant="caption" display="block">
                            Officer: {proposal.verifiedByOfficer.userName || 'N/A'}
                          </Typography>
                          <Typography variant="caption" display="block">
                            Date: {formatDate(proposal.verifiedByOfficer.date)}
                          </Typography>
                          {proposal.verifiedByOfficer.comment && (
                            <Typography variant="caption" display="block" sx={{ mt: 0.5, fontStyle: 'italic' }}>
                              Comment: {proposal.verifiedByOfficer.comment}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </Grid>
                  )}
                  {proposal?.consolidatedOrigin && (
                    <Grid item xs={12} md={6}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <BusinessCenterIcon color="primary" />
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                            Consolidated at Office Level
                          </Typography>
                          <Typography variant="caption" display="block">
                            Office: {proposal.consolidatedOrigin}
                          </Typography>
                          <Typography variant="caption" display="block" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                            This proposal has been consolidated from division level
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>
                  )}
                </Grid>
              </Paper>
            )}

            <Divider sx={{ my: 2 }} />

            {/* Detailed Records Section */}
            <Typography variant="h6" gutterBottom>Detailed Records</Typography>

            {/* Debug info removed for cleaner UI */}

            {/* Show edit view for Budget Officer; also allow Budget Manager to edit when Office Submitted */}
            {(isBudgetOfficer || managerCanEditNow) && proposalData && proposal?.status !== 'Office Approved' && proposal?.status !== 'Approved' && (
              <>
                {managerCanEditNow && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      You are in Budget Manager edit mode (status: Office Submitted). Apply necessary changes below, then use Approve in the footer.
                    </Typography>
                  </Alert>
                )}
                <BudgetOfficerEditView 
                  proposal={proposal}
                  proposalData={proposalData}
                  onSaveSuccess={() => loadData(true)}
                  variant={managerCanEditNow ? 'manager' : 'officer'}
                  allowSubmit={!managerCanEditNow}
                />
              </>
            )}

            {/* Approved warning removed in view-only mode */}

            {/* View-only mode: show a single comparison view for all roles; fallback to submission view if comparison not ready */}
            {isReadOnlyMode && !managerCanEditNow && (
              <>
                {comparisonData ? (
                  <BudgetAnalystComparisonView 
                    comparisonData={comparisonData}
                    proposal={proposal}
                  />
                ) : (
                  proposalData && (
                    <BudgetManagerSubmissionView 
                      proposalData={proposalData}
                      proposal={proposal}
                    />
                  )
                )}
              </>
            )}

            {/* Analyst-only comparison in non-read-only statuses */}
            {!isReadOnlyMode && isBudgetAnalyst && comparisonData && (
              <BudgetAnalystComparisonView 
                comparisonData={comparisonData}
                proposal={proposal}
              />
            )}

            {isBudgetOfficer && !isManagerLevel && !proposalData && !loading && (
              <Alert severity="warning">
                No proposal data available. Please try refreshing.
              </Alert>
            )}

            {isManagerLevel && !proposalData && !loading && (
              <Alert severity="warning">
                Submitted proposal details could not be loaded. Please try refreshing to retry.
              </Alert>
            )}

            {isBudgetAnalyst && !comparisonData && !loading && (
              <Alert severity="warning">
                No comparison data available. The proposal may not have been edited yet.
              </Alert>
            )}

            {!isBudgetOfficer && !isBudgetAnalyst && !isManagerLevel && (
              <Alert severity="info">
                You do not have permission to view detailed records for this proposal.
                <br />
                <Typography variant="caption">
                  Your role: {userInfo?.role || 'Unknown'}, Assignment Level: {userInfo?.assignmentLevel || 'Unknown'}
                </Typography>
              </Alert>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ justifyContent: 'space-between', px: 3, py: 2 }}>
        <Button onClick={handleClose} variant="outlined">
          Close
        </Button>
        
        {/* Workflow Actions - Show only if user has appropriate role and proposal is not in final state */}
        {proposal && userInfo && !['Approved', 'Finalized', 'Office Approved', 'Manager Approved'].includes(proposal.status) && (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <WorkflowActions
              proposal={proposal}
              userInfo={userInfo}
              onRefresh={() => loadData(true)}
              onView={() => {}}
              showHeader={true}
              showTrackInMenu={false}
              showViewInMenu={false}
            />
          </Box>
        )}
      </DialogActions>
    </Dialog>
  );
};

ProposalDetailsDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  proposal: PropTypes.shape({
    _id: PropTypes.string,
    processBy: PropTypes.string,
    region: PropTypes.string,
    fiscalYear: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    budgetType: PropTypes.string,
    totalExpenses: PropTypes.number,
    status: PropTypes.string,
    updatedAt: PropTypes.string,
    createdAt: PropTypes.string,
    responsibilityCenter: PropTypes.string,
    division: PropTypes.string,
    divisionName: PropTypes.string,
    office: PropTypes.string,
    officeName: PropTypes.string,
    department: PropTypes.string,
    departmentName: PropTypes.string,
    consolidatedProposals: PropTypes.arrayOf(PropTypes.shape({
      responsibilityCenter: PropTypes.string,
      division: PropTypes.string,
      department: PropTypes.string,
      office: PropTypes.string,
      region: PropTypes.string
    }))
  })
};

export default ProposalDetailsDialog;