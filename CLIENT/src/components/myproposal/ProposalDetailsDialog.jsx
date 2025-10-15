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
import WorkflowStatusStepper from '../workflow/WorkflowStatusStepper';
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
import InfoIcon from '@mui/icons-material/Info';
import WarningIcon from '@mui/icons-material/Warning';

const CACHE_TTL = 60 * 1000; // 1 minute cache for proposal details

const ProposalDetailsDialog = ({ open, onClose, proposal }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [proposalData, setProposalData] = useState(null);
  const [comparisonData, setComparisonData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [officerEditMode, setOfficerEditMode] = useState(false); // Track if Budget Officer wants to edit

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
    const result = Array.from(new Set([...(a || []), ...(b || [])]));
    console.log('🔍 normalizedWorkflowRoles computed:', {
      fromWorkflowRoles: a,
      fromHierarchical: b,
      combined: result
    });
    return result;
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

  // Budget Coordinator: Division approvers (divisionapprover) - STRICT workflow role check only
  const isBudgetCoordinator = useMemo(() => {
    if (!userInfo) return false;
    // ONLY check for 'divisionapprover' workflow role - no assignmentLevel fallback
    return normalizedWorkflowRoles.some((role) => role === 'divisionapprover');
  }, [userInfo, normalizedWorkflowRoles]);

  // Budget Analyst: Division creators (divisioncreator) OR Office creators (officecreator)
  // - divisioncreator = Responsibility Center/Division Level → submits to BUDGET COORDINATOR
  // - officecreator = Office Level → submits DIRECTLY to BUDGET OFFICER (skip coordinator)
  const isBudgetAnalyst = useMemo(() => {
    if (!userInfo || isManagerLevel) return false;
    // Check for divisioncreator, divisionpreparer, OR officecreator workflow roles
    return normalizedWorkflowRoles.some((role) => 
      role === 'divisioncreator' || 
      role === 'divisionpreparer' ||
      role === 'officecreator'
    );
  }, [userInfo, isManagerLevel, normalizedWorkflowRoles]);

  // Check if Budget Analyst is Office-level (officecreator) - they skip coordinator
  const isOfficeCreator = useMemo(() => {
    if (!isBudgetAnalyst) return false;
    return normalizedWorkflowRoles.some((role) => role === 'officecreator');
  }, [isBudgetAnalyst, normalizedWorkflowRoles]);

  // Budget Officer: Approver/Verifier ONLY (NOT a creator)
  // Receives proposals from:
  // - BUDGET COORDINATOR (division-level proposals)
  // - BUDGET ANALYST with officecreator (office-level proposals - direct)
  const isBudgetOfficer = useMemo(() => {
    if (!userInfo || isManagerLevel) return false;
    // Exclude users who are Budget Coordinator or Budget Analyst (creators)
    if (normalizedWorkflowRoles.some((role) => 
      role === 'divisionapprover' || 
      role === 'divisioncreator' || 
      role === 'divisionpreparer' ||
      role === 'officecreator'
    )) {
      return false;
    }
    // Officer is strictly a verifier/approver role
    return normalizedWorkflowRoles.some((role) => (
      role === 'officeconsolidator' ||
      role === 'officefinalverifier' ||
      role === 'officeverifier'
    ));
  }, [userInfo, isManagerLevel, normalizedWorkflowRoles]);

  // Read-only statuses (view mode) - MUST BE DEFINED BEFORE loadData callback
  const readOnlyStatuses = useMemo(() => (
    ['Office Approved', 'Manager Approved', 'Approved', 'Finalized', 'Officer Approved', 'Coordinator Approved']
  ), []);
  const isReadOnlyMode = useMemo(() => readOnlyStatuses.includes(proposal?.status), [proposal?.status, readOnlyStatuses]);

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const info = await getUserInfo();
        console.log('📋 ProposalDetailsDialog - User Info Fetched:', {
          fullUserInfo: info,
          workflowRoles: info?.workflowRoles,
          roles: info?.roles,
          Roles: info?.Roles,
          role: info?.role,
          assignmentLevel: info?.assignmentLevel,
          hierarchicalAccess: info?.hierarchicalAccess
        });
        setUserInfo(info);
      } catch (error) {
        console.error('Failed to get user info:', error);
      }
    };
    fetchUserInfo();
  }, []);

  const loadData = useCallback(async (forceRefresh = false) => {
    if (!proposalKey || !userInfo) return;

    // Debug logging for role detection
    console.log('🔍 ProposalDetailsDialog Role Detection:', {
      isBudgetCoordinator,
      isBudgetOfficer,
      isBudgetAnalyst,
      isManagerLevel,
      normalizedPrimaryRoles,
      normalizedAssignmentLevel,
      normalizedWorkflowRoles,
      userInfo
    });

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

    if (!isBudgetOfficer && !isBudgetAnalyst && !isBudgetCoordinator && !isManagerLevel && !requiresReadOnlyData) {
      console.log('❌ No permission to view proposal details');
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

      // Budget Coordinator and Analyst should fetch raw proposal data, not Budget Officer Edit records
      if (isBudgetCoordinator || isBudgetAnalyst) {
        console.log('✅ Fetching raw proposal data for BUDGET_COORDINATOR/BUDGET_ANALYST', {
          isBudgetCoordinator,
          isBudgetAnalyst,
          proposalId: proposalKey
        });
        requests.push(
          (async () => {
            try {
              const params = {
                fiscalYear: proposal?.fiscalYear,
                budgetType: proposal?.budgetType,
                processBy: proposal?.processBy,
                region: proposal?.region
              };
              console.log('📋 Fetching with params:', params);
              const [incomeResp, psResp, mooeResp, coResp] = await Promise.all([
                api.get('/income/getByParams', { params, signal: controller.signal }),
                api.get('/getpersonnels/byParams', { params, signal: controller.signal }),
                api.get('/mooe/getByParams', { params, signal: controller.signal }),
                api.get('/capital-outlay/getByParams', { params, signal: controller.signal })
              ]);
              const normalize = (r) => Array.isArray(r?.data) ? r.data : (r?.data?.data || []);
              const rawData = {
                income: normalize(incomeResp),
                personnelServices: normalize(psResp),
                mooe: normalize(mooeResp),
                capitalOutlay: normalize(coResp)
              };
              console.log('✅ Raw proposal data fetched successfully:', {
                incomeCount: rawData.income?.length || 0,
                psCount: rawData.personnelServices?.length || 0,
                mooeCount: rawData.mooe?.length || 0,
                coCount: rawData.capitalOutlay?.length || 0,
                rawData
              });
              setProposalData(rawData);
              cacheUpdate.proposalData = rawData;
            } catch (err) {
              console.error('❌ Error fetching raw proposal data:', err);
              throw err;
            }
          })()
        );
      } else if (isBudgetOfficer || isManagerLevel || requiresReadOnlyData) {
        console.log('📝 Fetching Budget Officer Edit data for BUDGET_OFFICER/MANAGER');
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

      // Prefetch comparison data only for roles that need it
      // Note: This may fail if no edits exist yet, which is normal
      // Fetch for Budget Analysts, Budget Officers, and read-only statuses (where comparison view is shown)
      if (isBudgetAnalyst || isBudgetOfficer || requiresReadOnlyData) {
        requests.push(
          getComparisonData(proposalKey, { signal: controller.signal })
            .then((response) => {
              const data = response?.data || response;
              setComparisonData(data);
              cacheUpdate.comparisonData = data;
            })
            .catch((err) => {
              // Silently handle 404 errors (no edits found yet)
              if (err?.response?.status === 404) {
                console.log('ℹ️ No comparison data available yet (no edits found)');
                setComparisonData(null);
                cacheUpdate.comparisonData = null;
              } else {
                // Re-throw other errors
                throw err;
              }
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
  }, [proposalKey, userInfo, isBudgetOfficer, isBudgetAnalyst, isBudgetCoordinator, isManagerLevel, proposal, isReadOnlyMode]);

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
    setOfficerEditMode(false); // Reset edit mode
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'Approved':
      case 'Finalized':
      case 'Manager Approved': return 'success';
      case 'Office Approved':
      case 'Coordinator Approved':
      case 'Officer Approved': return 'info';
      case 'Office Submitted':
      case 'Forwarded to Officer':
      case 'Forwarded to Manager': return 'secondary';
      case 'Submitted':
      case 'Division Submitted':
      case 'Under Review by Coordinator':
      case 'Under Review by Officer':
      case 'Under Review by Manager': return 'warning';
      case 'Returned': return 'error';
      case 'Draft': return 'default';
      default: return 'default';
    }
  };

  // Manager can edit when Office Submitted (per requirement)
  const managerCanEditNow = isManagerLevel && (proposal?.status === 'Office Submitted');

  // Budget Analyst can edit when proposal is in Draft or Returned status
  const analystCanEditNow = isBudgetAnalyst && (
    proposal?.status === 'Draft' || 
    proposal?.status === 'Division Draft' || 
    proposal?.status === 'Returned' ||
    proposal?.status === 'Returned to Division'
  );

  // Budget Coordinator can edit when proposal is Division Submitted (waiting for coordinator review)
  const coordinatorCanEditNow = isBudgetCoordinator && (
    proposal?.status === 'Division Submitted' ||
    proposal?.status === 'Under Review by Coordinator'
  );

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

            {/* Workflow Status Visualization */}
            <WorkflowStatusStepper 
              proposal={proposal} 
              isOfficeLevel={isOfficeCreator}
            />

            {/* Detailed Records Section */}
            <Typography variant="h6" gutterBottom>Detailed Records</Typography>

            {/* INFO: Show user's current role and workflow status */}
            {(isBudgetAnalyst || isBudgetCoordinator || isBudgetOfficer || isManagerLevel) && (
              <Alert 
                severity={isBudgetAnalyst && isBudgetCoordinator ? "warning" : "info"} 
                sx={{ mb: 2 }}
                icon={isBudgetAnalyst && isBudgetCoordinator ? <WarningIcon /> : <InfoIcon />}
              >
                <Typography variant="body2">
                  <strong>Your Role:</strong>{' '}
                  {isBudgetAnalyst && 'Budget Analyst (Creator)'}
                  {isBudgetCoordinator && !isBudgetAnalyst && 'Budget Coordinator (Approver)'}
                  {isBudgetOfficer && !isBudgetAnalyst && !isBudgetCoordinator && 'Budget Officer (Verifier)'}
                  {isManagerLevel && !isBudgetAnalyst && !isBudgetCoordinator && !isBudgetOfficer && 'Budget Manager (Final Approver)'}
                  <br />
                  
                  {isBudgetAnalyst && isBudgetCoordinator && (
                    <>
                      <strong>⚠️ Role Conflict:</strong> You have BOTH Analyst and Coordinator roles. 
                      Please contact your administrator to correct your role assignment.
                      <br />
                    </>
                  )}
                  
                  <strong>Current Status:</strong> {proposal?.status || 'Draft'}
                  <br />
                  
                  <strong>What you can do:</strong>{' '}
                  {isBudgetAnalyst && proposal?.status === 'Draft' && 'Create and edit proposals, then submit for approval'}
                  {isBudgetAnalyst && proposal?.status === 'Division Submitted' && 'Waiting for Budget Coordinator review'}
                  {isBudgetCoordinator && proposal?.status === 'Division Submitted' && 'Review and approve/return this proposal'}
                  {isBudgetOfficer && (proposal?.status === 'Division Approved' || proposal?.status === 'Office Submitted') && 'Verify and consolidate, then submit to Budget Manager'}
                  {isManagerLevel && proposal?.status === 'Office Submitted' && 'Final review and approval'}
                  {proposal?.status === 'Approved' && 'This proposal has been finalized'}
                </Typography>
              </Alert>
            )}

            {/* Budget Officer: Show comparison view first if there are changes from Budget Coordinator */}
            {!isReadOnlyMode && isBudgetOfficer && !isManagerLevel && comparisonData && !officerEditMode && proposal?.status === 'Office Submitted' && (
              <>
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    <strong>Budget Coordinator has submitted changes.</strong> Review the changes below, then click "Edit" to make additional modifications or submit to Budget Manager.
                  </Typography>
                </Alert>
                <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() => setOfficerEditMode(true)}
                    startIcon={<BusinessCenterIcon />}
                  >
                    Edit Proposal
                  </Button>
                </Box>
                <BudgetAnalystComparisonView 
                  comparisonData={comparisonData}
                  proposal={proposal}
                />
              </>
            )}

            {/* Show edit view for Budget Officer (when in edit mode), Budget Coordinator (when editable), Budget Analyst (when editable), and Budget Manager (when Office Submitted) */}
            {!isReadOnlyMode && ((isBudgetOfficer && (officerEditMode || !comparisonData || proposal?.status !== 'Office Submitted')) || coordinatorCanEditNow || analystCanEditNow || managerCanEditNow) && proposalData && proposal?.status !== 'Office Approved' && proposal?.status !== 'Approved' && (
              <>
                {managerCanEditNow && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      You are in Budget Manager edit mode (status: Office Submitted). Apply necessary changes below, then use Approve in the footer.
                    </Typography>
                  </Alert>
                )}
                {isBudgetOfficer && officerEditMode && comparisonData && (
                  <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Alert severity="info" sx={{ flex: 1, mr: 2 }}>
                      <Typography variant="body2">
                        You are editing on top of Budget Coordinator's changes. The form below shows their submitted values.
                      </Typography>
                    </Alert>
                    <Button
                      variant="outlined"
                      onClick={() => setOfficerEditMode(false)}
                    >
                      Back to Comparison
                    </Button>
                  </Box>
                )}
                <BudgetOfficerEditView 
                  proposal={proposal}
                  proposalData={proposalData}
                  onSaveSuccess={() => {
                    setOfficerEditMode(false);
                    loadData(true);
                  }}
                  variant={managerCanEditNow ? 'manager' : coordinatorCanEditNow ? 'coordinator' : analystCanEditNow ? 'analyst' : 'officer'}
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

            {/* Analyst comparison view when NOT in edit mode (Budget Analyst can only view when status is NOT Draft/Returned) */}
            {!isReadOnlyMode && isBudgetAnalyst && !analystCanEditNow && comparisonData && (
              <BudgetAnalystComparisonView 
                comparisonData={comparisonData}
                proposal={proposal}
              />
            )}

            {/* Coordinator comparison view when NOT in edit mode (Budget Coordinator can only view when status is NOT Division Submitted) */}
            {!isReadOnlyMode && isBudgetCoordinator && !coordinatorCanEditNow && comparisonData && (
              <BudgetAnalystComparisonView 
                comparisonData={comparisonData}
                proposal={proposal}
              />
            )}

            {/* Budget Coordinator warnings - check first to avoid conflicts */}
            {isBudgetCoordinator && !proposalData && !coordinatorCanEditNow && !loading && (
              <Alert severity="warning">
                No proposal data available for Budget Coordinator. Please try refreshing.
              </Alert>
            )}

            {/* Budget Officer warnings */}
            {isBudgetOfficer && !isManagerLevel && !proposalData && !loading && (
              <Alert severity="warning">
                No proposal data available. Please try refreshing.
              </Alert>
            )}

            {/* Manager warnings */}
            {isManagerLevel && !proposalData && !loading && (
              <Alert severity="warning">
                Submitted proposal details could not be loaded. Please try refreshing to retry.
              </Alert>
            )}

            {/* Budget Analyst warnings */}
            {isBudgetAnalyst && !comparisonData && !loading && (
              <Alert severity="warning">
                No comparison data available. The proposal may not have been edited yet.
              </Alert>
            )}

            {!isBudgetOfficer && !isBudgetAnalyst && !isBudgetCoordinator && !isManagerLevel && (
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