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
  Autocomplete
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
  Warning as WarningIcon
} from '@mui/icons-material';
import { isTokenExpired } from '../utils/jwt';

const ACCESS_LEVELS = [
  { value: 'RESPONSIBILITY_CENTER', label: 'Responsibility Center Level', icon: <BusinessIcon />, color: '#2196F3' },
  { value: 'OFFICE', label: 'Office Level', icon: <DomainIcon />, color: '#FF9800' },
  { value: 'FULL', label: 'Budget Admin Level', icon: <HierarchyIcon />, color: '#9C27B0' },
  { value: 'OWN_ONLY', label: 'Own Records Only', icon: <PersonIcon />, color: '#757575' }
];

// New unified workflow roles (September 2025)
const USER_ROLES = [
  { 
    value: 'PREPARER', 
    label: 'Preparer', 
    description: 'Creates and edits budget proposals',
    workflowRoles: 'PREPARER (creates proposals)',
    assignmentLevels: ['DIVISION_LEVEL', 'DEPARTMENT_REGIONAL_LEVEL']
  },
  { 
    value: 'REVIEWER', 
    label: 'Reviewer', 
    description: 'Reviews proposals for quality assurance (Division level only)',
    workflowRoles: 'REVIEWER (mandatory review step)',
    assignmentLevels: ['DIVISION_LEVEL']
  },
  { 
    value: 'APPROVER', 
    label: 'Approver', 
    description: 'Approves proposals after review/creation',
    workflowRoles: 'APPROVER (approves proposals)',
    assignmentLevels: ['DIVISION_LEVEL', 'DEPARTMENT_REGIONAL_LEVEL']
  },
  { 
    value: 'BUDGET_ANALYST', 
    label: 'Preparer', 
    description: 'Performs technical analysis of proposals',
    workflowRoles: 'BUDGET_ANALYST (analyzes budget proposals)',
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
    label: 'Overall Budget Approver', 
    description: 'Final executive-level approval authority',
    workflowRoles: 'OVERALL_BUDGET_APPROVER (executive approval)',
    assignmentLevels: ['BUDGET_AND_REVENUE_DIVISION']
  },
  { 
    value: 'BUDGET_ADMIN', 
    label: 'Budget Admin', 
    description: 'Full administrative access - manages all proposals, users, and system settings',
    workflowRoles: 'All workflow roles (full system access)',
    assignmentLevels: ['FULL']
  }
];

