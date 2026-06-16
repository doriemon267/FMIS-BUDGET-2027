import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  CircularProgress,
  Alert,
  Grid,
  Chip,
  TextField,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  TablePagination,
  IconButton,
  Tooltip,
  Stack,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Autocomplete,
  Switch,
  FormControlLabel,
  Checkbox,
  FormGroup
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../config/api';
import DashboardHeader from '../global/components/DashboardHeader';
import CustomSnackbar from '../global/components/CustomSnackbar';
import { useUser } from '../context/UserContext';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  Domain as DomainIcon,
  Assignment as AssignmentIcon,
  AccountTree as HierarchyIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon
} from '@mui/icons-material';
// Session validity determined by server-side session cookie; no client-side JWT checks

const ACCESS_LEVELS = [
  { value: 'RESPONSIBILITY_CENTER', label: 'Responsibility Center Level', icon: <BusinessIcon />, color: '#2196F3' },
  { value: 'OFFICE', label: 'Office Level', icon: <DomainIcon />, color: '#FF9800' },
  { value: 'BUDGET_AND_REVENUE_DIVISION', label: 'Budget Revenue Division Level', icon: <HierarchyIcon />, color: '#9C27B0' },
  { value: 'FULL', label: 'Full (Admin)', icon: <HierarchyIcon />, color: '#4A148C' },
  // { value: 'OWN_ONLY', label: 'Own Records Only', icon: <PersonIcon />, color: '#757575' }
];

// New unified workflow roles (September 2025)
// ✅ STANDARDIZED: All role names use underscores (BUDGET_PREPARER, not BUDGET PREPARER)
const USER_ROLES = [
  {
    value: 'BUDGET_PREPARER',
    label: 'Budget Preparer',
    description: 'Creates and edits budget proposals',
    workflowRoles: 'BUDGET_PREPARER (creates proposals)',
    assignmentLevels: ['DIVISION_LEVEL', 'DEPARTMENT_REGIONAL_LEVEL']
  },
  { 
    value: 'BUDGET_REVIEWER', 
    label: 'Budget Reviewer', 
    description: 'Reviews proposals for quality assurance (Division level only)',
    workflowRoles: 'BUDGET_REVIEWER (mandatory review step)',
    assignmentLevels: ['DIVISION_LEVEL']
  },
  { 
    value: 'BUDGET_APPROVER', 
    label: 'Budget Approver', 
    description: 'Approves proposals after review/creation',
    workflowRoles: 'BUDGET_APPROVER (approves proposals)',
    assignmentLevels: ['DIVISION_LEVEL', 'DEPARTMENT_REGIONAL_LEVEL']
  },
  { 
    value: 'BUDGET_PLANNING_ANALYST', 
    label: 'Budget Planning Analyst', 
    description: 'Performs technical analysis of proposals',
    workflowRoles: 'BUDGET_PLANNING_ANALYST (analyzes budget proposals)',
    assignmentLevels: ['BUDGET_AND_REVENUE_DIVISION']
  },
  { 
    value: 'BUDGET_OFFICER', 
    label: 'Budget Officer', 
    description: 'Provides operational approval of proposals',
    workflowRoles: 'BUDGET_OFFICER (operational approval)',
    assignmentLevels: ['BUDGET_AND_REVENUE_DIVISION']
  },
  { 
    value: 'OVERALL_BUDGET_APPROVER', 
    label: 'Budget Manager', 
    description: 'Final executive-level approval authority',
    workflowRoles: 'OVERALL_BUDGET_APPROVER (executive approval)',
    assignmentLevels: ['BUDGET_AND_REVENUE_DIVISION']
  },
  { 
    value: 'SUPER_ADMIN', 
    label: 'ADMIN', 
    description: 'Full administrative access - manages all proposals, users, and system settings',
    workflowRoles: 'All workflow roles (full system access)',
    assignmentLevels: ['FULL']
  }
];
// SUPER_ADMIN role is now displayed as "ADMIN" in the UI

