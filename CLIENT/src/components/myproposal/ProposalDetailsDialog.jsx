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
import CheckIcon from '@mui/icons-material/Check';
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

const ProposalDetailsDialog = ({ open, onClose, proposal, onRefresh }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [proposalData, setProposalData] = useState(null);
  const [comparisonData, setComparisonData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [officerEditMode, setOfficerEditMode] = useState(false); // Track if Budget Officer wants to edit
  const [displayedProposal, setDisplayedProposal] = useState(proposal); // Local copy for immediate status updates

  const cacheRef = useRef(new Map());
  const abortControllerRef = useRef(null);
  const workflowActionsRef = useRef(null);
  const budgetOfficerEditViewRef = useRef(null);
  const proposalKey = proposal?._id || null;

  const normalizedAssignmentLevel = useMemo(() => {
    const direct = String(userInfo?.assignmentLevel || '').toUpperCase();
    const hier = String(userInfo?.scope || '').toUpperCase();
    return direct || hier;
  }, [userInfo]);

  // moved: currentRoleLabel useMemo placed after dependencies are declared to avoid TDZ

  const normalizedWorkflowRoles = useMemo(() => {
    const a = (userInfo?.workflowRoles || []).map((role) => String(role || '').toLowerCase());
    const b = (userInfo?.workflowRoles || []).map((role) => String(role || '').toLowerCase());
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
    if (Array.isArray(userInfo?.userRoles)) collected.push(...userInfo.userRoles);
    if (Array.isArray(userInfo?.roles)) collected.push(...userInfo.roles);
    if (userInfo?.role) collected.push(userInfo.role);
    if (userInfo?.primaryRole) collected.push(userInfo.primaryRole);
    if (userInfo?.userRole) collected.push(userInfo.userRole);
    return collected.map((role) => String(role || '').toUpperCase());
  }, [userInfo]);

  const isManagerLevel = useMemo(() => {
    if (!userInfo) return false;
    // Manager level must be explicitly designated as Budget Manager/Admin or manager-level workflow role.
    const hasManagerPrimaryRole = normalizedPrimaryRoles.some((role) => (
      role === 'BUDGET MANAGER' ||
      role === 'BUDGET_MANAGER' ||
      role === 'BUDGET ADMIN' ||
      role === 'BUDGET_ADMIN' ||
      role === 'OVERALL_BUDGET_APPROVER'
    ));
    if (hasManagerPrimaryRole) return true;
    return normalizedWorkflowRoles.some((role) => (
      role === 'regionfinalverifier' ||
      role === 'regionalfinalverifier' ||
      role === 'managerapprover'
    ));
  }, [normalizedPrimaryRoles, normalizedWorkflowRoles, userInfo]);

  // Budget Manager: Check if ready to finalize (prominent button)
  const canBudgetManagerFinalize = useMemo(() => {
    if (!isManagerLevel && !normalizedPrimaryRoles.some((role) => role.includes('BUDGET MANAGER') || role.includes('BUDGET ADMIN'))) {
      return false;
    }
    const status = displayedProposal?.status || proposal?.status;
    return status === 'Forwarded to Overall Budget Approver' || status === 'Forwarded to Manager' || status === 'Officer Approved';
  }, [isManagerLevel, normalizedPrimaryRoles, displayedProposal?.status, proposal?.status]);

  // APPROVER: Division approvers (divisionapprover), Office approvers (officeapprover), or users with APPROVER role
  const isDivisionApprover = useMemo(() => {
    if (!userInfo) return false;
    // Check for 'divisionapprover' or 'officeapprover' workflow role OR 'APPROVER' in workflow or primary roles
    const hasWorkflowRole = normalizedWorkflowRoles.some((role) => role === 'divisionapprover' || role === 'officeapprover' || role === 'approver');
    const hasPrimaryRole = normalizedPrimaryRoles.some((role) => 
      role === 'APPROVER' || 
      role === 'DIVISION APPROVER' || 
      role === 'OFFICE APPROVER' ||
      role.includes('APPROVER')
    );
    const result = hasWorkflowRole || hasPrimaryRole;
    console.log('🔍 isDivisionApprover check:', {
      hasWorkflowRole,
      hasPrimaryRole,
      normalizedWorkflowRoles,
      normalizedPrimaryRoles,
      result
    });
    return result;
  }, [userInfo, normalizedWorkflowRoles, normalizedPrimaryRoles]);

  // Reviewer: Detect via workflowRoles OR primary roles (supports new label "BUDGET REVIEWER")
  const isReviewer = useMemo(() => {
    if (!userInfo) return false;
    // Accept either explicit workflow role or generic alias
    const hasWorkflowRole = normalizedWorkflowRoles.some((role) => 
      role === 'divisionreviewer' || role === 'reviewer'
    );
    // Also accept primary role labels
    const hasPrimaryRole = normalizedPrimaryRoles.some((role) => 
      role === 'BUDGET REVIEWER' || role === 'REVIEWER'
    );
    const result = hasWorkflowRole || hasPrimaryRole;
    if (result) {
      console.log('✅ isReviewer: TRUE', { hasWorkflowRole, hasPrimaryRole, normalizedWorkflowRoles, normalizedPrimaryRoles });
    } else {
      console.log('ℹ️ isReviewer: FALSE', { hasWorkflowRole, hasPrimaryRole, normalizedWorkflowRoles, normalizedPrimaryRoles });
    }
    return result;
  }, [userInfo, normalizedWorkflowRoles, normalizedPrimaryRoles]);

  // Robust reviewer alias usable across conditions
  const isBudgetReviewerRole = useMemo(() => {
    return isReviewer || normalizedPrimaryRoles.includes('BUDGET REVIEWER') || normalizedPrimaryRoles.includes('REVIEWER');
  }, [isReviewer, normalizedPrimaryRoles]);


  // PREPARER: Check for PREPARER role in user roles or workflow roles
  const isPreparer = useMemo(() => {
    if (!userInfo || isManagerLevel) return false;
    
    // Check user roles for PREPARER (matches WorkflowActions logic)
    const allRoles = [
      ...(userInfo?.roles || []),
      ...(userInfo?.Roles || []),
      ...(userInfo?.userRoles || []),
      ...(userInfo?.workflowRoles || [])
    ].map(role => String(role).toUpperCase());
    
    const hasPreparerRole = allRoles.includes('BUDGET PREPARER');
    
    // Also check for workflow roles as fallback
    const hasWorkflowRole = normalizedWorkflowRoles.some((role) => 
      role === 'divisioncreator' || 
      role === 'officecreator'
    );
    
    return hasPreparerRole || hasWorkflowRole;
  }, [userInfo, isManagerLevel, normalizedWorkflowRoles]);

  // Check if BUDGET_PLANNING_ANALYST is Office-level (officecreator) - they skip approver
  const isOfficeCreator = useMemo(() => {
    if (!isPreparer) return false;
    return normalizedWorkflowRoles.some((role) => role === 'officecreator');
  }, [isPreparer, normalizedWorkflowRoles]);

  // Budget Officer: Approver/Verifier ONLY (NOT a creator)
  // Receives proposals from:
  // - APPROVER (division-level proposals)
  // - PREPARER with officecreator (office-level proposals - direct)
  const isBudgetOfficer = useMemo(() => {
    if (!userInfo || isManagerLevel) return false;
    // Exclude users who are APPROVER or PREPARER (creators)
    if (normalizedWorkflowRoles.some((role) => 
      role === 'divisionapprover' || 
      role === 'divisioncreator' || 
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

  // APPROVER: Division Approvers (divisionapprover) and Office Approvers (officeapprover)
  // Can view and approve proposals routed to them
  const isApprover = useMemo(() => {
    if (!userInfo) return false;
    return normalizedWorkflowRoles.some((role) => 
      role === 'divisionapprover' || 
      role === 'officeapprover'
    );
  }, [userInfo, normalizedWorkflowRoles]);

  // BUDGET_PLANNING_ANALYST: User role that can analyze proposals forwarded by APPROVER (STEP 4 of 6-step workflow)
  const isBudgetPlanningAnalystRole = useMemo(() => {
    if (!userInfo) return false;
    
    // Check all possible role fields
    const allRoles = [
      ...(userInfo?.roles || []),
      ...(userInfo?.Roles || []),
      ...(userInfo?.workflowRoles || []),
      ...(userInfo?.userRoles || []),
      userInfo?.role,
      userInfo?.primaryRole,
      userInfo?.userRole
    ].filter(Boolean).map(role => String(role).toUpperCase());
    
    // Also check localStorage currentUser roles (for dev headers)
    try {
      const currentUserStr = localStorage.getItem('currentUser');
      if (currentUserStr) {
        const currentUser = JSON.parse(currentUserStr);
        if (currentUser?.Roles) {
          const localRoles = Array.isArray(currentUser.Roles) ? currentUser.Roles : [currentUser.Roles];
          allRoles.push(...localRoles.map(role => String(role).toUpperCase()));
        }
      }
    } catch (e) {
      // Ignore localStorage errors
    }
    
    return allRoles.includes('BUDGET_PLANNING_ANALYST') || 
           normalizedWorkflowRoles.includes('budgetanalyst') ||
           normalizedWorkflowRoles.includes('budget_analyst') || 
           normalizedWorkflowRoles.includes('BUDGET_PLANNING_ANALYST');
  }, [userInfo, normalizedWorkflowRoles]);

  // Fallback: derive reviewer by current workflow status when roles are missing
  const isReviewerStage = useMemo(() => (
    proposal?.status === 'Forwarded to Reviewer' || proposal?.status === 'Division Submitted'
  ), [proposal?.status]);
  const effectiveBudgetReviewer = useMemo(() => {
    if (isBudgetReviewerRole) return true;
    // If we're at reviewer stage and user is not clearly another privileged role, treat as reviewer for UI/edit
    return isReviewerStage && !isPreparer && !isBudgetOfficer && !isManagerLevel && !isApprover && !isBudgetPlanningAnalystRole;
  }, [isBudgetReviewerRole, isReviewerStage, isPreparer, isBudgetOfficer, isManagerLevel, isApprover, isBudgetPlanningAnalystRole]);

  // Derive a concise current role label for display (UI badge)
  const currentRoleLabel = useMemo(() => {
    if (!userInfo) return null;
    // Priority: Manager > Officer > Analyst > Approver > Reviewer > Preparer
    if (isManagerLevel) return 'Budget Manager';
    if (userInfo && normalizedWorkflowRoles.some(r => ['officeverifier','officefinalverifier','officeconsolidator'].includes(r))) return 'Budget Officer';
    if (isBudgetPlanningAnalystRole) return 'Budget Planning Analyst';
    if (isDivisionApprover) return 'Budget Approver';
    if (isReviewer) return 'Budget Reviewer';
    if (isPreparer) return 'Budget Preparer';
    return null;
  }, [userInfo, isManagerLevel, isBudgetPlanningAnalystRole, isDivisionApprover, isReviewer, isPreparer, normalizedWorkflowRoles]);

  // Canonical display label for the role chip
  const displayRoleLabel = useMemo(() => {
    if (isManagerLevel) return 'Overall Budget Approver';
    return currentRoleLabel;
  }, [isManagerLevel, currentRoleLabel]);

  // Read-only statuses (view mode) - MUST BE DEFINED BEFORE loadData callback
  const readOnlyStatuses = useMemo(() => (
    ['Finalized']
  ), []);
  const isReadOnlyMode = useMemo(() => readOnlyStatuses.includes(proposal?.status), [proposal?.status, readOnlyStatuses]);

  // Sync displayedProposal with parent proposal prop
  useEffect(() => {
    if (proposal) {
      setDisplayedProposal(proposal);
    }
  }, [proposal]);

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
          hierarchicalAccess: info
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
      isBudgetReviewer: isDivisionApprover,
      isBudgetOfficer,
      isPreparer,
      isReviewer,
      isManagerLevel,
      isApprover,
      normalizedPrimaryRoles,
      normalizedAssignmentLevel,
      normalizedWorkflowRoles,
      userInfo,
      forceRefresh
    });

    const cache = cacheRef.current;
    
    // CRITICAL FIX: If forceRefresh is true, immediately invalidate cache BEFORE anything else
    if (forceRefresh) {
      console.log('🔄 Force refresh requested - CLEARING all cache for proposal:', proposalKey);
      // Clear all cached data completely
      cache.clear();
      // Also explicitly set state to null to force re-render
      setProposalData(null);
      setComparisonData(null);
    }

    // After clearing cache, get fresh entry (should be undefined)
    const cachedEntry = cache.get(proposalKey);
    const now = Date.now();
    const hasCache = Boolean(cachedEntry);
    const isFresh = cachedEntry?.timestamp && (now - cachedEntry.timestamp < CACHE_TTL);

    // Only restore from cache if NOT forcing a refresh
    if (hasCache && !forceRefresh) {
      if (cachedEntry.proposalData) setProposalData(cachedEntry.proposalData);
      if (cachedEntry.comparisonData) setComparisonData(cachedEntry.comparisonData);
    }

    // If forceRefresh, skip the cache freshness check - always fetch new data
    if (!forceRefresh && isFresh) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    // Allow fetching for read-only final statuses even if role detection says no
  const requiresReadOnlyData = isReadOnlyMode;

    if (!isBudgetOfficer && !isPreparer && !isDivisionApprover && !effectiveBudgetReviewer && !isManagerLevel && !isApprover && !isBudgetPlanningAnalystRole && !requiresReadOnlyData) {
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

      // APPROVER, PREPARER, and REVIEWER fetch raw proposal data
      // BUDGET PLANNING ANALYST should fetch via getProposalForEdit to include approver edits/comparisons
      if (isBudgetPlanningAnalystRole) {
        console.log('🔎 Fetching proposal FOR EDIT for ANALYST (includes approver edits if any)', { proposalId: proposalKey });
        requests.push(
          (async () => {
            try {
              const response = await getProposalForEdit(proposalKey, { signal: controller.signal });
              const data = response?.data || response;
              console.log('✅ Analyst proposal-for-edit loaded:', {
                hasExistingEdit: data?.hasExistingEdit,
                editStatus: data?.editStatus,
                counts: {
                  income: data?.income?.length,
                  personnelServices: data?.personnelServices?.length,
                  mooe: data?.mooe?.length,
                  capitalOutlay: data?.capitalOutlay?.length
                }
              });
              setProposalData(data);
              cacheUpdate.proposalData = data;
            } catch (err) {
              console.warn('⚠️ Analyst proposal-for-edit failed, falling back to raw datasets', err?.message);
              // Fallback to raw datasets to avoid blank view
              const params = {
                fiscalYear: proposal?.fiscalYear,
                budgetType: proposal?.budgetType,
                processBy: proposal?.processBy,
                region: proposal?.region,
                status: proposal?.status
              };
              const [incomeResp, psResp, mooeResp, coResp] = await Promise.all([
                api.get('/income/getByParams', { params, signal: controller.signal }),
                api.get('/getpersonnels/byParams', { params, signal: controller.signal }),
                api.get('/mooe/getByParams', { params, signal: controller.signal }),
                api.get('/capital-outlay/getByParams', { params, signal: controller.signal })
              ]);
              const normalize = (r) => Array.isArray(r?.data) ? r.data : (r?.data?.data || []);
              const rawFallback = {
                income: normalize(incomeResp),
                personnelServices: normalize(psResp),
                mooe: normalize(mooeResp),
                capitalOutlay: normalize(coResp)
              };
              setProposalData(rawFallback);
              cacheUpdate.proposalData = rawFallback;
            }
          })()
        );
      } else if (isDivisionApprover || isPreparer || effectiveBudgetReviewer) {
        console.log('✅✅✅ BUDGET REVIEWER DATA FETCH TRIGGERED', {
          isDivisionApprover,
          isPreparer,
          isBudgetReviewerRole,
          effectiveBudgetReviewer,
          proposalId: proposalKey,
          timestamp: new Date().toISOString()
        });
        requests.push(
          (async () => {
            try {
              // FIX: Don't pass status for reviewers - proposal status changes don't update line item status
              // This was causing empty results when proposal moved to "Forwarded to Reviewer" but line items still had "Draft"
              const params = {
                fiscalYear: proposal?.fiscalYear,
                budgetType: proposal?.budgetType,
                processBy: proposal?.processBy,
                region: proposal?.region,
                // Status removed: Line items retain original status when proposal status changes
              };
              console.log('📋 Fetching with params (status excluded for reviewer):', params);
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
                isBudgetReviewerRole,
                rawData
              });
              console.log('🔥🔥🔥 SETTING proposalData for BUDGET REVIEWER:', {
                hasData: !!rawData,
                timestamp: new Date().toISOString()
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
        console.log('📝 Fetching Budget Officer Edit data for BUDGET_OFFICER/MANAGER', {
          isBudgetOfficer,
          isManagerLevel,
          requiresReadOnlyData
        });
        requests.push(
          (async () => {
            try {
              const response = await getProposalForEdit(proposalKey, { signal: controller.signal });
              let data = response?.data || response;
              
              // FIX: If editedData exists but arrays are empty, use the original data instead
              // This happens when Planning Analyst forwards without editing
              if (data?.editedData) {
                const hasEditedIncome = data.editedData.income?.length > 0;
                const hasEditedPS = data.editedData.personnelServices?.length > 0;
                const hasEditedMOOE = data.editedData.mooe?.length > 0;
                const hasEditedCO = data.editedData.capitalOutlay?.length > 0;
                const hasAnyEdits = hasEditedIncome || hasEditedPS || hasEditedMOOE || hasEditedCO;
                
                if (!hasAnyEdits && (data.income?.length > 0 || data.personnelServices?.length > 0 || data.mooe?.length > 0 || data.capitalOutlay?.length > 0)) {
                  // Remove editedData to force component to use original data
                  data = {
                    ...data,
                    hasExistingEdit: false,
                    editedData: null
                  };
                }
              }
              
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
      // Fetch for PREPARERs, Budget Officers, Reviewers, Approvers, and read-only statuses (where comparison view is shown)
      if (isPreparer || isBudgetOfficer || isBudgetPlanningAnalystRole || isBudgetReviewerRole || isDivisionApprover || requiresReadOnlyData) {
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
  }, [proposalKey, userInfo, isBudgetOfficer, isPreparer, isDivisionApprover, isManagerLevel, isApprover, isBudgetPlanningAnalystRole, proposal, isReadOnlyMode, isBudgetReviewerRole]);

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
      case 'Finalized': return 'success';
      case 'Officer Approved': return 'info';
      case 'Forwarded to Manager':
      case 'Forwarded to Overall Budget Approver':
      case 'Forwarded to Officer':
      case 'Forwarded to Budget Officer':
      case 'Forwarded to Analyst':
      case 'Forwarded to Budget Planning Analyst':
        return 'secondary';
      case 'Division Submitted': return 'warning';
      case 'Returned': return 'error';
      case 'Draft': return 'default';
      default: return 'default';
    }
  };

  // Manager can edit when Forwarded to Manager (per requirement)
  const managerCanEditNow = isManagerLevel && (
    proposal?.status === 'Forwarded to Overall Budget Approver' ||
    proposal?.status === 'Forwarded to Manager' // legacy
  );

  // PREPARER can edit when proposal is in Draft or Returned status (for creators)
  // But when Returned, only if the proposal is actually returned to them (workflowLevel is PREPARER)
  // BUDGET PLANNING ANALYST can edit when APPROVER already approved ("Approver Approved")
  //   or when explicitly forwarded to Analyst
  const preparerCanEditNow = (isPreparer && (
    proposal?.status === 'Draft' || 
    (proposal?.status === 'Returned' && (
      proposal?.workflowLevel === 'PREPARER' || 
      proposal?.currentAssigneeRole === 'PREPARER'
    ))
  )) || (
    isBudgetPlanningAnalystRole && (
      proposal?.status === 'Forwarded to Budget Planning Analyst' ||
      proposal?.status === 'Forwarded to Analyst' || // legacy
      proposal?.status === 'Approver Approved'
    )
  );

  // APPROVER edit window
  // - Reviewer stage: 'Division Submitted' (Reviewer acts here)
  // - Approver stage: 'Forwarded to Approver' (Approver acts here)
  // - Returned: Can edit when returned to them (workflowLevel is APPROVER)
  const approverCanEditNow = isDivisionApprover && (
    proposal?.status === 'Forwarded to Approver' ||
    (proposal?.status === 'Returned' && (
      proposal?.workflowLevel === 'APPROVER' || 
      proposal?.currentAssigneeRole === 'APPROVER'
    ))
  );

  // Reviewer can edit when proposal is at the reviewer step
  // Support both canonical and legacy statuses; use effectiveBudgetReviewer fallback
  // When Returned, only if the proposal is actually returned to them (workflowLevel is REVIEWER)
  const reviewerCanEditNow = effectiveBudgetReviewer && (
    proposal?.status === 'Forwarded to Reviewer' ||
    proposal?.status === 'Division Submitted' ||
    (proposal?.status === 'Returned' && (
      proposal?.workflowLevel === 'REVIEWER' || 
      proposal?.currentAssigneeRole === 'REVIEWER'
    ))
  );

  // Check if current user has already submitted this proposal to a later step
  // If they have, they should only be able to view, not edit
  const hasUserAlreadySubmitted = useMemo(() => {
    if (!userInfo?.userId || !proposal?.workflowHistory) return false;

    const userId = userInfo.userId;
    const submitActions = [
      'PREPARER_SUBMIT_TO_REVIEWER',
      'REVIEWER_SUBMIT_TO_OFFICER',
      'REVIEWER_SUBMIT_TO_MANAGER',
      'APPROVER_APPROVE_TO_ANALYST',
      'ANALYST_SUBMIT_TO_OFFICER',
      'OFFICER_SUBMIT_TO_MANAGER',
      'MANAGER_APPROVE'
    ];

    // Check if user has performed any submit action on this proposal
    return proposal.workflowHistory.some(history => 
      history.userId === userId && submitActions.includes(history.action)
    );
  }, [userInfo?.userId, proposal?.workflowHistory]);

  // Define workflow step order to determine if user should be in view-only mode
  const getWorkflowStepOrder = (status) => {
    const stepMap = {
      'Draft': 1,                           // PREPARER
      'Division Submitted': 2,              // REVIEWER
      'Forwarded to Reviewer': 2,           // REVIEWER
      'Forwarded to Approver': 3,           // APPROVER
      'Approver Approved': 4,               // After APPROVER approves, forward to BUDGET_PLANNING_ANALYST
      'Forwarded to Budget Planning Analyst': 4, // BUDGET_PLANNING_ANALYST (canonical)
      'Forwarded to Analyst': 4,            // BUDGET_PLANNING_ANALYST (legacy)
      'Forwarded to Budget Officer': 5,     // BUDGET_OFFICER
      'Forwarded to Overall Budget Approver': 6, // OVERALL_BUDGET_APPROVER (canonical)
      'Forwarded to Manager': 6,            // OVERALL_BUDGET_APPROVER (legacy)
      'Finalized': 7,                       // FINALIZED
      'Returned': 1,                        // RETURNED to PREPARER
      // Legacy statuses
      'Under Review by Reviewer': 2,
      'Reviewer Approved': 2,
      'Under Review by Officer': 3,
      'Officer Approved': 5,
      'Under Review by Manager': 6,
      'Office Submitted': 6
    };
    return stepMap[status] || 0;
  };

  const getUserWorkflowStep = () => {
    if (effectiveBudgetReviewer) return 2; // REVIEWER
    if (isDivisionApprover) return 3; // APPROVER
    if (isBudgetPlanningAnalystRole) return 4; // BUDGET_PLANNING_ANALYST
    if (isBudgetOfficer && !isManagerLevel) return 5; // BUDGET_OFFICER
    if (isManagerLevel) return 6; // BUDGET_MANAGER
    return 1; // PREPARER or other
  };

  // If proposal is at a step that comes after the user's role, they can only view
  const currentProposalStep = getWorkflowStepOrder(proposal?.status);
  const userStep = getUserWorkflowStep();
  const isViewOnlyAfterSubmission = currentProposalStep > userStep;

  const officerModeActive = !isReadOnlyMode && isBudgetOfficer && !isManagerLevel;
  // Consider comparison "present" only if it has meaningful changes/content
  const hasComparisonData = useMemo(() => {
    const d = comparisonData;
    if (!d) return false;
    // Common shapes: arrays per module or a generic changes list/flags
    const arrays = [
      d?.income,
      d?.personnelServices,
      d?.mooe,
      d?.capitalOutlay,
      d?.changes,
      d?.items
    ].filter(Array.isArray);
    if (arrays.some(arr => arr && arr.length > 0)) return true;
    // Fallback booleans that some services return
    if (d?.hasChanges === true || d?.hasDiff === true) return true;
    return false;
  }, [comparisonData]);

  const officerReadOnlyTables = officerModeActive && hasComparisonData && !officerEditMode;
  const officerShowTables = officerModeActive ? (!comparisonData || officerEditMode) : true;
  
  // FIX: Budget Officer should bypass officerReadOnlyTables when status is "Forwarded to Budget Officer"
  // This ensures they can always edit, even if there's comparison data
  const bypassOfficerReadOnly = isBudgetOfficer && !isManagerLevel && (
    proposal?.status === 'Forwarded to Budget Officer' || 
    proposal?.status === 'Forwarded to Officer'
  );
  
  // Do not allow rendering the full edit view when officer comparison-only tables are active
  // OR when user is viewing after their submission step (should only see comparison view)
  // UNLESS: Budget Officer is viewing their own assigned proposal (bypassOfficerReadOnly)
  const canRenderEditView = !isReadOnlyMode && proposalData && (!officerReadOnlyTables || bypassOfficerReadOnly) && !isViewOnlyAfterSubmission && proposal?.status !== 'Officer Approved' && proposal?.status !== 'Approved' && (
    (isBudgetOfficer && !isManagerLevel) ||
    approverCanEditNow ||
    preparerCanEditNow ||
    reviewerCanEditNow ||
    managerCanEditNow ||
    (proposal?.status === 'Draft' && !isBudgetOfficer && !isPreparer && !isDivisionApprover && !isManagerLevel && !isApprover && !isBudgetReviewerRole)
  );

  // Determine if user should see comparison/audit trail view instead of editable tables
  // NOTE: Budget Reviewers should use shouldShowReadOnlyTables instead when there's no comparison data
  const shouldShowComparisonView = !isReadOnlyMode && hasComparisonData && (
    isViewOnlyAfterSubmission ||
    (!approverCanEditNow && isApprover) ||
    (!preparerCanEditNow && isPreparer)
  );

  // Determine if user should see read-only tables when they cannot edit and no comparison data exists
  // Show for APPROVER and REVIEWER as a fallback when comparison data is not available
  // NOTE: Budget Reviewer should ALWAYS see tables if they have access (removing !hasComparisonData requirement for viewers)
  const shouldShowReadOnlyTables = !isReadOnlyMode && proposalData && !officerReadOnlyTables && (
    ((!approverCanEditNow && isApprover) && !hasComparisonData) ||
    (effectiveBudgetReviewer && !canRenderEditView)  // Reviewer sees read-only when they can't access edit view
  );
  
  // Debug: Log shouldShowReadOnlyTables calculation for Budget Reviewer
  if (isBudgetReviewerRole) {
    console.log('📊 shouldShowReadOnlyTables CALCULATION:', {
      condition1_notReadOnly: !isReadOnlyMode,
      condition2_hasProposalData: !!proposalData,
      condition3_notOfficerReadOnly: !officerReadOnlyTables,
      condition4A_approver: (!approverCanEditNow && isApprover) && !hasComparisonData,
      condition4B_reviewer: effectiveBudgetReviewer && !canRenderEditView,
      FINAL_shouldShowReadOnlyTables: shouldShowReadOnlyTables,
      '---': '---',
      effectiveBudgetReviewer,
      isBudgetReviewerRole,
      canRenderEditView,
      reviewerCanEditNow,
      isReadOnlyMode,
      proposalData: proposalData ? `{income: ${proposalData.income?.length}, ps: ${proposalData.personnelServices?.length}, mooe: ${proposalData.mooe?.length}, co: ${proposalData.capitalOutlay?.length}}` : 'NULL',
      officerReadOnlyTables,
      proposal_status: proposal?.status,
      proposal_workflowLevel: proposal?.workflowLevel
    });
  }

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
            {displayRoleLabel && (
              <Chip 
                label={displayRoleLabel} 
                color="primary" 
                variant="outlined"
                sx={{ fontWeight: 600 }}
              />
            )}
            <Chip 
              label={displayedProposal?.status || 'Unknown'} 
              color={getStatusColor(displayedProposal?.status)} 
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

            {/* Show a lightweight loader while fetching data to avoid an empty section */}
            {loading && (
              <Box sx={{ mt: 1, mb: 2 }}>
                <LinearProgress />
              </Box>
            )}

            {/* DEBUG: Log all rendering conditions */}
            {console.log('🎯 DETAILED RECORDS RENDERING DEBUG:', {
              proposalStatus: proposal?.status,
              isReadOnlyMode,
              canRenderEditView,
              shouldShowReadOnlyTables,
              shouldShowComparisonView,
              isViewOnlyAfterSubmission,
              hasComparisonData,
              proposalDataExists: !!proposalData,
              comparisonDataExists: !!comparisonData,
              currentStep: getWorkflowStepOrder(proposal?.status),
              userStep: getUserWorkflowStep(),
              isBudgetReviewerRole,
              reviewerCanEditNow,
              approverCanEditNow,
              preparerCanEditNow,
              managerCanEditNow,
              officerReadOnlyTables,
              officerModeActive
            })}

            {/* TEMPORARILY HIDDEN - INFO: Show user's current role and workflow status */}
            {false && (isPreparer || isDivisionApprover || isBudgetOfficer || isManagerLevel || isBudgetReviewerRole) && (
              <Alert 
                severity={isPreparer && isDivisionApprover ? "warning" : "info"} 
                sx={{ mb: 2 }}
                icon={isPreparer && isDivisionApprover ? <WarningIcon /> : <InfoIcon />}
              >
                <Typography variant="body2">
                  <strong>Your Role:</strong>{' '}
                  {isPreparer && 'PREPARER (Creator)'}
                  {isDivisionApprover && !isPreparer && 'APPROVER (Division)'}
                  {isBudgetOfficer && !isPreparer && !isDivisionApprover && 'BUDGET_OFFICER (Verifier)'}
                  {isManagerLevel && !isPreparer && !isDivisionApprover && !isBudgetOfficer && 'OVERALL_BUDGET_APPROVER (Final)'}
                  <br />
                  
                  {isPreparer && isDivisionApprover && (
                    <>
                      <strong>⚠️ Role Conflict:</strong> You have BOTH Preparer and Approver roles. 
                      Please contact your administrator to correct your role assignment.
                      <br />
                    </>
                  )}
                  
                  <strong>Current Status:</strong> {proposal?.status || 'Draft'}
                  <br />
                  
                  <strong>What you can do:</strong>{' '}
                  {isPreparer && proposal?.status === 'Draft' && 'Create and edit proposals, then submit for approval'}
                  {isPreparer && proposal?.status === 'Division Submitted' && 'Waiting for Approver review'}
                  {isDivisionApprover && proposal?.status === 'Division Submitted' && 'Review and approve/return this proposal'}
                  {isBudgetOfficer && ((proposal?.status === 'Forwarded to Budget Officer' || proposal?.status === 'Forwarded to Officer') || proposal?.status === 'Officer Approved') && 'Verify and consolidate, then submit to Overall Budget Approver'}
                  {isManagerLevel && (proposal?.status === 'Forwarded to Overall Budget Approver' || proposal?.status === 'Forwarded to Manager') && 'Final review and approval'}
                  {proposal?.status === 'Finalized' && 'This proposal has been finalized'}
                </Typography>
              </Alert>
            )}

            {/* TEMPORARILY HIDDEN - PREPARER Edit Mode Information */}
            {false && isPreparer && canRenderEditView && proposal?.status === 'Draft' && (
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>PREPARER Edit Mode:</strong> You can edit all four tables below. Make necessary updates and submit for approver review.
                </Typography>
              </Alert>
            )}

            {/* TEMPORARILY HIDDEN - Budget Summary for PREPARER */}
            {false && isPreparer && proposalData && (
              <Paper sx={{ p: 2, mb: 2, backgroundColor: '#f8f9fa' }}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  📊 Budget Summary (Totals):
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    ✓ <strong>Personnel Services:</strong> ₱{proposalData.personnelServices?.reduce((sum, item) => sum + (item.totalAmount || 0), 0)?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                  </Typography>
                  <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    ✓ <strong>MOOE:</strong> ₱{proposalData.mooe?.reduce((sum, item) => sum + (item.totalAmount || 0), 0)?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                  </Typography>
                  <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    ✓ <strong>Capital Outlay:</strong> ₱{proposalData.capitalOutlay?.reduce((sum, item) => sum + (item.totalAmount || 0), 0)?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                  </Typography>
                  <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    ✓ <strong>Income:</strong> ₱{proposalData.income?.reduce((sum, item) => sum + (item.totalAmount || 0), 0)?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                  </Typography>
                </Box>
              </Paper>
            )}

            {/* TEMPORARILY HIDDEN - Warning for PREPARER about required modules */}
            {false && isPreparer && proposalData && proposal?.status === 'Draft' && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  ⚠️ <strong>Before submitting, please ensure all required modules have positive amounts:</strong> MOOE, Capital Outlay, Income
                </Typography>
              </Alert>
            )}

            {/* Budget Officer: Show comparison view first if there are changes from previous steps (APPROVER or PLANNING ANALYST) */}
            {/* BUT: If no comparison data, skip this and go directly to edit view */}
            {!isReadOnlyMode && isBudgetOfficer && !isManagerLevel && comparisonData && !officerEditMode && (proposal?.status === 'Forwarded to Budget Officer' || proposal?.status === 'Forwarded to Officer') && (
              <>
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    <strong>Previous steps have submitted changes.</strong> Review the changes below, then click the <strong>Edit</strong> button to make additional modifications or submit to Budget Manager.
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

            {/* Show edit view for Budget Officer (when in edit mode), APPROVER (when editable), BUDGET_PLANNING_ANALYST (when editable), and Budget Manager (when Forwarded to Manager) */}
            {canRenderEditView && (
              <>
                {managerCanEditNow && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      You are in Budget Manager edit mode (status: Forwarded to Manager). Apply necessary changes below, then use Approve in the footer.
                    </Typography>
                  </Alert>
                )}
                {isBudgetOfficer && officerReadOnlyTables && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      Review the comparison above. Select <strong>Edit Proposal</strong> if you need to modify any entries, or use the actions below to submit directly to the Budget Manager.
                    </Typography>
                  </Alert>
                )}
                <BudgetOfficerEditView 
                  ref={budgetOfficerEditViewRef}
                  proposal={proposal}
                  proposalData={proposalData}
                  onSaveSuccess={async () => {
                    // IMPORTANT: Fetch updated proposal to show new status immediately
                    try {
                      const updatedProposal = await api.get(`/proposals/${proposalKey}`);
                      if (updatedProposal?.data) {
                        console.log('✅ Updated proposal fetched:', { 
                          oldStatus: displayedProposal?.status, 
                          newStatus: updatedProposal.data.status 
                        });
                        setDisplayedProposal(updatedProposal.data);
                        
                        // Check if status actually changed
                        const statusChanged = updatedProposal.data.status !== displayedProposal?.status;
                        
                        if (statusChanged) {
                          console.log('📤 Status changed - this was a SUBMIT operation, closing dialog');
                          // Refresh all data after submission since status changed
                          loadData(true);
                          
                          // Close dialog after 1.5 seconds
                          setTimeout(() => {
                            handleClose();
                          }, 1500);
                        } else {
                          console.log('💾 DRAFT saved - fetching fresh data to verify edits persisted');
                          // 🔧 FIX: After draft save, FORCE refresh to fetch fresh data including draft edits
                          // This ensures proposalData is updated with hasExistingEdit=true and editedData
                          const cacheSize = cacheRef.current.size;
                          cacheRef.current.clear();
                          console.log('🗑️ Cache cleared - removed', cacheSize, 'items');
                          console.log('📊 Cache size after clear:', cacheRef.current.size);
                          
                          // Force a data refresh to load the newly saved draft edits
                          // The delay ensures the backend has processed the save
                          setTimeout(() => {
                            console.log('⏳ Calling loadData(true) after 500ms delay');
                            console.log('📊 Cache size before loadData:', cacheRef.current.size);
                            loadData(true);
                          }, 500);
                          
                          setOfficerEditMode(false);
                          
                          // Just refresh the parent list so it shows updated timestamps
                          onRefresh?.();
                        }
                      }
                    } catch (error) {
                      console.error('Could not fetch updated proposal immediately:', error);
                      setOfficerEditMode(false);
                      // Refresh parent list anyway
                      onRefresh?.();
                    }
                  }}
                  variant={(() => {
                    // ⚠️ FIX: Check specific workflow roles BEFORE generic manager level
                    // When user is APPROVER, show 'approver' variant even if they also have manager permissions
                    // Priority: APPROVER → REVIEWER → BUDGET_OFFICER → PREPARER → MANAGER
                    const variant = isDivisionApprover
                      ? 'approver'
                      : effectiveBudgetReviewer
                      ? 'reviewer'
                      : isBudgetPlanningAnalystRole
                      ? 'analyst'
                      : isBudgetOfficer
                      ? 'officer'
                      : isPreparer
                      ? 'preparer'
                      : isManagerLevel
                      ? 'manager'
                      : 'officer';
                    console.log('🎭 Variant determination:', {
                      isManagerLevel,
                      isDivisionApprover,
                      isReviewer,
                      effectiveBudgetReviewer,
                      isBudgetPlanningAnalystRole,
                      isBudgetOfficer,
                      isPreparer,
                      variant
                    });
                    return variant;
                  })()}
                  allowSubmit={!managerCanEditNow && !isViewOnlyAfterSubmission}
                  showTables={officerShowTables || isViewOnlyAfterSubmission}
                  readOnly={isViewOnlyAfterSubmission || (!approverCanEditNow && isApprover) || (!reviewerCanEditNow && isBudgetReviewerRole) || (!preparerCanEditNow && isPreparer)}
                  showSaveDraftButton={false}
                />
              </>
            )}

            {/* ✅ READ-ONLY TABLES: Show read-only tables for APPROVER and BUDGET REVIEWER when they can't edit and have no comparison data */}
            {shouldShowReadOnlyTables && (
              <>
                {console.log('✅ Rendering READ-ONLY TABLES for:', {
                  isApprover,
                  isBudgetReviewerRole,
                  status: proposal?.status,
                  hasComparisonData,
                  proposalDataExists: !!proposalData
                })}
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    <strong>📊 View Mode:</strong> {
                      isApprover ? 'You have already approved this proposal.' :
                      isBudgetReviewerRole ? 'You are reviewing this proposal.' :
                      'You cannot edit at this stage.'
                    }
                    {proposal?.status === 'Approver Approved' && ' The proposal has been forwarded to Budget Planning Analyst for review.'}
                    {(proposal?.status === 'Forwarded to Budget Planning Analyst' || proposal?.status === 'Forwarded to Analyst') && ' The proposal is now with the Budget Planning Analyst.'}
                    <br />
                    <em>Status: {proposal?.status} • You cannot edit at this stage</em>
                  </Typography>
                </Alert>
                <BudgetOfficerEditView
                  ref={budgetOfficerEditViewRef}
                  proposal={proposal}
                  proposalData={proposalData}
                  variant={isApprover ? 'approver' : (isBudgetReviewerRole ? 'reviewer' : 'officer')}
                  allowSubmit={false}
                  showTables={true}
                  readOnly={true}
                  showSaveDraftButton={false}
                />
              </>
            )}

            {/* MISSING DATA DEBUG: Show alert if BUDGET REVIEWER should see tables but proposalData is missing */}
            {(effectiveBudgetReviewer || isBudgetReviewerRole) && !proposalData && !loading && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  ⚠️ <strong>Proposal data is loading or unavailable.</strong> Please try refreshing the page. 
                  <br />
                  (Debug: Reviewer path active but proposalData is empty. Status: {proposal?.status})
                </Typography>
              </Alert>
            )}

            {/* DEBUG: Show detailed condition state for Budget Reviewer */}
            {isBudgetReviewerRole && (
              (() => {
                const state = {
                  isBudgetReviewerRole,
                  shouldShowReadOnlyTables,
                  shouldShowComparisonView,
                  canRenderEditView,
                  proposalData: !!proposalData,
                  reviewerCanEditNow,
                  hasComparisonData,
                  officerReadOnlyTables,
                  isReadOnlyMode,
                  proposal_status: proposal?.status,
                  loading
                };
                console.log('🔍 BUDGET REVIEWER CONDITION STATE:', state);
                
                // Determine which path will render
                let renderPath = 'NONE';
                if (canRenderEditView) renderPath = 'EDIT VIEW (canRenderEditView)';
                else if (shouldShowComparisonView) renderPath = 'COMPARISON VIEW (shouldShowComparisonView)';
                else if (shouldShowReadOnlyTables) renderPath = 'READ-ONLY TABLES (shouldShowReadOnlyTables at line 1104)';
                else renderPath = '❌ NO RENDER PATH AVAILABLE ❌';
                
                console.log('📍 BUDGET REVIEWER RENDER PATH:', renderPath);
                
                return null;
              })()
            )}

            {/* COMPREHENSIVE DEBUG: Show what conditions are preventing Budget Reviewer from seeing content */}
            {(effectiveBudgetReviewer || isBudgetReviewerRole) && !shouldShowReadOnlyTables && !shouldShowComparisonView && !canRenderEditView && !loading && (
              <Alert severity="error" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  ❌ <strong>No rendering path available for Budget Reviewer.</strong>
                  <br />
                  Debug info: shouldShowReadOnlyTables={String(shouldShowReadOnlyTables)}, proposalData exists={!!proposalData}, 
                  isViewOnlyAfterSubmission={String(isViewOnlyAfterSubmission)}, reviewerCanEditNow={String(reviewerCanEditNow)}, hasComparisonData={String(hasComparisonData)}
                </Typography>
              </Alert>
            )}

            {/* ✅ COMPARISON VIEW: Show audit trail with change indicators for PREPARER, REVIEWER, APPROVER when they can't edit */}
            {shouldShowComparisonView && (
              <>
                {console.log('🔍 Rendering COMPARISON VIEW for:', {
                  isPreparer,
                  isDivisionApprover,
                  isReviewer,
                  isBudgetPlanningAnalystRole,
                  isBudgetOfficer,
                  isManagerLevel,
                  status: proposal?.status,
                  hasComparisonData: !!comparisonData,
                  isViewOnlyAfterSubmission
                })}
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    <strong>📊 Audit Trail - Changes Made by Next Step:</strong>
                    {isPreparer && ' See what the Reviewer/Approver changed after you submitted.'}
                    {isReviewer && ' See what the Approver changed after you approved.'}
                    {isDivisionApprover && ' See what the Budget Planning Analyst changed after you approved.'}
                    {isBudgetPlanningAnalystRole && ' See what the Budget Officer changed after you submitted.'}
                    {isBudgetOfficer && ' See what the Budget Manager changed after you submitted.'}
                    {isManagerLevel && ' Final approval changes visible.'}
                    <br />
                    <em>Status: {proposal?.status} • You cannot edit at this stage</em>
                  </Typography>
                </Alert>
                <BudgetAnalystComparisonView
                  comparisonData={comparisonData}
                  proposal={proposal}
                />
              </>
            )}

            {/* ℹ️ DUPLICATE REMOVED: This block was rendering AUDIT TRAIL twice when shouldShowComparisonView was already active */}
            {/* The shouldShowComparisonView block (line 1150) now handles ALL cases including isViewOnlyAfterSubmission */}

            {/* ✅ VIEW-ONLY MODE: Show comparison or full submission view when proposal is Finalized */}
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

            {/* Legacy comparison views - now consolidated into the shouldShowComparisonView section above */}

            {/* TEMPORARILY HIDDEN - APPROVER warnings */}
            {false && isDivisionApprover && !proposalData && !approverCanEditNow && !loading && (
              <Alert severity="warning">
                No proposal data available for APPROVER. Please try refreshing.
              </Alert>
            )}

            {/* TEMPORARILY HIDDEN - Budget Officer warnings */}
            {false && isBudgetOfficer && !isManagerLevel && !proposalData && !loading && (
              <Alert severity="warning">
                No proposal data available. Please try refreshing.
              </Alert>
            )}

            {/* TEMPORARILY HIDDEN - Manager warnings */}
            {false && isManagerLevel && !proposalData && !loading && (
              <Alert severity="warning">
                Submitted proposal details could not be loaded. Please try refreshing to retry.
              </Alert>
            )}

            {/* TEMPORARILY HIDDEN - BUDGET_PLANNING_ANALYST warnings */}
            {false && isPreparer && !comparisonData && !loading && (
              <Alert severity="warning">
                No comparison data available. The proposal may not have been edited yet.
              </Alert>
            )}

            {/* Fallback view for BUDGET_PLANNING_ANALYST when they can't edit and have no comparison data */}
            {!isReadOnlyMode && isPreparer && !preparerCanEditNow && !comparisonData && proposalData && (
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>Analysis View:</strong> This proposal is available for your analysis. 
                  No edits have been made yet, or comparison data is not available.
                </Typography>
              </Alert>
            )}

            {/* ✅ READ-ONLY VIEW FOR BUDGET REVIEWER: Show detailed records when reviewer cannot edit */}
            {(() => {
              const show = shouldShowReadOnlyTables && isBudgetReviewerRole && proposalData;
              console.log('🔍 REVIEWER RENDER CHECK:', {
                shouldShowReadOnlyTables,
                isBudgetReviewerRole,
                hasProposalData: !!proposalData,
                finalShow: show
              });
              if (show) console.log('✅ Rendering BUDGET REVIEWER read-only tables view');
              return show && (
                <>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      <strong>📋 Detailed Records (Read-Only):</strong> View the proposal details as submitted by the preparer.
                      <br />
                      <em>Status: {proposal?.status} • You cannot edit at this stage</em>
                    </Typography>
                  </Alert>
                  <BudgetManagerSubmissionView 
                    proposalData={proposalData}
                    proposal={proposal}
                  />
                </>
              );
            })()}

            {/* TEMPORARILY HIDDEN - Permission denied alert */}
            {false && !isBudgetOfficer && !isBudgetAnalyst && !isDivisionApprover && !isManagerLevel && (
              <Alert severity="info">
                You do not have permission to view detailed records for this proposal.
                <br />
                <Typography variant="caption">
                  Scope: {userInfo?.scope || 'Unknown'}, Workflow Roles: {userInfo?.workflowRoles?.join(', ') || 'None'}
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
        
        Workflow Actions - Show only if user has appropriate role and proposal is not in final state
        {proposal && userInfo && proposal.status !== 'Finalized' && (
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* PROMINENT FINALIZE BUTTON FOR BUDGET MANAGER - Visible when ready to finalize */}
            {canBudgetManagerFinalize && (
              <Button
                variant="contained"
                startIcon={<CheckIcon sx={{ fontSize: '18px' }} />}
                sx={{ 
                  fontWeight: 600,
                  backgroundColor: '#1b7a3b',
                  color: '#ffffff',
                  textTransform: 'none',
                  fontSize: '14px',
                  px: 3,
                  py: 1.2,
                  borderRadius: '6px',
                  boxShadow: '0 2px 8px rgba(27, 122, 59, 0.3)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': { 
                    backgroundColor: '#155a30',
                    boxShadow: '0 4px 12px rgba(27, 122, 59, 0.4)',
                    transform: 'translateY(-1px)'
                  },
                  '&:active': {
                    transform: 'translateY(0)',
                    boxShadow: '0 2px 6px rgba(27, 122, 59, 0.3)'
                  },
                  '&:disabled': {
                    backgroundColor: '#b0bfb8',
                    color: '#ffffff',
                    boxShadow: 'none'
                  }
                }}
                onClick={() => {
                  // Open confirmation dialog for finalization
                  console.log('💚 Prominent Finalize button clicked');
                  if (workflowActionsRef.current) {
                    // Trigger the finalize action - the WorkflowActions component will handle the dialog
                    // by directly calling its handleActionClick method via ref
                    workflowActionsRef.current?.triggerFinalizeAction?.();
                  }
                }}
                disabled={loading || refreshing}
                title="Click to finalize this proposal"
              >
                Finalize Proposal
              </Button>
            )}
            
            <WorkflowActions
              ref={workflowActionsRef}
              proposal={proposal}
              userInfo={userInfo}
              restrictToRole={
                isPreparer
                  ? 'BUDGET_PREPARER'
                  : effectiveBudgetReviewer
                    ? 'BUDGET_REVIEWER'
                    : (isApprover || isDivisionApprover)
                      ? 'BUDGET_APPROVER'
                      : isBudgetPlanningAnalystRole
                        ? 'BUDGET_PLANNING_ANALYST'
                        : isBudgetOfficer
                          ? 'BUDGET_OFFICER'
                          : isManagerLevel
                            ? 'OVERALL_BUDGET_APPROVER'
                            : null
              }
              getTableData={() => budgetOfficerEditViewRef.current?.getCurrentEditData?.()}
              onRefresh={(updatedProposal, forceFlag, triggeredAction) => {
                console.log('🔄 onRefresh callback triggered:', {
                  hasUpdatedProposal: !!updatedProposal,
                  forceFlag,
                  status: updatedProposal?.status,
                  triggeredAction
                });
                
                // IMMEDIATE UPDATE: If we have the updated proposal, show it immediately
                if (updatedProposal) {
                  console.log('✅ Immediately updating UI with fresh proposal data:', {
                    oldStatus: displayedProposal?.status,
                    newStatus: updatedProposal.status
                  });
                  // Update BOTH displayedProposal (for status badge) AND proposalData (for tables)
                  setDisplayedProposal(updatedProposal);
                  setProposalData(updatedProposal);
                }
                
                // THEN: Force re-fetch in background to ensure all related data is fresh
                // The forceFlag ensures cache is completely bypassed
                // This will trigger loadData(true) which clears cache at the start
                loadData(true);

                const actionTag = String(triggeredAction || '').toLowerCase();
                const statusTag = String(updatedProposal?.status || '').toLowerCase();
                const shouldAutoClose = actionTag.includes('return') || statusTag.includes('return');
                if (shouldAutoClose) {
                  console.log('🟡 Auto-closing dialog after return action');
                  setTimeout(() => {
                    handleClose();
                  }, 1200);
                }
              }}
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