const HierarchicalUserAssignmentPage = () => {
  const { currentUser, jwtToken, refetchUserProfile } = useUser();
  const queryClient = useQueryClient();

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Ref to track current lookup value for auto-lookup
  const currentLookupValue = React.useRef('');

  // Form state
  const [formData, setFormData] = useState({
    userId: '',
    userName: '',
    email: '',
    userRole: '',
    assignmentLevel: 'OFFICE', // Changed from assignmentLevel to match new structure
    officeId: '',
    responsibilityCenterName: '',
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

  // Check if user is admin
  const isAdmin = currentUser?.Roles && (
    currentUser.Roles.includes('BUDGET ADMIN') ||
    currentUser.Roles.includes('BUDGET MANAGER') ||
    currentUser.Roles.includes('BUDGET OFFICER') ||
    currentUser.Roles.includes('SUPER ADMIN') ||
    currentUser.Roles.includes('ADMIN')
  );

  // Fetch organization structure
  const { data: organizationStructure, isLoading: loadingOrganization, error: organizationError } = useQuery({
    queryKey: ['hierarchical-organization-structure'],
    queryFn: async () => {
      try {
        if (isTokenExpired(jwtToken)) {
          throw new Error('Session expired. Please log in again.');
        }
        const res = await api.get('/api/hierarchical-rbac/organization-structure?structure=new');
        let data = res.data?.data || { availableUnits: { offices: [], responsibilityCenters: [], officeResponsibilityCenterMappings: {} }, mappings: [] };

        const regionsCount = data?.availableUnits?.offices?.length || 0;
        const departmentsCount = data?.availableUnits?.responsibilityCenters?.length || 0;

        if (regionsCount === 0 || departmentsCount === 0) {
          console.log('New structure not available, falling back to old structure');
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
                offices: ((data.availableUnits.offices?.length ? data.availableUnits.offices : fallbackRegions.map(r => ({ id: r._id, name: r.Region }))) || [])
                  .sort((a, b) => {
                    // Central offices (All Regions) first, grouped together
                    const aIsCentral = a.region === 'All Regions';
                    const bIsCentral = b.region === 'All Regions';
                    
                    if (aIsCentral && !bIsCentral) return -1;
                    if (!aIsCentral && bIsCentral) return 1;
                    
                    // Within central offices, use custom order
                    if (aIsCentral && bIsCentral) {
                      const centralOrder = [
                        'ADMINISTRATIVE DEPARTMENT',
                        'CORPORATE PLANNING SERVICES',
                        'PUBLIC AFFAIRS AND STAFF INFORMATION',
                        'LEGAL SERVICES',
                        'INTERNAL AUDIT SERVICES',
                        'FINANCIAL MANAGEMENT DEPARTMENT',
                        'HEAD OFFICE',
                        'OPERATIONS DEPARTMENT',
                        'IRRIGATION MANAGEMENT OFFICE'
                      ];
                      const aIndex = centralOrder.indexOf(a.name);
                      const bIndex = centralOrder.indexOf(b.name);
                      
                      if (aIndex !== -1 && bIndex !== -1) {
                        return aIndex - bIndex;
                      }
                      if (aIndex !== -1) return -1;
                      if (bIndex !== -1) return 1;
                      
                      // Fallback to alphabetical
                      return a.name.localeCompare(b.name);
                    }
                    
                    // Within region-specific offices, sort by region then name
                    const regionCompare = (a.region || '').localeCompare(b.region || '');
                    if (regionCompare !== 0) return regionCompare;
                    
                    return a.name.localeCompare(b.name);
                  }),
                responsibilityCenters: (data.availableUnits.responsibilityCenters?.length ? data.availableUnits.responsibilityCenters : fallbackDepartments.map(d => ({ id: d._id, name: d.Department }))) || [],
                officeResponsibilityCenterMappings: data.availableUnits.officeResponsibilityCenterMappings || {}
              },
              mappings: data.mappings || []
            };

            return normalized;
          } catch (fallbackError) {
            console.log('Fallback to old structure also failed:', fallbackError.message);
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
    enabled: !!currentUser && !!jwtToken,
    retry: (failureCount, error) => error.message.includes('network') && failureCount < 3,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });

  // Fetch hierarchical assignments
  const { data: assignments = [], isLoading: loadingAssignments } = useQuery({
    queryKey: ['hierarchical-assignments'],
    queryFn: async () => {
      try {
        if (isTokenExpired(jwtToken)) {
          throw new Error('Session expired. Please log in again.');
        }
        const deriveUserId = () => currentUser?.Username?.[0] || currentUser?.Id || currentUser?.id || currentUser?.userId;

        if (isAdmin) {
          try {
            // Use hierarchical assignments endpoint (focus on hierarchical system)
            const res = await api.get('/api/hierarchical-rbac/assignments');
            return res.data?.assignments || res.data || [];
          } catch (err) {
            console.log('Hierarchical assignments endpoint failed:', err.message);
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
          console.log('Hierarchical assignments endpoint failed for user:', err.message);
          return [];
        }
      } catch (error) {
        console.error('Error fetching hierarchical assignments:', error);
        return [];
      }
    },
    enabled: !!currentUser && !!jwtToken,
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
        if (isTokenExpired(jwtToken)) {
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
    if (userLookupData && !editingAssignment) {
      handleFormChange('userId', userLookupData.userId || '');
      handleFormChange('userName', userLookupData.userName || '');
      handleFormChange('email', userLookupData.email || '');
      const budgetRole = userLookupData.budgetRole || 'BUDGET_ANALYST';
      handleFormChange('userRole', budgetRole);

      // Auto-set assignment level and permissions based on the budget role
      if (budgetRole === 'BUDGET_ANALYST') {
        handleFormChange('assignmentLevel', 'RESPONSIBILITY_CENTER');
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
      } else if (budgetRole === 'APPROVER') {
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
      } else if (budgetRole === 'BUDGET_OFFICER') {
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
      } else if (budgetRole === 'BUDGET_MANAGER') {
        handleFormChange('assignmentLevel', 'DIVISION');
        handleFormChange('rolePermissions', {
          CreateProposals: true,
          EditOwnProposals: true,
          EditAllProposals: true,
          DeleteProposals: false,
          ApproveProposals: true,
          ViewReports: true,
          ManageUsers: true,
          ManageSettings: false
        });
      } else if (budgetRole === 'BUDGET_ADMIN') {
        handleFormChange('assignmentLevel', 'FULL');
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
        handleFormChange('workflowRoles', null);
      }
    }
  }, [userLookupData, editingAssignment]);

  // Mutation for creating/updating assignments
  const createOrUpdateMutation = useMutation({
    mutationFn: async (data) => {
      if (isTokenExpired(jwtToken)) {
        throw new Error('Session expired. Please log in again.');
      }

      // Use hierarchical assignments endpoint (focus on hierarchical system)
      const res = await api.post('/api/hierarchical-rbac/assignments', data, {
        headers: { Authorization: `Bearer ${jwtToken}` }
      });
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
      if (isTokenExpired(jwtToken)) {
        throw new Error('Session expired. Please log in again.');
      }
      return api.delete(`/api/hierarchical-rbac/assignments/${userId}`, {
        headers: { Authorization: `Bearer ${jwtToken}` }
      });
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
      userRole: '',
      assignmentLevel: 'OFFICE', // Keep assignmentLevel for form state
      officeId: '',
      responsibilityCenterName: '',
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

    if (!isValidEmail(formData.email)) {
      setSnackbar({
        open: true,
        message: 'Please enter a valid email address',
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

    // Validate based on normalized level
    if (normalizedLevel === 'RESPONSIBILITY_CENTER' && (!formData.officeId || !formData.responsibilityCenterName)) {
      setSnackbar({
        open: true,
        message: 'Responsibility Center assignment requires Office and Responsibility Center',
        severity: 'warning'
      });
      return;
    }

    if (normalizedLevel === 'OFFICE' && !formData.officeId) {
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
      userRole: formData.userRole,
      assignmentLevel: normalizedLevel,
      accessScope: normalizedLevel,
      rolePermissions: formData.rolePermissions
    };

    // Only include organizational fields when they have values
    // Map officeId to departmentId and responsibilityCenterName to divisionName for server compatibility
    if (formData.officeId && formData.officeId.trim()) {
      // Handle composite officeId for regional offices (format: originalDeptId_regionId)
      payload.departmentId = formData.officeId.includes('_') 
        ? formData.officeId.split('_')[0] 
        : formData.officeId;
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
    return level === 'DIVISION'
      ? 'RESPONSIBILITY_CENTER'
      : level === 'DEPARTMENT'
        ? 'OFFICE'
        : level;
  };

  const getAccessLevelInfo = (level) => {
    const normalizedLevel = normalizeAssignmentLevel(level);
    return ACCESS_LEVELS.find(al => al.value === normalizedLevel) || ACCESS_LEVELS[0];
  };

  const getConsolidationInfo = (level) => {
    switch (level) {
      case 'RESPONSIBILITY_CENTER':
        return 'Proposals consolidate to Office';
      case 'OFFICE':
        return 'Proposals saved directly to Office';
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

    const { offices = [], responsibilityCenters = [] } = organizationStructure.availableUnits;

    // For FULL access, show special message
    if (normalizeAssignmentLevel(assignment.assignmentLevel) === 'FULL') {
      return 'All Organizations';
    }

    // For OWN_ONLY access
    if (normalizeAssignmentLevel(assignment.assignmentLevel) === 'OWN_ONLY') {
      return 'Own Records Only';
    }

    // Try to find office name by ID
    if (assignment.departmentId || assignment.officeId) {
      const officeId = assignment.departmentId || assignment.officeId;
      const office = offices.find(o => o.id === officeId);
      if (office) {
        let display = office.name;

        // Add responsibility center if available
        if (assignment.divisionName || assignment.responsibilityCenterName) {
          const centerName = assignment.divisionName || assignment.responsibilityCenterName;
          display += ` → ${centerName}`;
        }

        return display;
      }
    }

    // For REGION level assignments
    if (normalizeAssignmentLevel(assignment.assignmentLevel) === 'REGION' && assignment.regions?.length > 0) {
      const region = assignment.regions[0];
      return `Region: ${region.regionName || region.Region || 'Unknown'}`;
    }

    // For OFFICE level assignments without specific office
    if (normalizeAssignmentLevel(assignment.assignmentLevel) === 'OFFICE') {
      return 'Office Level Access';
    }

    // For RESPONSIBILITY_CENTER level assignments without specific center
    if (normalizeAssignmentLevel(assignment.assignmentLevel) === 'RESPONSIBILITY_CENTER') {
      return 'Responsibility Center Access';
    }

    // Fallback: show what we have
    if (assignment.divisionName || assignment.responsibilityCenterName) {
      const centerName = assignment.divisionName || assignment.responsibilityCenterName;
      return `Division: ${centerName}`;
    }

    // If we have department info but no office mapping
    if (assignment.departments?.length > 0) {
      const dept = assignment.departments[0];
      return dept.Department || dept.name || 'Department';
    }

    return 'Not Specified';
  };

  // Helper function for email validation
  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
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

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              {editingAssignment ? 'Edit' : 'Create'} Hierarchical Assignment
            </Typography>

            <Grid container spacing={2}>
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
                      currentLookupValue.current = value;
                      // Trigger lookup immediately with the new value
                      queryClient.fetchQuery({
                        queryKey: ['user-lookup', value],
                        queryFn: async () => {
                          try {
                            if (isTokenExpired(jwtToken)) {
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
                          handleFormChange('email', data.email || '');
                          
                          // NEW ROLE SYSTEM (September 2025)
                          // Map old budgetRole to new workflow roles with sensible defaults
                          // User can still override the role selection in the User Role dropdown
                          const budgetRole = data.budgetRole || 'BUDGET_ANALYST';
                          let defaultRole = 'PREPARER'; // Most common role
                          let defaultLevel = 'OFFICE';
                          
                          // Suggest appropriate role based on user's main database role
                          if (budgetRole === 'BUDGET_ADMIN') {
                            defaultRole = 'BUDGET_ADMIN';
                            defaultLevel = 'FULL';
                          } else if (budgetRole === 'BUDGET_MANAGER') {
                            defaultRole = 'BUDGET_ADMIN'; // Managers get admin role
                            defaultLevel = 'FULL';
                          } else if (budgetRole === 'BUDGET_OFFICER') {
                            defaultRole = 'APPROVER'; // Officers approve proposals
                            defaultLevel = 'OFFICE';
                          } else if (budgetRole === 'APPROVER') {
                            defaultRole = 'APPROVER'; // Approvers review and approve
                            defaultLevel = 'OFFICE';
                          } else if (budgetRole === 'BUDGET_PLANNING_ANALYST') {
                            defaultRole = 'PREPARER'; // Planning Analysts prepare proposals
                            defaultLevel = 'RESPONSIBILITY_CENTER';
                          }
                          
                          handleFormChange('userRole', defaultRole);
                          handleFormChange('assignmentLevel', defaultLevel);
                          
                          // Set permissions based on default role (will be auto-updated when role is finalized)
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
                          
                          if (defaultRole === 'APPROVER') {
                            rolePerms.EditAllProposals = true;
                            rolePerms.ApproveProposals = true;
                          } else if (defaultRole === 'BUDGET_ADMIN') {
                            rolePerms.EditAllProposals = true;
                            rolePerms.DeleteProposals = true;
                            rolePerms.ApproveProposals = true;
                            rolePerms.ManageUsers = true;
                            rolePerms.ManageSettings = true;
                          }
                          
                          handleFormChange('rolePermissions', rolePerms);
                        }
                      }).catch((error) => {
                        console.warn('Auto-lookup query failed:', error);
                      });
                    }
                  }}
                  disabled={!!editingAssignment}
                  required
                  helperText={
                    formData.userId ? 'User information will be auto-filled' : 'Enter a valid user ID (6+ digits)'
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
                  helperText={formData.email && isValidEmail(formData.email) ? '' : 'Valid email is required'}
                  inputProps={{ 'aria-label': 'Email' }}
                />
              </Grid>

              {/* Display user's actual roles from main database */}
              {userLookupData?.roles && userLookupData.roles.length > 0 && (
                <Grid item xs={12}>
                  <Alert severity="info" sx={{ mb: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      User's Actual Roles from Main Database:
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {userLookupData.roles.map((role, index) => (
                        <Chip
                          key={index}
                          label={role}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  </Alert>
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
                  options={USER_ROLES}
                  getOptionLabel={(option) => {
                    if (typeof option === 'string') return option;
                    return option.label || '';
                  }}
                  value={USER_ROLES.find(r => r.value === formData.userRole) || null}
                  onChange={(event, newValue) => {
                    if (newValue) {
                      handleFormChange('userRole', newValue.value);
                      
                      // Auto-update permissions based on selected role
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
                      
                      // Set permissions based on role
                      if (newValue.value === 'APPROVER') {
                        rolePerms.EditOwnProposals = true;
                        rolePerms.EditAllProposals = true;
                        rolePerms.ApproveProposals = true;
                      } else if (newValue.value === 'REVIEWER') {
                        rolePerms.EditOwnProposals = true;
                        rolePerms.EditAllProposals = true;
                      } else if (newValue.value === 'PREPARER') {
                        rolePerms.CreateProposals = true;
                        rolePerms.EditOwnProposals = true;
                      } else if (newValue.value === 'BUDGET_ANALYST' || newValue.value === 'BUDGET_OFFICER' || newValue.value === 'OVERALL_BUDGET_APPROVER') {
                        rolePerms.EditAllProposals = true;
                        rolePerms.ApproveProposals = true;
                        if (newValue.value === 'OVERALL_BUDGET_APPROVER') {
                          rolePerms.ManageSettings = true;
                        }
                      } else if (newValue.value === 'BUDGET_ADMIN') {
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
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="User Role"
                      placeholder="Select a role"
                      helperText="Choose the workflow role for this user"
                      required
                    />
                  )}
                  renderOption={(props, option) => {
                    const { key, ...otherProps } = props;
                    return (
                      <Box component="li" key={key} {...otherProps}>
                        <Box>
                          <Typography variant="body2" fontWeight="bold">
                            {option.label}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {option.description}
                          </Typography>
                        </Box>
                      </Box>
                    );
                  }}
                  noOptionsText="No roles available"
                  fullWidth
                />
              </Grid>

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
                      handleFormChange('userRole', 'PREPARER');
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
                      handleFormChange('userRole', formData.userRole || 'PREPARER');
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
                      handleFormChange('userRole', formData.userRole || 'PREPARER');
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
                      // Update user role - FULL with ManageSettings = BUDGET_ADMIN
                      handleFormChange('userRole', 'BUDGET_ADMIN');
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
                            ? 'Budget admin level access to all organizational levels (all permissions and workflow roles automatically granted)'
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
                        <strong>Budget Admin Level:</strong> All permissions and workflow roles are automatically granted for users with administrative access, including access to all settings pages.
                      </Typography>
                    </Alert>
                  </Grid>
                )}
              </Grid>

              {(formData.assignmentLevel === 'OFFICE' || formData.assignmentLevel === 'RESPONSIBILITY_CENTER') && (
                <Grid item xs={12}>
                  <Autocomplete
                    options={organizationStructure?.availableUnits?.offices || []}
                    getOptionLabel={(option) => {
                      if (typeof option === 'string') return option;
                      return option.region && option.region !== 'All Regions' 
                        ? `${option.name} - ${option.region}` 
                        : option.name || '';
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
                      
                      console.log('🔍 Office matching:', {
                        formDataOfficeId: formData.officeId,
                        matchedOffice: matchedOffice ? matchedOffice.name : 'Not found',
                        availableOffices: offices.map(o => ({ id: o.id, name: o.name }))
                      });
                      
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
                      const displayName = option.region && option.region !== 'All Regions' 
                        ? `${option.name} - ${option.region}` 
                        : option.name;
                      return (
                        <Box component="li" key={key} {...otherProps}>
                          <Box>
                            <Typography variant="body1">{displayName}</Typography>
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

              {formData.assignmentLevel === 'RESPONSIBILITY_CENTER' && (
                <Grid item xs={12}>
                  <Autocomplete
                    disabled={!formData.officeId}
                    options={organizationStructure?.availableUnits?.responsibilityCenters
                      ?.filter(rc => {
                        if (!formData.officeId) return false; // Don't show any responsibility centers if no office is selected
                        
                        // Convert both to strings for comparison
                        const rcOfficeId = String(rc.officeId || '');
                        const selectedOfficeId = String(formData.officeId || '');
                        
                        // Debug logging
                        console.log('Filtering RC:', {
                          rcName: rc.name,
                          rcOfficeId,
                          selectedOfficeId,
                          matches: rcOfficeId === selectedOfficeId
                        });
                        
                        // Direct comparison - both should be composite IDs for split departments
                        return rcOfficeId === selectedOfficeId;
                      }) || []}
                    getOptionLabel={(option) => {
                      if (typeof option === 'string') return option;
                      return option.region && option.region !== 'All Regions' 
                        ? `${option.name} - ${option.region}` 
                        : option.name || '';
                    }}
                    value={organizationStructure?.availableUnits?.responsibilityCenters
                      ?.find(rc => rc.name === formData.responsibilityCenterName) || null}
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
                          ? 'Please select an Office first to view available Responsibility Centers' 
                          : ''}
                      />
                    )}
                    renderOption={(props, option) => {
                      const { key, ...otherProps } = props;
                      const displayName = option.region && option.region !== 'All Regions' 
                        ? `${option.name} - ${option.region}` 
                        : option.name;
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
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Current Assignments ({assignments.length})
            </Typography>

            {loadingAssignments ? (
              <CircularProgress />
            ) : (
              <TableContainer>
                <Table size="small" aria-label="Assignments Table">
                  <TableHead>
                    <TableRow>
                      <TableCell>User</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Level</TableCell>
                      <TableCell>Organization</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {assignments
                      .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                      .map((assignment) => (
                        <TableRow key={assignment.userId}>
                          <TableCell>
                            <Typography variant="body2" fontWeight="bold">
                              {assignment.userName}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              {assignment.userId}
                            </Typography>
                          </TableCell>
                          <TableCell>
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
                                    return 'Approver'; // New role for approvers at division level
                                  } else if (perms.EditAllProposals) {
                                    return 'Reviewer'; // New role for reviewers
                                  } else {
                                    return 'Preparer'; // Default preparer at division/responsibility center level
                                  }
                                } else if (level === 'OFFICE' || level === 'DEPARTMENT' || level === 'DEPARTMENT_REGIONAL_LEVEL') {
                                  if (perms.ApproveProposals) {
                                    return 'Approver'; // New role for approvers at office level
                                  } else {
                                    return 'Preparer'; // Default preparer at office level
                                  }
                                } else if (level === 'BUDGET_AND_REVENUE_DIVISION') {
                                  if (perms.ManageSettings) {
                                    return 'Overall Budget Approver';
                                  } else if (perms.EditAllProposals && perms.ApproveProposals) {
                                    return 'Budget Officer';
                                  } else {
                                    return 'Preparer';
                                  }
                                } else if (level === 'FULL') {
                                  if (perms.ManageSettings) {
                                    return 'Budget Admin';
                                  } else {
                                    return 'Budget Admin'; // FULL level is admin
                                  }
                                }
                                return 'Unknown';
                              })()}
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={getAccessLevelInfo(assignment.assignmentLevel).label}
                              size="small"
                              sx={{
                                backgroundColor: getAccessLevelInfo(assignment.assignmentLevel).color,
                                color: 'white'
                              }}
                            />
                          </TableCell>
                          <TableCell>
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
                          <TableCell>
                            <Tooltip title="Edit Assignment">
                              <IconButton
                                size="small"
                                onClick={async () => {
                                  setEditingAssignment(assignment);
                                  
                                  // ✅ Infer role from assignment level and permissions (same logic as table display)
                                  let inferredRole = '';
                                  const level = assignment.assignmentLevel;
                                  const perms = assignment.rolePermissions || {};
                                  
                                  if (level === 'RESPONSIBILITY_CENTER' || level === 'DIVISION') {
                                    inferredRole = 'BUDGET_ANALYST';
                                  } else if (level === 'OFFICE' || level === 'DEPARTMENT') {
                                    if (perms.ApproveProposals) {
                                      inferredRole = 'BUDGET_OFFICER';
                                    } else {
                                      inferredRole = 'APPROVER';
                                    }
                                  } else if (level === 'FULL') {
                                    if (perms.ManageSettings) {
                                      inferredRole = 'BUDGET_ADMIN';
                                    } else {
                                      inferredRole = 'BUDGET_MANAGER';
                                    }
                                  }
                                  
                                  // Extract only the necessary form fields from the assignment
                                  const reverseAssignmentLevelMap = {
                                    'DIVISION': 'RESPONSIBILITY_CENTER',
                                    'DEPARTMENT': 'OFFICE',
                                    'REGION': 'FULL',
                                    'FULL': 'FULL',
                                    'OWN_ONLY': 'OWN_ONLY'
                                  };
                                  
                                  const formFields = {
                                    userId: assignment.userId,
                                    userName: assignment.userName,
                                    email: assignment.email,
                                    userRole: assignment.userRole || inferredRole,
                                    assignmentLevel: reverseAssignmentLevelMap[assignment.assignmentLevel] || assignment.assignmentLevel,
                                    officeId: assignment.officeId || assignment.departmentId || '', // Use officeId if available, otherwise departmentId
                                    responsibilityCenterName: assignment.divisionName || '',
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
                                  
                                  console.log('📝 Edit form populated:', {
                                    userId: formFields.userId,
                                    userRole: formFields.userRole,
                                    // actualUserRole,
                                    assignmentLevel: formFields.assignmentLevel,
                                    officeId: formFields.officeId,
                                    responsibilityCenter: formFields.responsibilityCenterName
                                  });
                                }}
                              >
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete Assignment">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDelete(assignment.userId)}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
                <TablePagination
                  rowsPerPageOptions={[5, 10, 25]}
                  component="div"
                  count={assignments.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                />
              </TableContainer>
            )}
          </Paper>
        </Grid>
      </Grid>

      <CustomSnackbar
        open={snackbar.open}
        handleClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
        severity={snackbar.severity}
      />

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