const HierarchicalUserAssignmentPage = () => {
  const { currentUser, refetchUserProfile } = useUser();
  const queryClient = useQueryClient();

  // Fetch available fiscal years
  const { data: fiscalYearsData } = useQuery({
    queryKey: ['fiscal-years'],
    queryFn: async () => {
      const res = await api.get('/settings/fiscal-years');
      return res.data?.data || [];
    }
  });

  const { data: activeSettings } = useQuery({
    queryKey: ['activeSettings'],
    queryFn: async () => {
      const res = await api.get('/settings/active');
      return res.data;
    }
  });

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Ref to track current lookup value for auto-lookup
  const currentLookupValue = React.useRef('');

  // Track if "Central Office" is selected for Budget Planning Analyst
  const [hasCentralOfficeSelected, setHasCentralOfficeSelected] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    userId: '',
    userName: '',
    email: '',
    // NEW: Support for multiple roles from FMIS main system
    userRoles: [], // Array of roles from FMIS main
    userRole: '', // Primary role for backward compatibility
    assignmentLevel: 'OFFICE', // Changed from assignmentLevel to match new structure
    officeId: '',
    responsibilityCenterName: '',
    // Budget Planning Analyst specific fields
    isNIAWide: false, // Toggle for NIA-Wide vs specific regions
    assignedRegions: [], // List of region IDs assigned to Budget Planning Analyst
    rolePermissions: {
      CreateProposals: true,
      EditOwnProposals: true,
      EditAllProposals: false,
      DeleteProposals: false,
      ApproveProposals: false,
      ViewReports: true,
      ManageUsers: false,
      ManageSettings: false
    },
    workflowRoles: null
  });

  // UI state
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPageAccessDialogOpen, setIsPageAccessDialogOpen] = useState(false);

  // Check if user is admin (match both underscore and space variants from FMIS)
  const roles = currentUser?.Roles || [];
  const roleSet = new Set(roles.map((r) => String(r).toUpperCase().replace(/\s+/g, '_')));
  const ha = currentUser?.hierarchicalAccess || {};
  const isAdmin = (
    (roleSet.size > 0 && (
      roleSet.has('SUPER_ADMIN') ||
      roleSet.has('BUDGET_ADMIN') ||
      roleSet.has('BUDGET_ANALYST') ||
      roleSet.has('BUDGET_PLANNING_ANALYST') ||
      roleSet.has('BUDGET_MANAGER') ||
      roleSet.has('OVERALL_BUDGET_APPROVER') ||
      roleSet.has('BUDGET_PREPARER') ||
      roleSet.has('BUDGET_REVIEWER') ||
      roleSet.has('BUDGET_APPROVER')
    )) ||
    ha.scope === 'BUDGET_AND_REVENUE_DIVISION' ||
    ha.scope === 'FULL' ||
    ha.assignmentLevel === 'BUDGET_AND_REVENUE_DIVISION' ||
    ha.assignmentLevel === 'FULL'
  );

  // Fetch organization structure
  const { data: organizationStructure, isLoading: loadingOrganization, error: organizationError } = useQuery({
    queryKey: ['hierarchical-organization-structure'],
    queryFn: async () => {
      try {
        if (!currentUser) {
          throw new Error('Session expired. Please log in again.');
        }
        const res = await api.get('/api/hierarchical-rbac/organization-structure?structure=new');
        let data = res.data?.data || { availableUnits: { offices: [], responsibilityCenters: [], officeResponsibilityCenterMappings: {} }, mappings: [] };

        const regionsCount = data?.availableUnits?.offices?.length || 0;
        const departmentsCount = data?.availableUnits?.responsibilityCenters?.length || 0;

        if (regionsCount === 0 || departmentsCount === 0) {
          // console.log('New structure not available, falling back to old structure');
          // Try old structure as fallback
          try {
            const fallbackRes = await api.get('/api/hierarchical-rbac/organization-structure?structure=old');
            const fallbackData = fallbackRes.data?.data || { availableUnits: { regions: [], departments: [], departmentsWithDivisions: [], divisions: [] }, mappings: [] };

            const fallbackRegions = fallbackData?.availableUnits?.regions?.length ?
              fallbackData.availableUnits.regions :
              [];
            const fallbackDepartments = fallbackData?.availableUnits?.departments?.length ?
              fallbackData.availableUnits.departments :
              [];

            const normalized = {
              availableUnits: {
                offices: ((data.availableUnits.offices?.length ? data.availableUnits.offices : fallbackRegions.map(r => ({ id: r._id, name: r.Region }))) || []),
                responsibilityCenters: (data.availableUnits.responsibilityCenters?.length ? data.availableUnits.responsibilityCenters : fallbackDepartments.map(d => ({ id: d._id, name: d.Department }))) || [],
                officeResponsibilityCenterMappings: data.availableUnits.officeResponsibilityCenterMappings || {}
              },
              mappings: data.mappings || []
            };

            return normalized;
          } catch (fallbackError) {
            // console.log('Fallback to old structure also failed:', fallbackError.message);
            // Return empty structure
            return {
              availableUnits: {
                offices: [],
                responsibilityCenters: [],
                officeResponsibilityCenterMappings: {}
              },
              mappings: []
            };
          }
        }

        return data;
      } catch (error) {
        console.error('❌ Error fetching organization structure:', error);
        setSnackbar({
          open: true,
          message: `Failed to load organization structure: ${error.response?.data?.message || error.message}`,
          severity: 'error'
        });
        return { availableUnits: { regions: [], departments: [], departmentsWithDivisions: [], divisions: [] }, mappings: [] };
      }
    },
    enabled: !!currentUser,
    retry: (failureCount, error) => error.message.includes('network') && failureCount < 3,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });

  // Fetch hierarchical assignments
  const { data: assignments = [], isLoading: loadingAssignments } = useQuery({
    queryKey: ['hierarchical-assignments'],
    queryFn: async () => {
      try {
        if (!currentUser) {
          throw new Error('Session expired. Please log in again.');
        }
        const deriveUserId = () => currentUser?.Username?.[0] || currentUser?.Id || currentUser?.id || currentUser?.userId;

        // Allow all users with budget roles to see assignments, not just admins
        const hasBudgetRole = currentUser?.Roles && (
          currentUser.Roles.includes('SUPER_ADMIN') ||
          currentUser.Roles.includes('SUPER ADMIN') ||
          currentUser.Roles.includes('BUDGET_ADMIN') ||
          currentUser.Roles.includes('BUDGET_ANALYST') ||
          currentUser.Roles.includes('BUDGET_PLANNING_ANALYST') ||
          currentUser.Roles.includes('BUDGET_MANAGER') ||
          currentUser.Roles.includes('OVERALL_BUDGET_APPROVER')
        );

        if (isAdmin || hasBudgetRole) {
          try {
            // Use hierarchical assignments endpoint (focus on hierarchical system)
            const res = await api.get('/api/hierarchical-rbac/assignments');
            return res.data?.assignments || res.data || [];
          } catch (err) {
            // console.log('Hierarchical assignments endpoint failed:', err.message);
            return [];
          }
        }

        const userId = deriveUserId();
        if (!userId) {
          console.error('❌ Unable to derive userId for hierarchical assignment fetch. currentUser:', currentUser);
          return [];
        }

        try {
          // Use hierarchical assignments endpoint (focus on hierarchical system)
          const res = await api.get(`/api/hierarchical-rbac/assignments/${userId}`);
          return res.data?.assignment ? [res.data.assignment] : res.data ? [res.data] : [];
        } catch (err) {
          // console.log('Hierarchical assignments endpoint failed for user:', err.message);
          return [];
        }
      } catch (error) {
        console.error('Error fetching hierarchical assignments:', error);
        return [];
      }
    },
    enabled: !!currentUser,
    retry: (failureCount, error) => error.message.includes('network') && failureCount < 3,
  });

  // State for user lookup
  const [userLookupId, setUserLookupId] = useState('');
  const [isLookingUpUser, setIsLookingUpUser] = useState(false);

  // Update ref when userLookupId changes
  React.useEffect(() => {
    currentLookupValue.current = userLookupId;
  }, [userLookupId]);

  // User lookup query - manual trigger only
  const { data: userLookupData, isLoading: loadingUserLookup, refetch: lookupUser } = useQuery({
    queryKey: ['user-lookup', userLookupId],
    queryFn: async () => {
      // Require exactly 6+ digits
      if (!userLookupId || userLookupId.length < 6 || !/^\d{6,}$/.test(userLookupId)) {
        throw new Error('Invalid user ID format');
      }

      try {
        if (!currentUser) {
          throw new Error('Session expired');
        }

        const res = await api.get(`/api/hierarchical-rbac/user-lookup/${userLookupId}`);
        return res.data?.data || null;
      } catch (error) {
        // Handle different error types with toast notifications (no console errors)
        if (error.response?.status === 404) {
          setSnackbar({
            open: true,
            message: `User ID "${userLookupId}" not found in the system.`,
            severity: 'info'
          });
        } else if (error.response?.status === 403) {
          setSnackbar({
            open: true,
            message: 'You do not have permission to look up users.',
            severity: 'error'
          });
        } else if (error.response?.status === 401) {
          setSnackbar({
            open: true,
            message: 'Authentication required. Please log in again.',
            severity: 'warning'
          });
        } else if (error.message === 'Invalid user ID format') {
          setSnackbar({
            open: true,
            message: 'Please enter a valid user ID (6+ digits).',
            severity: 'warning'
          });
        } else {
          setSnackbar({
            open: true,
            message: 'Failed to look up user. Please try again.',
            severity: 'error'
          });
        }
        throw error; // Re-throw to let React Query handle it
      }
    },
    enabled: false, // Manual trigger only - no automatic API calls
    staleTime: 10 * 60 * 1000, // 10 minutes cache
    retry: false, // No retries to prevent console spam
    // Suppress all React Query error logging
    onError: () => {
      // Do nothing - we handle all errors internally
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
  });

  // Effect to auto-populate form when user lookup succeeds
  React.useEffect(() => {
    if (!userLookupData) return;

    // Always push FMIS budget roles to "Roles to be Saved" (including when editing) so new roles from FMIS Main appear
    const fmisRoles = userLookupData.budgetRoles || [];
    if (fmisRoles.length > 0) {
      handleFormChange('userRoles', fmisRoles);
      const budgetRole = userLookupData.budgetRole || fmisRoles[0] || 'BUDGET_PREPARER';
      handleFormChange('userRole', budgetRole);
    }

    if (!editingAssignment) {
      handleFormChange('userId', userLookupData.userId || '');
      handleFormChange('userName', userLookupData.userName || '');
      handleFormChange('email', userLookupData.email || '');
      const budgetRole = userLookupData.budgetRole || fmisRoles[0] || 'BUDGET_PREPARER';

      // Auto-set assignment level and permissions based on the budget role
      if (budgetRole === 'BUDGET_PLANNING_ANALYST') {
        handleFormChange('assignmentLevel', 'BUDGET_AND_REVENUE_DIVISION');
        handleFormChange('rolePermissions', {
          CreateProposals: true,
          EditOwnProposals: true,
          EditAllProposals: false,
          DeleteProposals: false,
          ApproveProposals: false,
          ViewReports: true,
          ManageUsers: false,
          ManageSettings: false
        });
        handleFormChange('workflowRoles', null);
      } else if (budgetRole === 'BUDGET_APPROVER') {
        handleFormChange('assignmentLevel', 'OFFICE');
        handleFormChange('rolePermissions', {
          CreateProposals: true,
          EditOwnProposals: true,
          EditAllProposals: false,
          DeleteProposals: false,
          ApproveProposals: false,
          ViewReports: true,
          ManageUsers: false,
          ManageSettings: false
        });
        handleFormChange('workflowRoles', null);
      } else if (budgetRole === 'BUDGET OFFICER') {
        handleFormChange('assignmentLevel', 'OFFICE');
        handleFormChange('rolePermissions', {
          CreateProposals: true,
          EditOwnProposals: true,
          EditAllProposals: false,
          DeleteProposals: false,
          ApproveProposals: false,
          ViewReports: true,
          ManageUsers: false,
          ManageSettings: false
        });
        handleFormChange('workflowRoles', null);
      } else if (budgetRole === 'BUDGET MANAGER' || budgetRole === 'OVERALL_BUDGET_APPROVER') {
        handleFormChange('assignmentLevel', 'BUDGET_AND_REVENUE_DIVISION');
        handleFormChange('rolePermissions', {
          CreateProposals: true,
          EditOwnProposals: true,
          EditAllProposals: true,
          DeleteProposals: false,
          ApproveProposals: true,
          ViewReports: true,
          ManageUsers: true,
          ManageSettings: true
        });
        handleFormChange('workflowRoles', null);
      }
    }
  }, [userLookupData, editingAssignment]);

  // Removed: Auto-populate email from current user context

  // Mutation for creating/updating assignments
  const createOrUpdateMutation = useMutation({
    mutationFn: async (data) => {
      if (!currentUser) {
        throw new Error('Session expired. Please log in again.');
      }

      // Use hierarchical assignments endpoint (auth via httpOnly cookie)
      const res = await api.post('/api/hierarchical-rbac/assignments', data);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['hierarchical-assignments']);
      // Refresh current user's hierarchical access data
      refetchUserProfile();

      // Show detailed success message with auto-assigned permissions
      let successMessage = 'Hierarchical assignment saved successfully';

      if (data?.data?.autoAssigned || data?.autoAssigned) {
        const autoAssigned = data?.data?.autoAssigned || data?.autoAssigned;
        const autoPerms = Object.entries(autoAssigned.rolePermissions || {})
          .filter(([, value]) => value === true)
          .map(([key]) => key.replace(/([A-Z])/g, ' $1').toLowerCase().trim());

        const autoRoles = autoAssigned.workflowRoles || [];

        if (autoPerms.length > 0 || autoRoles.length > 0) {
          successMessage += '\n\nAuto-assigned:';
          if (autoPerms.length > 0) {
            successMessage += `\nPermissions: ${autoPerms.join(', ')}`;
          }
          if (autoRoles.length > 0) {
            successMessage += `\nWorkflow Roles: ${autoRoles.join(', ')}`;
          }
        }
      }

      setSnackbar({
        open: true,
        message: successMessage,
        severity: 'success'
      });
      resetForm();
    },
    onError: (error) => {
      console.error('Error saving assignment:', error);
      const message = error.response?.status === 409
        ? 'User already has an assignment'
        : error.response?.data?.message || 'Failed to save hierarchical assignment';
      setSnackbar({ open: true, message, severity: 'error' });
    }
  });

  // Mutation for deleting assignments
  const deleteMutation = useMutation({
    mutationFn: async (userId) => {
      if (!currentUser) {
        throw new Error('Session expired. Please log in again.');
      }
      return api.delete(`/api/hierarchical-rbac/assignments/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['hierarchical-assignments']);
      // Refresh current user's hierarchical access data
      refetchUserProfile();
      setSnackbar({
        open: true,
        message: 'Hierarchical assignment deleted successfully',
        severity: 'success'
      });
      resetForm();
    },
    onError: (error) => {
      console.error('Error deleting assignment:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Failed to delete hierarchical assignment',
        severity: 'error'
      });
    }
  });

  // Helper functions
  const handleFormChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const resetForm = () => {
    setFormData({
      userId: '',
      userName: '',
      email: '',
      // NEW: Reset multiple roles array
      userRoles: [],
      userRole: '',
      assignmentLevel: 'OFFICE', // Keep assignmentLevel for form state
      officeId: '',
      responsibilityCenterName: '',
      // Reset Budget Planning Analyst specific fields
      isNIAWide: false,
      assignedRegions: [],
      rolePermissions: {
        CreateProposals: true,
        EditOwnProposals: true,
        EditAllProposals: false,
        DeleteProposals: false,
        ApproveProposals: false,
        ViewReports: true,
        ManageUsers: false,
        ManageSettings: false
      },
      workflowRoles: null
    });
    setEditingAssignment(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.userId || !formData.userName || !formData.email) {
      setSnackbar({
        open: true,
        message: 'User ID, User Name, and Email are required',
        severity: 'warning'
      });
      return;
    }

    if (!formData.userRoles || formData.userRoles.length === 0) {
      setSnackbar({
        open: true,
        message: 'At least one user role must be selected',
        severity: 'warning'
      });
      return;
    }

    if (!isValidEmail(formData.email)) {
      setSnackbar({
        open: true,
        message: 'Please enter a valid email address',
        severity: 'warning'
      });
      return;
    }

    // Validate Budget Planning Analyst region selection
    if (formData.userRole === 'BUDGET_PLANNING_ANALYST' && !formData.isNIAWide && formData.assignedRegions.length === 0) {
      setSnackbar({
        open: true,
        message: 'Budget Planning Analyst must be assigned to at least one region or have NIA-Wide access',
        severity: 'warning'
      });
      return;
    }

    // Normalize legacy levels to new structure for submission
    const normalizedLevel =
      formData.assignmentLevel === 'DIVISION'
        ? 'RESPONSIBILITY_CENTER'
        : formData.assignmentLevel === 'DEPARTMENT'
          ? 'OFFICE'
          : formData.assignmentLevel;

    // Validate based on normalized level (skip org validation for BPA - Department/Division optional)
    const isBPA = formData.userRole === 'BUDGET_PLANNING_ANALYST';
    if (!isBPA && normalizedLevel === 'RESPONSIBILITY_CENTER' && (!formData.officeId || !formData.responsibilityCenterName)) {
      setSnackbar({
        open: true,
        message: 'Responsibility Center assignment requires Office and Responsibility Center',
        severity: 'warning'
      });
      return;
    }

    if (!isBPA && normalizedLevel === 'OFFICE' && !formData.officeId) {
      setSnackbar({
        open: true,
        message: 'Office assignment requires Office selection',
        severity: 'warning'
      });
      return;
    }

    // Build payload with conditional fields based on assignment level
    const payload = {
      userId: formData.userId,
      userName: formData.userName,
      email: formData.email,
      // NEW: Include multiple roles from FMIS main system
      userRoles: formData.userRoles || [],
      userRole: formData.userRole,
      assignmentLevel: normalizedLevel,
      accessScope: normalizedLevel,
      rolePermissions: formData.rolePermissions
    };

    // Add Budget Planning Analyst region configuration
    if (formData.userRole === 'BUDGET_PLANNING_ANALYST') {
      payload.isNIAWide = formData.isNIAWide;
      // Only include valid region IDs (filter out empty or invalid values)
      payload.assignedRegions = formData.isNIAWide 
        ? [] 
        : (formData.assignedRegions || []).filter(id => id && String(id).trim().length > 0);
    }

    // Only include organizational fields when they have values
    // Map officeId to departmentId and responsibilityCenterName to divisionName for server compatibility
    if (formData.officeId && formData.officeId.trim()) {
      const selectedOffice = organizationStructure?.availableUnits?.offices?.find(
        o => String(o.id) === String(formData.officeId) || String(o._id) === String(formData.officeId)
      );

      // Handle composite officeId for regional offices (format: originalDeptId_regionId)
      if (formData.officeId.includes('_')) {
        const [deptId, rid] = formData.officeId.split('_');
        payload.departmentId = deptId;
        payload.regionId = rid; // NEW: Pass the region component of the composite ID
      } else {
        payload.departmentId = formData.officeId;
        // Lookup regionId from the selected office if available
        if (selectedOffice && selectedOffice.regionId) {
          payload.regionId = selectedOffice.regionId;
        }
      }
      payload.officeId = formData.officeId;
    }

    if (formData.responsibilityCenterName && formData.responsibilityCenterName.trim()) {
      payload.divisionName = formData.responsibilityCenterName;
      payload.responsibilityCenterName = formData.responsibilityCenterName;
    }

    createOrUpdateMutation.mutate(payload);
  };

  const handleDelete = (userId) => {
    setDeleteUserId(userId);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (deleteUserId) {
      deleteMutation.mutate(deleteUserId);
    }
    setDeleteConfirmOpen(false);
    setDeleteUserId(null);
  };

  const normalizeAssignmentLevel = (level) => {
    if (!level) return 'OFFICE';
    const l = String(level).toUpperCase();
    if (l === 'DIVISION' || l === 'DIVISION_LEVEL') return 'RESPONSIBILITY_CENTER';
    if (l === 'DEPARTMENT' || l === 'DEPARTMENT_REGIONAL_LEVEL') return 'OFFICE';
    if (l === 'REGION') return 'OFFICE'; // Map Region-level to Office-level dropdown for consistency
    return l;
  };

  const getAccessLevelInfo = (level) => {
    const normalizedLevel = normalizeAssignmentLevel(level);
    const info = ACCESS_LEVELS.find(al => al.value === normalizedLevel);
    if (info) return info;
    
    return ACCESS_LEVELS[0]; // Default to RC level
  };

  const getConsolidationInfo = (level) => {
    switch (level) {
      case 'RESPONSIBILITY_CENTER':
        return 'Proposals consolidate to Office';
      case 'OFFICE':
        return 'Proposals saved directly to Office';
      case 'BUDGET_AND_REVENUE_DIVISION':
        return 'BRD level - access based on assigned regions (Central Office, regional, etc.)';
      case 'FULL':
        return 'Can access all organizational levels (all permissions and workflow roles automatically granted)';
      default:
        return 'Access limited to own records';
    }
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Helper function to get organization display name
  const getOrganizationDisplay = (assignment) => {
    // Show loading state if organization structure is still loading
    if (loadingOrganization) {
      return 'Loading...';
    }

    if (!organizationStructure?.availableUnits) {
      return 'Not Available';
    }

    const { offices = [], responsibilityCenters = [] } = organizationStructure?.availableUnits || {};

    const level = String(assignment.assignmentLevel || '').toUpperCase();

    // For FULL access, show special message
    if (normalizeAssignmentLevel(level) === 'FULL') {
      return 'All Organizations';
    }

    // Prefer populated data from assignment object (arrays created by backend)
    if (assignment.regions?.length > 0) {
      const region = assignment.regions[0];
      const regionName = region.regionName || region.Region || 'Region';
      
      // If it's a pure REGION assignment, return just the region
      if (level === 'REGION' || level === 'BUDGET_AND_REVENUE_DIVISION') {
        return `Region: ${regionName}`;
      }
      
      // If it has department/office info
      if (assignment.departments?.length > 0) {
        const dept = assignment.departments[0];
        const deptName = dept.departmentName || dept.Department || 'Department';
        const displayDept = regionName && regionName !== 'All Regions' ? `${deptName} - ${regionName}` : deptName;
        
        // Add responsibility center if available
        const centerName = assignment.divisions?.[0] || assignment.divisionName || assignment.responsibilityCenterName;
        if (centerName) {
          return `${displayDept} → ${centerName}`;
        }
        
        return displayDept;
      }
      
      return `Region: ${regionName}`;
    }

    // Fallback: Try to find office name by ID string or object
    const getRawId = (val) => {
      if (!val) return null;
      if (typeof val === 'string') return val;
      return val._id || val.id;
    };

    const officeId = getRawId(assignment.officeId) || getRawId(assignment.departmentId);
    if (officeId) {
      const office = offices.find(o => String(o.id) === String(officeId) || String(o._id) === String(officeId));
      if (office) {
        let display = office.name;
        const centerName = assignment.divisions?.[0] || assignment.divisionName || assignment.responsibilityCenterName;
        if (centerName) {
          display += ` → ${centerName}`;
        }
        return display;
      }
    }

    // Fallback for RC level without office mapping
    const fallbackCenterName = assignment.divisions?.[0] || assignment.divisionName || assignment.responsibilityCenterName;
    if (fallbackCenterName) {
      return `Division: ${fallbackCenterName}`;
    }

    return 'Not Specified';
  };

  // Helper function for email validation
  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleStatusToggle = async (userId, currentStatus) => {
    try {
      const res = await api.patch(`/api/hierarchical-rbac/assignments/${userId}/status`, {
        isActive: !currentStatus
      });
      if (res.data.success) {
        setSnackbar({ open: true, message: res.data.message, severity: 'success' });
        queryClient.invalidateQueries(['hierarchical-assignments']);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error updating status',
        severity: 'error'
      });
    }
  };

  // State for Page Access Settings
  const [pageAccessConfig, setPageAccessConfig] = useState(null);
  const [loadingPageAccess, setLoadingPageAccess] = useState(false);

  const loadPageAccessConfig = async () => {
    setLoadingPageAccess(true);
    try {
      const res = await api.get("/api/route-permissions/all");
      if (res.data.success) {
        const config = res.data.data.find(r => r.path === "/hierarchical-user-assignments");
        if (config) {
          setPageAccessConfig(config);
        } else {
          setSnackbar({ open: true, message: "Route permission config not found for this page", severity: "warning" });
        }
      }
    } catch (error) {
      console.error("Failed to load route permissions:", error);
      setSnackbar({ open: true, message: "Failed to load access settings", severity: "error" });
    } finally {
      setLoadingPageAccess(false);
    }
  };

  React.useEffect(() => {
    if (isPageAccessDialogOpen) {
      loadPageAccessConfig();
    }
  }, [isPageAccessDialogOpen]);

  const handleSavePageAccess = async () => {
    if (!pageAccessConfig || !pageAccessConfig._id) return;
    try {
      const res = await api.put(`/api/route-permissions/${pageAccessConfig._id}`, {
        requiredWorkflowRoles: pageAccessConfig.requiredWorkflowRoles
      });
      if (res.data.success) {
        setSnackbar({ open: true, message: "Page access settings updated", severity: "success" });
        setIsPageAccessDialogOpen(false);
      }
    } catch (error) {
      setSnackbar({ open: true, message: "Failed to save settings", severity: "error" });
    }
  };

  const toggleRoleAccess = (roleValue) => {
    setPageAccessConfig(prev => {
      const currentRoles = prev.requiredWorkflowRoles || [];
      const newRoles = currentRoles.includes(roleValue)
        ? currentRoles.filter(r => r !== roleValue)
        : [...currentRoles, roleValue];
      return { ...prev, requiredWorkflowRoles: newRoles };
    });
  };

  if (!isAdmin) {
    return (
      <Box sx={{ p: 3 }}>
        <DashboardHeader title="My Hierarchical Access" />
        <Paper sx={{ p: 3, mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            Access Information
          </Typography>
          <Typography>
            You have {currentUser?.assignmentLevel || 'no'} level access in the hierarchical workflow system.
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <DashboardHeader title="Hierarchical User Assignments" />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.primary', fontWeight: 600 }}>
          <PersonIcon sx={{ color: '#386641' }} /> Current Assignments ({assignments.filter(a => a.userRole !== 'SUPER_ADMIN').length})
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {roles.includes('SUPER_ADMIN') && (
            <Button 
              variant="outlined" 
              onClick={() => setIsPageAccessDialogOpen(true)} 
              sx={{ 
                borderColor: '#386641', 
                color: '#386641', 
                '&:hover': { borderColor: '#2d5334', background: 'rgba(56, 102, 65, 0.1)' } 
              }}
            >
              ⚙️ Page Access Settings
            </Button>
          )}
          <Button 
            variant="contained" 
            startIcon={<AssignmentIcon />}
            onClick={() => { resetForm(); setIsDialogOpen(true); }}
            sx={{ 
              background: '#386641', 
              color: 'white', 
              fontWeight: 600, 
              '&:hover': { background: '#2d5334', transform: 'scale(1.02)' }, 
              transition: 'all 0.2s' 
            }}
          >
            Create Hierarchical Assignment
          </Button>
        </Box>
      </Box>

      <Dialog 
        open={isDialogOpen} 
        onClose={() => { setIsDialogOpen(false); resetForm(); }} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: {
            background: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
          }
        }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid rgba(0,0,0,0.08)', fontWeight: 600, color: '#386641' }}>
          {editingAssignment ? 'Edit' : 'Create'} Hierarchical Assignment
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="User ID"
                  value={formData.userId}
                  onChange={(e) => {
                    const value = e.target.value;
                    handleFormChange('userId', value);
                    
                    // Auto-lookup when user enters a valid userId (6+ digits)
                    if (!editingAssignment && value && value.length >= 6 && /^\d{6,}$/.test(value)) {
                      setIsLookingUpUser(true);
                      currentLookupValue.current = value;
                      // Trigger lookup immediately with the new value
                      queryClient.fetchQuery({
                        queryKey: ['user-lookup', value],
                        queryFn: async () => {
                          try {
                            if (!currentUser) {
                              throw new Error('Session expired');
                            }
                            const res = await api.get(`/api/hierarchical-rbac/user-lookup/${value}`);
                            return res.data?.data || null;
                          } catch (error) {
                            // Handle errors silently for auto-lookup
                            console.warn('Auto-lookup failed:', error.message);
                            return null;
                          }
                        },
                        staleTime: 10 * 60 * 1000,
                      }).then((data) => {
                        if (data && currentLookupValue.current === value) {
                          // Manually trigger the population logic
                          handleFormChange('userId', data.userId || '');
                          handleFormChange('userName', data.userName || '');
                          
                          // Only set email if FMIS lookup returns one, otherwise keep current email
                          if (data.email) {
                            handleFormChange('email', data.email);
                          }
                          
                          // NEW: Set userRoles from FMIS lookup
                          handleFormChange('userRoles', data.budgetRoles || []);
                          
                          // Use the budgetRole directly from server - no client-side mapping needed
                          const budgetRole = data.budgetRole || (data.budgetRoles && data.budgetRoles.length > 0 ? data.budgetRoles[0] : 'BUDGET_PREPARER');
                          handleFormChange('userRole', budgetRole);
                          
                          // Set permissions based on the primary role from FMIS lookup
                          const rolePerms = {
                            CreateProposals: true,
                            EditOwnProposals: true,
                            EditAllProposals: false,
                            DeleteProposals: false,
                            ApproveProposals: false,
                            ViewReports: true,
                            ManageUsers: false,
                            ManageSettings: false
                          };
                          
                          // Set permissions based on primary role
                          if (budgetRole === 'BUDGET_APPROVER') {
                            rolePerms.EditOwnProposals = true;
                            rolePerms.EditAllProposals = true;
                            rolePerms.ApproveProposals = true;
                          } else if (budgetRole === 'BUDGET_REVIEWER') {
                            rolePerms.EditOwnProposals = true;
                            rolePerms.EditAllProposals = true;
                          } else if (budgetRole === 'BUDGET_PREPARER') {
                            rolePerms.CreateProposals = true;
                            rolePerms.EditOwnProposals = true;
                          } else if (budgetRole === 'BUDGET_PLANNING_ANALYST' || budgetRole === 'BUDGET_OFFICER' || budgetRole === 'OVERALL_BUDGET_APPROVER') {
                            rolePerms.EditAllProposals = true;
                            rolePerms.ApproveProposals = true;
                            if (budgetRole === 'OVERALL_BUDGET_APPROVER') {
                              rolePerms.ManageSettings = true;
                            }
                          } else if (budgetRole === 'SUPER_ADMIN') {
                            rolePerms.CreateProposals = true;
                            rolePerms.EditOwnProposals = true;
                            rolePerms.EditAllProposals = true;
                            rolePerms.DeleteProposals = true;
                            rolePerms.ApproveProposals = true;
                            rolePerms.ViewReports = true;
                            rolePerms.ManageUsers = true;
                            rolePerms.ManageSettings = true;
                          }
                          
                          handleFormChange('rolePermissions', rolePerms);
                        }
                        setIsLookingUpUser(false);
                      }).catch((error) => {
                        console.warn('Auto-lookup query failed:', error);
                        setIsLookingUpUser(false);
                      });
                    }
                  }}
                  disabled={!!editingAssignment}
                  required
                  helperText={
                    loadingUserLookup 
                      ? 'Looking up user information...' 
                      : formData.userId 
                        ? 'User information will be auto-filled' 
                        : 'Enter a valid user ID (6+ digits)'
                  }
                  inputProps={{ 'aria-label': 'User ID' }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="User Name"
                  value={formData.userName}
                  onChange={(e) => handleFormChange('userName', e.target.value)}
                  // Make User Name non-editable in the Hierarchical User Assignments UI
                  disabled={true}
                  required
                  helperText="User name will be auto-filled after entering User ID"
                  inputProps={{ 'aria-label': 'User Name' }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleFormChange('email', e.target.value)}
                  required
                  helperText={
                    formData.email && isValidEmail(formData.email) 
                      ? 'Valid email address' 
                      : 'Valid email is required'
                  }
                  inputProps={{ 'aria-label': 'Email' }}
                />
              </Grid>

              {/* Display only budget-related roles from FMIS main (exclude CASH CHECK PREPARER, etc.) */}
              {(() => {
                const rawRoles = userLookupData?.roles || [];
                const displayRoles = userLookupData?.budgetRelevantRoles?.length > 0
                  ? userLookupData.budgetRelevantRoles
                  : rawRoles.filter((r) => /BUDGET|SUPER\s*ADMIN|^ADMIN$|OVERALL\s*APPROVER|BUDGET\s*APPROVER|BUDGET\s*REVIEWER|BUDGET\s*PREPARER|BUDGET\s*ANALYST|BUDGET\s*OFFICER|BUDGET\s*MANAGER/i.test(String(r).trim()));
                return displayRoles.length > 0 ? (
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="FMIS Main System Roles (Budget-related only)"
                      value={displayRoles.join(', ')}
                      InputProps={{
                        readOnly: true,
                      }}
                      helperText="Budget-related roles from FMIS main authentication system"
                      variant="outlined"
                      sx={{
                        '& .MuiInputBase-input': {
                          backgroundColor: '#e3f2fd',
                          fontSize: '0.875rem'
                        }
                      }}
                    />
                  </Grid>
                ) : null;
              })()}

              {/* NEW: Display multiple roles in text field format */}
              {userLookupData?.budgetRoles && userLookupData.budgetRoles.length > 0 && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Determined Budget Roles (Multiple)"
                    value={userLookupData.budgetRoles.map(role => role.replace(/_/g, ' ')).join(', ')}
                    InputProps={{
                      readOnly: true,
                    }}
                    helperText={`Primary: ${userLookupData.budgetRole?.replace(/_/g, ' ')} • Total roles: ${userLookupData.budgetRoles.length}`}
                    variant="outlined"
                    sx={{
                      '& .MuiInputBase-input': {
                        backgroundColor: '#f5f5f5',
                        fontSize: '0.875rem'
                      }
                    }}
                  />
                </Grid>
              )}
              
              {/* Show warning if editing and role doesn't match saved role */}
              {editingAssignment && editingAssignment.userRole && formData.userRole !== editingAssignment.userRole && (
                <Grid item xs={12}>
                  <Alert severity="warning" sx={{ mb: 1 }}>
                    <Typography variant="body2">
                      <strong>Role Changed:</strong> The user's role was previously saved as <strong>{editingAssignment.userRole}</strong>, but the current value is <strong>{formData.userRole}</strong>.
                    </Typography>
                  </Alert>
                </Grid>
              )}

              <Grid item xs={12}>
                <Autocomplete
                  key={`roles-${formData.userRoles.length}-${formData.userRoles.join(',')}`}
                  multiple
                  options={USER_ROLES}
                  getOptionLabel={(option) => {
                    if (typeof option === 'string') return option;
                    return option.label || '';
                  }}
                  value={USER_ROLES.filter(r => formData.userRoles.includes(r.value)) || []}
                  // IMPORTANT: Roles are now strictly sourced from fmis_main.assigned_roles
                  // and are no longer editable here. Any changes must be done in FMIS main.
                  onChange={() => {
                    // Intentionally left blank to prevent client-side role editing.
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="User Roles (Multiple Selection - From FMIS Main)"
                      placeholder={formData.userRoles.length > 0 ? "Roles loaded from FMIS main (read-only)" : "No budget roles detected from FMIS main"}
                      helperText={
                        isLookingUpUser 
                          ? "Looking up roles from FMIS..." 
                          : formData.userRoles.length > 0 
                            ? `${formData.userRoles.length} role(s) detected from FMIS main. Primary: ${formData.userRole?.replace(/_/g, ' ') || 'None'} (read-only)`
                            : 'Walang na-detect na budget workflow role para sa user na ito sa FMIS main.'
                      }
                      required
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {isLookingUpUser ? <CircularProgress color="inherit" size={20} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => {
                      const { key, ...tagProps } = getTagProps({ index });
                      return (
                        <Chip
                          key={key}
                          label={option.label}
                          size="small"
                          color="primary"
                          variant="filled"
                          sx={{ 
                            backgroundColor: '#1976d2', 
                            color: 'white',
                            fontWeight: 'bold',
                            '& .MuiChip-deleteIcon': {
                              color: 'white'
                            }
                          }}
                          {...tagProps}
                        />
                      );
                    })
                  }
                  noOptionsText="No roles available"
                  fullWidth
                  // Completely disable manual editing; roles are controlled by FMIS main
                  disabled
                />
              </Grid>

              {/* NEW: Display multiple roles that will be saved */}
              {formData.userRoles && formData.userRoles.length > 0 && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Roles to be Saved (Multiple Role Support)"
                    value={formData.userRoles.map(role => role.replace(/_/g, ' ')).join(', ')}
                    InputProps={{
                      readOnly: true,
                    }}
                    helperText={`These roles will be saved to the database. Primary role: ${formData.userRole?.replace(/_/g, ' ') || 'None selected'}`}
                    variant="outlined"
                    sx={{
                      '& .MuiInputBase-input': {
                        backgroundColor: '#e8f5e8',
                        fontSize: '0.875rem',
                        fontWeight: 'bold'
                      },
                      '& .MuiInputLabel-root': {
                        color: '#2e7d32'
                      }
                    }}
                  />
                </Grid>
              )}

              {/* Refresh from FMIS - manual sync when role changed in FMIS-Main */}
              {formData.userId && formData.userId.length >= 6 && (
                <Grid item xs={12}>
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={isLookingUpUser}
                    onClick={async () => {
                      try {
                        setIsLookingUpUser(true);
                        const res = await api.get(`/api/hierarchical-rbac/user-lookup/${formData.userId}`);
                        const fmisData = res.data?.data || res.data;
                        if (fmisData) {
                          if (fmisData.userName) handleFormChange('userName', fmisData.userName);
                          if (fmisData.email) handleFormChange('email', fmisData.email);
                          if (fmisData.budgetRoles && fmisData.budgetRoles.length > 0) {
                            handleFormChange('userRoles', fmisData.budgetRoles);
                            handleFormChange('userRole', fmisData.budgetRole || fmisData.budgetRoles[0]);
                          }
                          queryClient.invalidateQueries({ queryKey: ['user-lookup', String(formData.userId)] });
                          setSnackbar({ open: true, message: 'Mga role na-refresh mula sa FMIS-Main', severity: 'success' });
                        } else {
                          setSnackbar({ open: true, message: 'Walang natagpuang data mula sa FMIS-Main', severity: 'warning' });
                        }
                      } catch (err) {
                        setSnackbar({ open: true, message: err?.response?.data?.message || 'Hindi ma-refresh ang data', severity: 'error' });
                      } finally {
                        setIsLookingUpUser(false);
                      }
                    }}
                  >
                    {isLookingUpUser ? 'Naglo-load...' : 'Refresh from FMIS'}
                  </Button>
                </Grid>
              )}

              {/* Budget Planning Analyst - Region Selection */}
              {formData.userRole === 'BUDGET_PLANNING_ANALYST' && (
                <>
                  <Grid item xs={12}>
                    <Alert severity="info" icon={<InfoIcon />}>
                      <Typography variant="subtitle2">Region Assignment for Budget Planning Analyst</Typography>
                      <Typography variant="body2">
                        Choose whether this analyst can access proposals from all regions (NIA-Wide) or from specific regions only.
                      </Typography>
                    </Alert>
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                      <Button
                        variant={formData.isNIAWide ? 'contained' : 'outlined'}
                        color={formData.isNIAWide ? 'primary' : 'inherit'}
                        onClick={() => {
                          handleFormChange('isNIAWide', true);
                          handleFormChange('assignedRegions', []);
                          setHasCentralOfficeSelected(false);
                        }}
                        sx={{ flex: 1 }}
                      >
                        <Box sx={{ textAlign: 'left' }}>
                          <Typography variant="body2" fontWeight="bold">
                            {formData.isNIAWide && (
                              <CheckIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                            )}
                            NIA-Wide / All Regions
                          </Typography>
                          <Typography variant="caption">
                            Access proposals from all regions
                          </Typography>
                        </Box>
                      </Button>
                      <Button
                        variant={!formData.isNIAWide ? 'contained' : 'outlined'}
                        color={!formData.isNIAWide ? 'primary' : 'inherit'}
                        onClick={() => {
                          handleFormChange('isNIAWide', false);
                        }}
                        sx={{ flex: 1 }}
                      >
                        <Box sx={{ textAlign: 'left' }}>
                          <Typography variant="body2" fontWeight="bold">
                            {!formData.isNIAWide && (
                              <CheckIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                            )}
                            Specific Regions
                          </Typography>
                          <Typography variant="caption">
                            Select specific regions only
                          </Typography>
                        </Box>
                      </Button>
                    </Box>
                  </Grid>

                  {!formData.isNIAWide && (
                    <Grid item xs={12}>
                      <Autocomplete
                        multiple
                        options={(() => {
                          const offices = organizationStructure?.availableUnits?.offices || [];
                          // Deduplicate by region - keep only one entry per region
                          const seenRegions = new Set();
                          return offices.filter(office => {
                            const region = office.region || office.Region || office.officeName || office.name;
                            if (seenRegions.has(region)) return false;
                            seenRegions.add(region);
                            return true;
                          });
                        })()}
                        getOptionLabel={(option) => {
                          if (typeof option === 'string') return option;
                          // Show region/office name - prioritize more descriptive fields
                          if (option.region && option.region !== 'All Regions') {
                            return `${option.region}`;
                          }
                          if (option.officeName && option.officeName.trim().length > 0) {
                            return `${option.officeName}`;
                          }
                          if (option.Region && option.Region !== 'All Regions') {
                            return `${option.Region}`;
                          }
                          return option.name || 'Regional Office';
                        }}
                        value={(organizationStructure?.availableUnits?.offices || [])
                          .filter((office, index, arr) => {
                            // Deduplicate displayed values
                            const region = office.region || office.Region || office.officeName;
                            return arr.findIndex(o => (o.region || o.Region || o.officeName) === region) === index;
                          })
                          .filter(office => {
                            const officeRegion = office.region || office.Region || office.officeName;
                            return (formData.assignedRegions || []).includes(officeRegion) ||
                                   (formData.assignedRegions || []).includes(office.id);
                          })
                        }
                        isOptionEqualToValue={(option, value) => {
                          if (!option || !value) return false;
                          // Match by region name first
                          const optionRegion = option.region || option.Region || option.officeName;
                          const valueRegion = value.region || value.Region || value.officeName;
                          if (optionRegion === valueRegion && optionRegion) return true;
                          // Match by office ID as fallback
                          return option.id === value.id;
                        }}
                        onChange={(event, newValue) => {
                          // Extract unique region identifiers from selected options
                          const regionValues = newValue.map(option => {
                            // Use the region field as a unique identifier for the assignment
                            return option.region || option.Region || option.officeName || option.id;
                          });
                          handleFormChange('assignedRegions', regionValues);

                          // Detect if "Central Office" is among the selected regions
                          const centralSelected = newValue.some(option => {
                            const labelSource =
                              option.region ||
                              option.Region ||
                              option.officeName ||
                              option.name ||
                              '';
                            const label = String(labelSource).toLowerCase();
                            return label.includes('central') && label.includes('office');
                          });
                          setHasCentralOfficeSelected(centralSelected);
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Select Regions"
                            placeholder="Search and select regions..."
                            helperText="Select one or more regions where this analyst can access proposals"
                          />
                        )}
                        renderOption={(props, option) => {
                          const { key, ...otherProps } = props;
                          // Show only region name - no department subtitle
                          let displayName = 'Regional Office';
                          if (option.region && option.region !== 'All Regions') {
                            displayName = option.region;
                          } else if (option.officeName && option.officeName.trim().length > 0) {
                            displayName = option.officeName;
                          } else if (option.Region && option.Region !== 'All Regions') {
                            displayName = option.Region;
                          } else if (option.name && option.name !== 'REGIONAL OFFICE') {
                            displayName = option.name;
                          }
                          return (
                            <Box component="li" key={key} {...otherProps}>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {displayName}
                              </Typography>
                            </Box>
                          );
                        }}
                        fullWidth
                      />
                      {(formData.assignedRegions || []).length === 0 && !formData.isNIAWide && (
                        <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                          ⚠️ Please select at least one region
                        </Typography>
                      )}
                    </Grid>
                  )}

                  {/* Central Office → Department & Division selection (for BPA only) - OPTIONAL */}
                  {!formData.isNIAWide && hasCentralOfficeSelected && (
                    <>
                      <Grid item xs={12}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                          Optional: Kung walang napili, lahat ng proposals mula sa Central Office ay mapupunta sa user na ito.
                        </Typography>
                        <Autocomplete
                          options={organizationStructure?.availableUnits?.offices || []}
                          getOptionLabel={(option) => {
                            if (typeof option === 'string') return option;
                            if (option.Department) return option.Department;
                            if (option.name) return option.name;
                            return option.officeName || '';
                          }}
                          value={(() => {
                            const offices = organizationStructure?.availableUnits?.offices || [];
                            return offices.find(o => o.id === formData.officeId) || null;
                          })()}
                          onChange={(_event, newValue) => {
                            const officeId = (typeof newValue === 'object' && newValue?.id) ? newValue.id : '';
                            handleFormChange('officeId', officeId);
                            handleFormChange('responsibilityCenterName', '');
                          }}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="Department (Central Office) - Optional"
                              placeholder="Pumili ng Department (opsyonal)..."
                              fullWidth
                            />
                          )}
                          noOptionsText="No departments found"
                          fullWidth
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <Autocomplete
                          disabled={!formData.officeId}
                          options={organizationStructure?.availableUnits?.responsibilityCenters
                            ?.filter(rc => {
                              if (!formData.officeId) return false;
                              return String(rc.officeId || '') === String(formData.officeId || '');
                            }) || []}
                          getOptionLabel={(option) => {
                            if (typeof option === 'string') return option;
                            return option.name || '';
                          }}
                          value={organizationStructure?.availableUnits?.responsibilityCenters
                            ?.find(rc => {
                              return (
                                rc.name === formData.responsibilityCenterName &&
                                String(rc.officeId || '') === String(formData.officeId || '')
                              );
                            }) || null}
                          onChange={(_event, newValue) => {
                            const centerName = (typeof newValue === 'object' && newValue?.name) ? newValue.name : '';
                            handleFormChange('responsibilityCenterName', centerName);
                          }}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="Division (Central Office) - Optional"
                              placeholder="Pumili ng Division (opsyonal)..."
                              fullWidth
                              helperText={!formData.officeId
                                ? 'Pumili muna ng Department kung gusto mong i-scope ang Division.'
                                : 'Optional - kung walang napili, lahat ng Central Office ay sakop.'}
                            />
                          )}
                          noOptionsText={!formData.officeId
                            ? "Please select a Department first"
                            : "No divisions found for selected department"}
                          fullWidth
                        />
                      </Grid>
                    </>
                  )}
                </>
              )}

              {/* Hide generic assignment level selector for BUDGET_PLANNING_ANALYST.
                  BPA uses region + (optional) Central Office Dept/Division instead. */}
              {formData.userRole !== 'BUDGET_PLANNING_ANALYST' && (
                <Grid item xs={12}>
                  <Autocomplete
                    options={ACCESS_LEVELS}
                    getOptionLabel={(option) => option.label || ''}
                    value={ACCESS_LEVELS.find(level => level.value === formData.assignmentLevel) || ACCESS_LEVELS[1]}
                    onChange={(event, newValue) => {
                    const newLevel = newValue?.value || 'OFFICE';
                    const oldLevel = formData.assignmentLevel;
                    handleFormChange('assignmentLevel', newLevel);
                    // Clear office and responsibility center when assignment level changes
                    handleFormChange('officeId', '');
                    handleFormChange('responsibilityCenterName', '');
                    
                    // Enforce role applicability (Option A: strict disable)
                    const nextRoles = { ...(formData.workflowRoles || {}) };
                    const isRC = newLevel === 'RESPONSIBILITY_CENTER';
                    const isOffice = newLevel === 'OFFICE';
                    const isFull = newLevel === 'FULL';
                    const isOwn = newLevel === 'OWN_ONLY';

                    // Helper to set a role value safely
                    const setRole = (key, val) => { nextRoles[key] = !!val; };

                    if (isOwn) {
                      // No workflow roles for OWN_ONLY
                      Object.keys(nextRoles).forEach(k => { nextRoles[k] = false; });
                      // Reset permissions for OWN_ONLY
                      handleFormChange('rolePermissions', {
                        CreateProposals: true,
                        EditOwnProposals: true,
                        EditAllProposals: false,
                        DeleteProposals: false,
                        ApproveProposals: false,
                        ViewReports: true,
                        ManageUsers: false,
                        ManageSettings: false
                      });
                      // Update user role - default to PREPARER for OWN_ONLY
                      handleFormChange('userRole', 'BUDGET_PREPARER');
                    } else if (isRC) {
                      // Only RC roles allowed
                      setRole('divisionCreator', !!nextRoles.divisionCreator);
                      setRole('divisionApprover', !!nextRoles.divisionApprover);
                      setRole('officeCreator', false);
                      setRole('officeConsolidator', false);
                      setRole('officeSubmission', false);
                      setRole('officeFinalVerifier', false);
                      // If changing FROM FULL, reset to basic permissions
                      if (oldLevel === 'FULL') {
                        handleFormChange('rolePermissions', {
                          CreateProposals: true,
                          EditOwnProposals: true,
                          EditAllProposals: false,
                          DeleteProposals: false,
                          ApproveProposals: false,
                          ViewReports: true,
                          ManageUsers: false,
                          ManageSettings: false
                        });
                      }
                      // Update user role - default to PREPARER for Responsibility Center level
                      handleFormChange('userRole', formData.userRole || 'BUDGET_PREPARER');
                    } else if (isOffice) {
                      // Office roles allowed; RC creator optional -> keep selection
                      setRole('officeCreator', !!nextRoles.officeCreator);
                      setRole('officeConsolidator', !!nextRoles.officeConsolidator);
                      setRole('officeSubmission', !!nextRoles.officeSubmission);
                      setRole('officeFinalVerifier', !!nextRoles.officeFinalVerifier);
                      // RC roles are typically not applicable at pure office scope
                      setRole('divisionCreator', false);
                      setRole('divisionApprover', false);
                      // If changing FROM FULL, reset to basic permissions
                      if (oldLevel === 'FULL') {
                        handleFormChange('rolePermissions', {
                          CreateProposals: true,
                          EditOwnProposals: true,
                          EditAllProposals: true,
                          DeleteProposals: false,
                          ApproveProposals: true,
                          ViewReports: true,
                          ManageUsers: false,
                          ManageSettings: false
                        });
                      }
                      // Update user role - default to PREPARER for Office level, preserve any explicit choice
                      handleFormChange('userRole', formData.userRole || 'BUDGET_PREPARER');
                    } else if (isFull) {
                      // All roles permitted; automatically grant all workflow roles for FULL access
                      Object.keys(nextRoles).forEach(k => { nextRoles[k] = true; });
                      // Automatically grant all permissions for FULL access
                      handleFormChange('rolePermissions', {
                        CreateProposals: true,
                        EditOwnProposals: true,
                        EditAllProposals: true,
                        DeleteProposals: true,
                        ApproveProposals: true,
                        ViewReports: true,
                        ManageUsers: true,
                        ManageSettings: true
                      });
                      // Update user role - FULL with ManageSettings = SUPER_ADMIN
                      handleFormChange('userRole', 'SUPER_ADMIN');
                    }

                    handleFormChange('workflowRoles', nextRoles);
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Assignment Level"
                      placeholder="Select assignment level..."
                      fullWidth
                    />
                  )}
                  renderOption={(props, option) => {
                    const { key, ...otherProps } = props;
                    return (
                      <Tooltip
                        key={key}
                        title={
                          option.value === 'FULL'
                            ? 'Budget Revenue Division level access to all organizational levels (all permissions and workflow roles automatically granted)'
                            : option.value === 'RESPONSIBILITY_CENTER'
                              ? 'Access limited to responsibility center level'
                              : option.value === 'OFFICE'
                                ? 'Access limited to office level'
                                : 'Access limited to own records only'
                        }
                        placement="right"
                      >
                        <Box component="li" {...otherProps}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            {option.icon}
                            <Typography sx={{ ml: 1 }}>{option.label}</Typography>
                          </Box>
                        </Box>
                      </Tooltip>
                    );
                  }}
                  noOptionsText="No assignment levels found"
                  fullWidth
                />
                {formData.assignmentLevel === 'FULL' && (
                  <Grid item xs={12}>
                    <Alert severity="success" sx={{ mt: 1 }}>
                      <Typography variant="body2">
                        <strong>Budget Revenue Division Level:</strong> All permissions and workflow roles are automatically granted for users with administrative access, including access to all settings pages.
                      </Typography>
                    </Alert>
                  </Grid>
                )}
              </Grid>
              )}

              {formData.userRole !== 'BUDGET_PLANNING_ANALYST' && (formData.assignmentLevel === 'OFFICE' || formData.assignmentLevel === 'RESPONSIBILITY_CENTER') && (
                <Grid item xs={12}>
                  <Autocomplete
                    options={organizationStructure?.availableUnits?.offices || []}
                    getOptionLabel={(option) => {
                      if (typeof option === 'string') return option;
                      const name = option.name || '';
                      // Only append office name or region if it's not already part of the name to avoid duplicates
                      // (e.g. avoid "REGIONAL OFFICE - CAR - CAR")
                      if (option.officeName && option.officeName.trim().length > 0) {
                        if (name.includes(option.officeName)) return name;
                        return `${name} - ${option.officeName}`;
                      }
                      if (option.region && option.region !== 'All Regions') {
                        if (name.includes(option.region)) return name;
                        return `${name} - ${option.region}`;
                      }
                      return name;
                    }}
                    value={(() => {
                      // ✅ Better matching: try different ID field combinations
                      const offices = organizationStructure?.availableUnits?.offices || [];
                      
                      // First try exact ID match
                      let matchedOffice = offices.find(office => office.id === formData.officeId);
                      
                      // If not found, try matching with composite ID (handle format: originalId_regionId)
                      if (!matchedOffice && formData.officeId) {
                        const baseId = formData.officeId.split('_')[0];
                        matchedOffice = offices.find(office => 
                          office.id === baseId || 
                          office.id === formData.officeId ||
                          office._id === formData.officeId ||
                          office.id.startsWith(baseId + '_')
                        );
                      }
                      
                      return matchedOffice || null;
                    })()}
                    onChange={(event, newValue) => {
                      // Handle both object (selected option) and string (free text) cases
                      const officeId = (typeof newValue === 'object' && newValue?.id) ? newValue.id : '';
                      handleFormChange('officeId', officeId);
                      // Clear responsibility center when office changes
                      if (formData.assignmentLevel === 'RESPONSIBILITY_CENTER') {
                        handleFormChange('responsibilityCenterName', '');
                      }
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Office"
                        placeholder="Search offices..."
                        fullWidth
                        helperText={formData.officeId && !organizationStructure?.availableUnits?.offices?.find(o => o.id === formData.officeId) 
                          ? `Current Office ID: ${formData.officeId} (May not match available offices)` 
                          : ''}
                      />
                    )}
                    renderOption={(props, option) => {
                      const { key, ...otherProps } = props;
                      const name = option.name || '';
                      let displayName = name;
                      
                      // Avoid duplicates in display name
                      if (option.officeName && option.officeName.trim().length > 0) {
                        if (!name.includes(option.officeName)) {
                          displayName = `${name} - ${option.officeName}`;
                        }
                      } else if (option.region && option.region !== 'All Regions') {
                        if (!name.includes(option.region)) {
                          displayName = `${name} - ${option.region}`;
                        }
                      }

                      return (
                        <Box component="li" key={key} {...otherProps}>
                          <Box sx={{ width: '100%' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="body1">{displayName}</Typography>
                              {option.isRegionOnly && (
                                <Chip 
                                  size="small" 
                                  label="FULL REGION" 
                                  color="secondary" 
                                  variant="outlined"
                                  sx={{ height: 20, fontSize: '0.625rem', fontWeight: 'bold' }} 
                                />
                              )}
                            </Box>
                            {option.region === 'All Regions' && (
                              <Typography variant="caption" color="text.secondary">
                                Serves multiple regions
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      );
                    }}
                    noOptionsText="No offices found"
                    loading={false}
                    fullWidth
                  />
                </Grid>
              )}

              {formData.userRole !== 'BUDGET_PLANNING_ANALYST' && formData.assignmentLevel === 'RESPONSIBILITY_CENTER' && (
                <Grid item xs={12}>
                  <Autocomplete
                    disabled={!formData.officeId}
                    options={organizationStructure?.availableUnits?.responsibilityCenters
                      ?.filter(rc => {
                        // Kapag may napiling Office → limit by officeId
                        // Kapag legacy data at walang officeId → ipakita lahat para pwedeng magpili ulit.
                        if (!formData.officeId) return true;
                        const rcOfficeId = String(rc.officeId || '');
                        const selectedOfficeId = String(formData.officeId || '');
                        return rcOfficeId === selectedOfficeId;
                      }) || []}
                    getOptionLabel={(option) => {
                      if (typeof option === 'string') return option;
                      const name = option.name || '';
                      // Only append office name or region if it's not already part of the name to avoid duplicates
                      if (option.officeName && option.officeName.trim().length > 0) {
                        if (name.includes(option.officeName)) return name;
                        return `${name} - ${option.officeName}`;
                      }
                      if (option.region && option.region !== 'All Regions') {
                        if (name.includes(option.region)) return name;
                        return `${name} - ${option.region}`;
                      }
                      return name;
                    }}
                    value={(() => {
                      const centers = organizationStructure?.availableUnits?.responsibilityCenters || [];
                      const selectedOfficeId = String(formData.officeId || '');

                      // 1) Subukan muna: match by name + officeId (pinaka-strikto, para sa bagong data)
                      let match = centers.find(rc =>
                        rc.name === formData.responsibilityCenterName &&
                        String(rc.officeId || '') === selectedOfficeId
                      );

                      // 2) Fallback: kung wala, match by name lang (para sa lumang records na walang officeId / ibang format)
                      if (!match && formData.responsibilityCenterName) {
                        match = centers.find(rc => rc.name === formData.responsibilityCenterName);
                      }

                      return match || null;
                    })()}
                    isOptionEqualToValue={(option, value) => {
                      if (!option || !value) return false;
                      const sameName = String(option.name || '') === String(value.name || '');
                      const sameOffice =
                        String(option.officeId || '') === String(value.officeId || '');
                      // Kapag walang officeId info (legacy), sapat na ang name;
                      // kung meron, gamitin pareho para maiwasan maling match.
                      if (!formData.officeId) return sameName;
                      return sameName && sameOffice;
                    }}
                    onChange={(event, newValue) => {
                      // Handle both object (selected option) and string (free text) cases
                      const centerName = (typeof newValue === 'object' && newValue?.name) ? newValue.name : '';
                      handleFormChange('responsibilityCenterName', centerName);
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Responsibility Center"
                        placeholder="Search responsibility centers..."
                        fullWidth
                        helperText={!formData.officeId 
                          ? 'Please select an Office first to view Responsibility Centers' 
                          : ''}
                      />
                    )}
                    renderOption={(props, option) => {
                      const { key, ...otherProps } = props;
                      const name = option.name || '';
                      let displayName = name;
                      
                      // Avoid duplicates in display name
                      if (option.officeName && option.officeName.trim().length > 0) {
                        if (!name.includes(option.officeName)) {
                          displayName = `${name} - ${option.officeName}`;
                        }
                      } else if (option.region && option.region !== 'All Regions') {
                        if (!name.includes(option.region)) {
                          displayName = `${name} - ${option.region}`;
                        }
                      }

                      return (
                        <Box component="li" key={key} {...otherProps}>
                          <Box>
                            <Typography variant="body1">{displayName}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Office: {option.officeName || 'N/A'}
                              {option.region === 'All Regions' && ' | Serves multiple regions'}
                            </Typography>
                          </Box>
                        </Box>
                      );
                    }}
                    noOptionsText={!formData.officeId 
                      ? "Please select an Office first" 
                      : "No responsibility centers found for selected office"}
                    loading={false}
                    fullWidth
                  />
                </Grid>
              )}

              <Grid item xs={12}>
                <Alert severity="info" icon={<InfoIcon />}>
                  <Typography variant="subtitle2">Consolidation Behavior:</Typography>
                  <Typography variant="body2">
                    {getConsolidationInfo(formData.assignmentLevel)}
                  </Typography>
                </Alert>
              </Grid>

              <Grid item xs={12}>
                <Stack direction="row" spacing={2}>
                  <Button
                    type="submit"
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={createOrUpdateMutation.isLoading}
                    startIcon={createOrUpdateMutation.isLoading ? <CircularProgress size={20} /> : <AssignmentIcon />}
                  >
                    {editingAssignment ? 'Update' : 'Create'} Assignment
                  </Button>
                  <Button variant="outlined" onClick={resetForm}>
                    Cancel
                  </Button>
                </Stack>
              </Grid>
            </Grid>
        </DialogContent>
      </Dialog>

      <Paper 
        sx={{ 
          p: 3, 
          background: '#ffffff', 
          borderRadius: '16px', 
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
          border: '1px solid rgba(0, 0, 0, 0.05)' 
        }}
      >

            {loadingAssignments ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress sx={{ color: '#386641' }} />
              </Box>
            ) : (
              <TableContainer>
                <Table size="small" aria-label="Assignments Table">
                  <TableHead sx={{ backgroundColor: 'rgba(56, 102, 65, 0.05)' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, color: '#386641', borderBottom: '1px solid rgba(0, 0, 0, 0.05)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>User</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#386641', borderBottom: '1px solid rgba(0, 0, 0, 0.05)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Role</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#386641', borderBottom: '1px solid rgba(0, 0, 0, 0.05)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Level</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#386641', borderBottom: '1px solid rgba(0, 0, 0, 0.05)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Organization</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#386641', borderBottom: '1px solid rgba(0, 0, 0, 0.05)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Status</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700, color: '#386641', borderBottom: '1px solid rgba(0, 0, 0, 0.05)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(() => {
                      const filteredAssignments = assignments.filter(assignment => assignment.userRole !== 'SUPER_ADMIN');
                      return filteredAssignments
                        .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                        .map((assignment) => (
                        <TableRow 
                          key={assignment.userId}
                          sx={{ 
                            opacity: assignment.isActive === false ? 0.6 : 1,
                            transition: 'all 0.2s',
                            '&:hover': { background: 'rgba(0, 0, 0, 0.02)' }
                          }}
                        >
                          <TableCell sx={{ borderBottom: '1px solid rgba(0, 0, 0, 0.05)' }}>
                            <Typography variant="body2" fontWeight="600" color="text.primary">
                              {assignment.userName}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {assignment.userId}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ borderBottom: '1px solid rgba(0, 0, 0, 0.05)' }}>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {(assignment.userRoles && assignment.userRoles.length > 0) ? (
                              assignment.userRoles.map((roleVal) => {
                                const normalized = String(roleVal || '').replace(/\s+/g, '_');
                                const role = USER_ROLES.find(r =>
                                  r.value === roleVal || r.value === normalized ||
                                  r.value?.replace(/_/g, ' ') === roleVal
                                );
                                return (
                                  <Chip
                                    key={roleVal}
                                    label={role ? role.label : roleVal}
                                    size="small"
                                    color="primary"
                                    variant="outlined"
                                  />
                                );
                              })
                            ) : (
                            <Chip
                              label={(() => {
                                // First check if userRole is explicitly set
                                if (assignment.userRole) {
                                  const role = USER_ROLES.find(r => r.value === assignment.userRole);
                                  return role ? role.label : assignment.userRole;
                                }
                                
                                // Fallback to inference from level and permissions (Updated for new roles)
                                const level = assignment.assignmentLevel;
                                const perms = assignment.rolePermissions || {};
                                
                                // NEW ROLE INFERENCE LOGIC (September 2025)
                                if (level === 'RESPONSIBILITY_CENTER' || level === 'DIVISION' || level === 'DIVISION_LEVEL') {
                                  if (perms.ApproveProposals) {
                                    return 'Budget Approver'; // New role for approvers at division level
                                  } else if (perms.EditAllProposals) {
                                    return 'Budget Reviewer'; // New role for reviewers
                                  } else {
                                    return 'Budget Preparer'; // Default budget preparer at division/responsibility center level
                                  }
                                } else if (level === 'OFFICE' || level === 'DEPARTMENT' || level === 'DEPARTMENT_REGIONAL_LEVEL' || level === 'REGION') {
                                  if (perms.ApproveProposals) {
                                    return 'Budget Approver'; // New role for approvers at office level
                                  } else {
                                    return 'Budget Preparer'; // Default budget preparer at office level
                                  }
                                } else if (level === 'BUDGET_AND_REVENUE_DIVISION') {
                                  if (perms.ManageSettings) {
                                    return 'Budget Manager';
                                  } else if (perms.EditAllProposals && perms.ApproveProposals) {
                                    return 'Budget Officer';
                                  } else {
                                    return 'Budget Preparer';
                                  }
                                } else if (level === 'FULL') {
                                  if (perms.ManageSettings) {
                                    return 'ADMIN';
                                  } else {
                                    return 'ADMIN'; // FULL level is admin
                                  }
                                }
                                return 'Unknown';
                              })()}
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                            )}
                            </Box>
                          </TableCell>
                          <TableCell sx={{ borderBottom: '1px solid rgba(0, 0, 0, 0.05)' }}>
                            <Chip
                              label={getAccessLevelInfo(assignment.assignmentLevel).label}
                              size="small"
                              sx={{
                                backgroundColor: getAccessLevelInfo(assignment.assignmentLevel).color,
                                color: 'white'
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ borderBottom: '1px solid rgba(0, 0, 0, 0.05)' }}>
                            <Tooltip
                              title={
                                loadingOrganization ? 'Loading organization details...' :
                                organizationError ? 'Failed to load organization details' :
                                <Box>
                                  <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                                    Organization Details
                                  </Typography>
                                  <Typography variant="caption" display="block">
                                    Level: {getAccessLevelInfo(assignment.assignmentLevel).label}
                                  </Typography>
                                  {assignment.regions?.length > 0 && (
                                    <Typography variant="caption" display="block">
                                      Regions: {assignment.regions.map(r => r.regionName || r.Region).join(', ')}
                                    </Typography>
                                  )}
                                  {assignment.departments?.length > 0 && (
                                    <Typography variant="caption" display="block">
                                      Departments: {assignment.departments.map(d => d.Department || d.name).join(', ')}
                                    </Typography>
                                  )}
                                  {assignment.divisions?.length > 0 && (
                                    <Typography variant="caption" display="block">
                                      Divisions: {assignment.divisions.join(', ')}
                                    </Typography>
                                  )}
                                </Box>
                              }
                              arrow
                              placement="top"
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}>
                                {normalizeAssignmentLevel(assignment.assignmentLevel) === 'FULL' && (
                                  <Chip
                                    label="FULL"
                                    size="small"
                                    color="primary"
                                    variant="outlined"
                                  />
                                )}
                                {normalizeAssignmentLevel(assignment.assignmentLevel) === 'OWN_ONLY' && (
                                  <Chip
                                    label="OWN"
                                    size="small"
                                    color="warning"
                                    variant="outlined"
                                  />
                                )}
                                {organizationError && (
                                  <WarningIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                                )}
                                {/* Show permissions indicator if user has non-default permissions */}
                                {(() => {
                                  const defaultPerms = {
                                    CreateProposals: true,
                                    EditOwnProposals: true,
                                    EditAllProposals: false,
                                    DeleteProposals: false,
                                    ApproveProposals: false,
                                    ViewReports: true,
                                    ManageUsers: false,
                                    ManageSettings: false
                                  };
                                  const userPerms = assignment.rolePermissions || {};
                                  const hasCustomPerms = Object.keys(defaultPerms).some(key =>
                                    (userPerms[key] || false) !== defaultPerms[key]
                                  );
                                  return hasCustomPerms && (
                                    <Tooltip title="Custom permissions configured">
                                      <Badge
                                        variant="dot"
                                        color="secondary"
                                        sx={{
                                          '& .MuiBadge-dot': {
                                            width: 8,
                                            height: 8,
                                            borderRadius: '50%'
                                          }
                                        }}
                                      >
                                        <Box sx={{ width: 8, height: 8 }} />
                                      </Badge>
                                    </Tooltip>
                                  );
                                })()}

                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                  {getOrganizationDisplay(assignment)}
                                </Typography>
                              </Box>
                            </Tooltip>
                          </TableCell>
                          <TableCell sx={{ borderBottom: '1px solid rgba(0, 0, 0, 0.05)' }}>
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={assignment.isActive !== false}
                                  onChange={() => handleStatusToggle(assignment.userId, assignment.isActive !== false)}
                                  color="success"
                                  size="small"
                                />
                              }
                              label={
                                <Typography variant="caption" color={assignment.isActive !== false ? "success.main" : "text.secondary"}>
                                  {assignment.isActive !== false ? 'Active' : 'Inactive'}
                                </Typography>
                              }
                            />
                          </TableCell>
                          <TableCell align="center" sx={{ borderBottom: '1px solid rgba(0, 0, 0, 0.05)' }}>
                            <Tooltip title="Edit Assignment">
                              <IconButton
                                size="small"
                                sx={{ color: '#386641', '&:hover': { background: 'rgba(56, 102, 65, 0.1)' } }}
                                onClick={async () => {
                                  setEditingAssignment(assignment);
                                  setUserLookupId(String(assignment.userId || ''));
                                  
                                  // ✅ Infer role from assignment level and permissions (same logic as table display)
                                  let inferredRole = '';
                                  const level = assignment.assignmentLevel;
                                  const perms = assignment.rolePermissions || {};
                                  
                                  if (level === 'BUDGET_AND_REVENUE_DIVISION') {
                                    inferredRole = assignment.userRole || (assignment.userRoles && assignment.userRoles[0]) || 'BUDGET_PLANNING_ANALYST';
                                  } else if (level === 'RESPONSIBILITY_CENTER' || level === 'DIVISION') {
                                    inferredRole = assignment.userRole || 'BUDGET PLANNING ANALYST';
                                  } else if (level === 'OFFICE' || level === 'DEPARTMENT' || level === 'REGION') {
                                    if (perms.ApproveProposals) {
                                      inferredRole = 'BUDGET OFFICER';
                                    } else {
                                      inferredRole = 'BUDGET APPROVER';
                                    }
                                  } else if (level === 'FULL') {
                                    if (perms.ManageSettings) {
                                      inferredRole = 'SUPER_ADMIN';
                                    } else {
                                      inferredRole = 'BUDGET MANAGER';
                                    }
                                  }
                                  
                                  // Extract only the necessary form fields from the assignment
                                  const reverseAssignmentLevelMap = {
                                    'DIVISION': 'RESPONSIBILITY_CENTER',
                                    'DIVISION_LEVEL': 'RESPONSIBILITY_CENTER',
                                    'RESPONSIBILITY_CENTER': 'RESPONSIBILITY_CENTER',
                                    'DEPARTMENT': 'OFFICE',
                                    'DEPARTMENT_REGIONAL_LEVEL': 'OFFICE',
                                    'OFFICE': 'OFFICE',
                                    'REGION': 'OFFICE', // Map REGION level to OFFICE dropdown (which now contains regions)
                                    'BUDGET_AND_REVENUE_DIVISION': 'BUDGET_AND_REVENUE_DIVISION',
                                    'FULL': 'FULL',
                                    'OWN_ONLY': 'OWN_ONLY'
                                  };

                                  // Extract officeId correctly (handle populated objects)
                                  const getRawId = (val) => {
                                    if (!val) return '';
                                    if (typeof val === 'string') return val;
                                    return val._id || val.id || '';
                                  };

                                  // For REGION level, the "Office" is actually the regionId
                                  let effectiveOfficeId = '';
                                  if (assignment.assignmentLevel === 'REGION' || assignment.assignmentLevel === 'BUDGET_AND_REVENUE_DIVISION') {
                                    effectiveOfficeId = getRawId(assignment.regionId);
                                  } else {
                                    const deptId = getRawId(assignment.departmentId);
                                    const regId = getRawId(assignment.regionId);
                                    // Reconstruct composite ID if both exist (e.g. for regional departments)
                                    if (deptId && regId && !assignment.officeId) {
                                      effectiveOfficeId = `${deptId}_${regId}`;
                                    } else {
                                      effectiveOfficeId = assignment.officeId || deptId;
                                    }
                                  }
                                  
                                  const formFields = {
                                    userId: assignment.userId,
                                    userName: assignment.userName,
                                    email: assignment.email,
                                    // NEW: Include multiple roles when editing
                                    userRoles: assignment.userRoles || [],
                                    userRole: assignment.userRole || inferredRole,
                                    assignmentLevel: reverseAssignmentLevelMap[assignment.assignmentLevel] || assignment.assignmentLevel,
                                    officeId: effectiveOfficeId, 
                                    responsibilityCenterName: assignment.divisionName || assignment.responsibilityCenterName || '',
                                    isNIAWide: assignment.isNIAWide || false, // Load NIA-Wide flag from assignment
                                    assignedRegions: assignment.assignedRegions || [], // Load assigned regions from assignment
                                    rolePermissions: assignment.rolePermissions || {
                                      CreateProposals: true,
                                      EditOwnProposals: true,
                                      EditAllProposals: false,
                                      DeleteProposals: false,
                                      ApproveProposals: false,
                                      ViewReports: true,
                                      ManageUsers: false,
                                      ManageSettings: false
                                    }
                                  };
                                  
                                  setFormData(formFields);
                                  setIsDialogOpen(true);
                                  
                                  // Fetch fresh user data from FMIS-Main when editing (sync roles if changed there)
                                  if (assignment.userId) {
                                    try {
                                      const res = await api.get(`/api/hierarchical-rbac/user-lookup/${assignment.userId}`);
                                      const fmisData = res.data?.data || res.data;
                                      if (fmisData) {
                                        if (fmisData.userName) handleFormChange('userName', fmisData.userName);
                                        if (fmisData.email) handleFormChange('email', fmisData.email);
                                        if (fmisData.budgetRoles && fmisData.budgetRoles.length > 0) {
                                          handleFormChange('userRoles', fmisData.budgetRoles);
                                          handleFormChange('userRole', fmisData.budgetRole || fmisData.budgetRoles[0]);
                                        }
                                        setSnackbar({ open: true, message: 'User data refreshed from FMIS-Main', severity: 'info' });
                                      }
                                    } catch (err) {
                                      console.warn('FMIS-Main lookup on edit failed:', err?.message);
                                    }
                                  }
                                  
                                  // Ensure Central Office Department/Division fields appear correctly when editing BPA
                                  const isBPAEdit = (formFields.userRole === 'BUDGET_PLANNING_ANALYST' || inferredRole === 'BUDGET PLANNING ANALYST' ||
                                    (formFields.userRoles || []).some(r => /BUDGET_PLANNING_ANALYST|BUDGET PLANNING ANALYST/i.test(String(r))));
                                  if (isBPAEdit) {
                                    const regions = formFields.assignedRegions || [];
                                    const hasCentral = regions.some(r =>
                                      String(r || '').toLowerCase().includes('central office')
                                    );
                                    setHasCentralOfficeSelected(hasCentral);
                                  } else {
                                    // For non-BPA, do not show Central Office-specific controls
                                    setHasCentralOfficeSelected(false);
                                  }
                                  
                                  // console.log('📝 Edit form populated:', {
                                    // userId: formFields.userId,
                                    // userRole: formFields.userRole,
                                    // actualUserRole,
                                    // assignmentLevel: formFields.assignmentLevel,
                                    // officeId: formFields.officeId,
                                    // responsibilityCenter: formFields.responsibilityCenterName,
                                    // isNIAWide: formFields.isNIAWide,
                                    // assignedRegions: formFields.assignedRegions
                                  // });
                                }}
                              >
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete Assignment">
                              <IconButton
                                size="small"
                                color="error"
                                sx={{ '&:hover': { background: 'rgba(211, 47, 47, 0.1)' } }}
                                onClick={() => handleDelete(assignment.userId)}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ));
                    })()}
                  </TableBody>
                </Table>
                <TablePagination
                  sx={{ color: 'text.primary', borderTop: '1px solid rgba(0, 0, 0, 0.08)' }}
                  rowsPerPageOptions={[5, 10, 25]}
                  component="div"
                  count={assignments.filter(a => a.userRole !== 'SUPER_ADMIN').length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                />
              </TableContainer>
            )}
          </Paper>

      <CustomSnackbar
        open={snackbar.open}
        handleClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
        severity={snackbar.severity}
      />

      <Dialog 
        open={isPageAccessDialogOpen} 
        onClose={() => setIsPageAccessDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            background: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
          }
        }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid rgba(0,0,0,0.08)', fontWeight: 600, color: '#386641' }}>Page Access Settings</DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }} gutterBottom>
            Select which roles are authorized to access the Hierarchical User Assignments page. (Super Admins always have access).
          </Typography>
          {loadingPageAccess ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : pageAccessConfig ? (
            <FormGroup sx={{ mt: 2 }}>
              {USER_ROLES.map((role) => (
                <FormControlLabel
                  key={role.value}
                  control={
                    <Checkbox
                      checked={(pageAccessConfig.requiredWorkflowRoles || []).includes(role.value) || role.value === 'SUPER_ADMIN'}
                      disabled={role.value === 'SUPER_ADMIN'}
                      onChange={() => toggleRoleAccess(role.value)}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight="bold">{role.label}</Typography>
                      <Typography variant="caption" color="text.secondary">{role.description}</Typography>
                    </Box>
                  }
                  sx={{ mb: 1 }}
                />
              ))}
            </FormGroup>
          ) : (
            <Typography color="error">Configuration not available.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsPageAccessDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSavePageAccess} variant="contained" disabled={loadingPageAccess || !pageAccessConfig}>
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the assignment for user "{deleteUserId}"?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button
            onClick={confirmDelete}
            color="error"
            variant="contained"
            disabled={deleteMutation.isLoading}
          >
            {deleteMutation.isLoading ? <CircularProgress size={20} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default HierarchicalUserAssignmentPage;
