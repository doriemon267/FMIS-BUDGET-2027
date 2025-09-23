import React, { useState, useMemo, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  CircularProgress,
  Alert,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  OutlinedInput,
  Checkbox,
  ListItemText,
  FormControlLabel,
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
  Card,
  CardContent,
  CardHeader,
  Divider,
  Stack,
  Badge,
  Accordion,
  AccordionSummary,
  AccordionDetails,
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
  LocationCity as LocationCityIcon,
  ExpandMore as ExpandMoreIcon,
  Assignment as AssignmentIcon,
  AccountTree as HierarchyIcon,
  Info as InfoIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { getFilteredDepartments, getAvailableDivisions, getDepartmentsWithDivisions, selectedDepartmentHasDivisions } from '../utils/organizationUtils';
import { isTokenExpired } from '../utils/jwt';

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 250,
    },
  },
};

const ACCESS_LEVELS = [
  { value: 'RESPONSIBILITY_CENTER', label: 'Responsibility Center Level', icon: <BusinessIcon />, color: '#2196F3' },
  { value: 'OFFICE', label: 'Office Level', icon: <DomainIcon />, color: '#FF9800' },
  { value: 'FULL', label: 'Administrative Level', icon: <HierarchyIcon />, color: '#9C27B0' },
  { value: 'OWN_ONLY', label: 'Own Records Only', icon: <PersonIcon />, color: '#757575' }
];

const WORKFLOW_ROLES = [
  { key: 'responsibilityCenterCreator', label: 'Responsibility Center Creator', description: 'Create proposals at responsibility center level' },
  { key: 'responsibilityCenterApprover', label: 'Responsibility Center Approver', description: 'Approve responsibility center proposals' },
  { key: 'officeCreator', label: 'Office Creator', description: 'Create proposals at office level' },
  { key: 'officeConsolidator', label: 'Office Consolidator', description: 'Consolidate responsibility center to office' },
  { key: 'officeSubmission', label: 'Office Submission', description: 'Submit office proposals for finalization' },
  { key: 'officeFinalVerifier', label: 'Office Final Verifier', description: 'Final verification/approval at office' },
  { key: 'regionCreator', label: 'Region Creator', description: 'Create and manage regional settings' }
];

const getDefaultWorkflowRolesMap = () =>
  WORKFLOW_ROLES.reduce((acc, r) => ({ ...acc, [r.key]: false }), {});

const HierarchicalUserAssignmentPage = () => {
  const { currentUser, jwtToken, refetchUserProfile } = useUser();
  const queryClient = useQueryClient();

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Form state
  const [formData, setFormData] = useState({
    userId: '',
    userName: '',
    email: '',
    assignmentLevel: 'OFFICE', // Changed from assignmentLevel to match new structure
    officeId: '',
    responsibilityCenterName: '',
    workflowRoles: getDefaultWorkflowRolesMap(),
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
    restrictions: {
      readOnlyMode: false,
      allowedBudgetTypes: ['Initial', 'NEP', 'GAA'],
      allowedFiscalYears: []
    },
  });

  // UI state
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [showPermissions, setShowPermissions] = useState(false);
  const [showRestrictions, setShowRestrictions] = useState(false);
  const [rolesDialogOpen, setRolesDialogOpen] = useState(false);
  const [rolesDialogUser, setRolesDialogUser] = useState(null);
  const [rolesDialogMap, setRolesDialogMap] = useState(getDefaultWorkflowRolesMap());
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

  // Fetch settings for fiscal year options
  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      try {
        const response = await api.get('/settings');
        return response.data;
      } catch (error) {
        console.error('❌ Error fetching settings:', error);
        return { settings: [] };
      }
    },
    enabled: !!currentUser && !!jwtToken,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });

  // Extract settings array from the response
  const settings = settingsData?.settings || [];

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

  // Mutation for updating workflow roles inline
  const updateWorkflowRolesMutation = useMutation({
    mutationFn: async ({ userId, workflowRoles }) => {
      if (isTokenExpired(jwtToken)) {
        throw new Error('Session expired. Please log in again.');
      }
      return api.post(`/api/hierarchical-rbac/assignments/${userId}/workflow-roles`, { workflowRoles });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['hierarchical-assignments']);
      // Refresh current user's hierarchical access data
      refetchUserProfile();
      setSnackbar({
        open: true,
        message: 'Workflow roles updated successfully',
        severity: 'success'
      });
    },
    onError: (error) => {
      console.error('Error updating workflow roles:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Failed to update workflow roles',
        severity: 'error'
      });
    }
  });

  // Set default fiscal year when settings are loaded
  useEffect(() => {
    if (settings && settings.length > 0) {
      const activeSetting = settings.find(setting => setting.isActive);
      if (activeSetting && formData.restrictions.allowedFiscalYears.length === 0) {
        setFormData(prev => ({
          ...prev,
          restrictions: {
            ...prev.restrictions,
            allowedFiscalYears: [activeSetting.fiscalYear]
          }
        }));
      }
    }
  }, [settings]);

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
      assignmentLevel: 'OFFICE', // Keep assignmentLevel for form state
      officeId: '',
      responsibilityCenterName: '',
      workflowRoles: getDefaultWorkflowRolesMap(),
      rolePermissions: {
        CreateProposals: true,
        EditOwnProposals: true,
        EditAllProposals: false,
        DeleteProposals: false,
        ApproveProposals: false,
        ViewReports: true,
        ManageUsers: false,
        ManageSettings: false
      }
    });
    setEditingAssignment(null);
    setShowPermissions(false); // Collapse permissions when resetting
    setShowRestrictions(false); // Collapse restrictions when resetting
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

    // Gather selected workflow roles from UI
    const uiSelectedRoles = Object.entries(formData.workflowRoles || {})
      .filter(([, v]) => v)
      .map(([k]) => k);

    // Map UI workflow roles to server-allowed role keys
    const roleMap = {
      responsibilityCenterCreator: 'divisionCreator',
      responsibilityCenterApprover: 'divisionApprover',
      officeCreator: 'departmentCreator',
      officeConsolidator: 'departmentConsolidator',
      officeSubmission: 'departmentSubmission',
      officeFinalVerifier: 'regionFinalVerifier',
      regionCreator: 'regionCreator'
    };
    const serverWorkflowRoles = uiSelectedRoles
      .map((r) => roleMap[r])
      .filter(Boolean);

    const payload = {
      userId: formData.userId,
      userName: formData.userName,
      email: formData.email,
      assignmentLevel: normalizedLevel,
      accessScope: normalizedLevel,
      // Map officeId to departmentId and responsibilityCenterName to divisionName for server compatibility
      // Handle composite officeId for regional offices (format: originalDeptId_regionId)
      departmentId: formData.officeId.includes('_') ? formData.officeId.split('_')[0] : formData.officeId,
      divisionName: formData.responsibilityCenterName,
      officeId: formData.officeId,
      responsibilityCenterName: formData.responsibilityCenterName,
      rolePermissions: {
        ...formData.rolePermissions,
        // Preserve existing UI behavior for ApproveProposals toggle
        ApproveProposals: uiSelectedRoles.includes('officeFinalVerifier')
          ? true
          : formData.rolePermissions.ApproveProposals
      },
      restrictions: formData.restrictions
    };

    // Always include workflowRoles (can be an empty array to explicitly clear roles)
    payload.workflowRoles = serverWorkflowRoles;

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
                  onChange={(e) => handleFormChange('userId', e.target.value)}
                  disabled={!!editingAssignment}
                  required
                  helperText={formData.userId ? '' : 'User ID is required'}
                  inputProps={{ 'aria-label': 'User ID' }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="User Name"
                  value={formData.userName}
                  onChange={(e) => handleFormChange('userName', e.target.value)}
                  required
                  helperText={formData.userName ? '' : 'User Name is required'}
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
                    const nextRoles = { ...formData.workflowRoles };
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
                    } else if (isRC) {
                      // Only RC roles allowed
                      setRole('responsibilityCenterCreator', !!nextRoles.responsibilityCenterCreator);
                      setRole('responsibilityCenterApprover', !!nextRoles.responsibilityCenterApprover);
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
                    } else if (isOffice) {
                      // Office roles allowed; RC creator optional -> keep selection
                      setRole('officeCreator', !!nextRoles.officeCreator);
                      setRole('officeConsolidator', !!nextRoles.officeConsolidator);
                      setRole('officeSubmission', !!nextRoles.officeSubmission);
                      setRole('officeFinalVerifier', !!nextRoles.officeFinalVerifier);
                      // RC roles are typically not applicable at pure office scope
                      setRole('responsibilityCenterCreator', false);
                      setRole('responsibilityCenterApprover', false);
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
                            ? 'Administrative level access to all organizational levels (all permissions and workflow roles automatically granted)'
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
                        <strong>Administrative Level:</strong> All permissions and workflow roles are automatically granted for users with administrative access, including access to all settings pages.
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
                    value={organizationStructure?.availableUnits?.offices?.find(office => office.id === formData.officeId) || null}
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
                    options={organizationStructure?.availableUnits?.responsibilityCenters
                      ?.filter(rc => {
                        if (!formData.officeId) return true;
                        // Handle composite officeId (originalDeptId_regionId)
                        const originalDeptId = formData.officeId.includes('_') ? formData.officeId.split('_')[0] : formData.officeId;
                        return rc.officeId === originalDeptId;
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
                    noOptionsText="No responsibility centers found"
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

              {/* Permissions Management Section */}
              <Grid item xs={12}>
                <Accordion expanded={showPermissions} onChange={() => setShowPermissions(!showPermissions)}>
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    aria-controls="permissions-content"
                    id="permissions-header"
                  >
                    <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AssignmentIcon fontSize="small" />
                      Role Permissions
                      <Chip
                        label={`${Object.values(formData.rolePermissions).filter(Boolean).length} enabled`}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 2 }}>
                      Configure specific permissions for this user. These permissions control what actions the user can perform within their assigned scope.
                    </Typography>

                    <Grid container spacing={2}>
                      {/* Basic Permissions */}
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                          Basic Permissions
                        </Typography>
                        <Stack spacing={1}>
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={formData.rolePermissions.CreateProposals}
                                onChange={(e) => handleFormChange('rolePermissions', {
                                  ...formData.rolePermissions,
                                  CreateProposals: e.target.checked
                                })}
                                size="small"
                              />
                            }
                            label="Create Proposals"
                          />
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={formData.rolePermissions.EditOwnProposals}
                                onChange={(e) => handleFormChange('rolePermissions', {
                                  ...formData.rolePermissions,
                                  EditOwnProposals: e.target.checked
                                })}
                                size="small"
                              />
                            }
                            label="Edit Own Proposals"
                          />
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={formData.rolePermissions.ViewReports}
                                onChange={(e) => handleFormChange('rolePermissions', {
                                  ...formData.rolePermissions,
                                  ViewReports: e.target.checked
                                })}
                                size="small"
                              />
                            }
                            label="View Reports"
                          />
                        </Stack>
                      </Grid>

                      {/* Advanced Permissions */}
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                          Advanced Permissions
                        </Typography>
                        <Stack spacing={1}>
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={formData.rolePermissions.EditAllProposals}
                                onChange={(e) => handleFormChange('rolePermissions', {
                                  ...formData.rolePermissions,
                                  EditAllProposals: e.target.checked
                                })}
                                size="small"
                              />
                            }
                            label="Edit All Proposals"
                          />
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={formData.rolePermissions.ApproveProposals}
                                onChange={(e) => handleFormChange('rolePermissions', {
                                  ...formData.rolePermissions,
                                  ApproveProposals: e.target.checked
                                })}
                                size="small"
                              />
                            }
                            label="Approve Proposals"
                          />
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={formData.rolePermissions.DeleteProposals}
                                onChange={(e) => handleFormChange('rolePermissions', {
                                  ...formData.rolePermissions,
                                  DeleteProposals: e.target.checked
                                })}
                                size="small"
                              />
                            }
                            label="Delete Proposals"
                          />
                        </Stack>
                      </Grid>

                      {/* Administrative Permissions */}
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                          Administrative Permissions
                        </Typography>
                        <Stack direction="row" spacing={2} flexWrap="wrap">
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={formData.rolePermissions.ManageUsers}
                                onChange={(e) => handleFormChange('rolePermissions', {
                                  ...formData.rolePermissions,
                                  ManageUsers: e.target.checked
                                })}
                                size="small"
                              />
                            }
                            label="Manage Users"
                          />
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={formData.rolePermissions.ManageSettings}
                                onChange={(e) => handleFormChange('rolePermissions', {
                                  ...formData.rolePermissions,
                                  ManageSettings: e.target.checked
                                })}
                                size="small"
                              />
                            }
                            label="Manage Settings"
                          />
                        </Stack>
                      </Grid>

                      {/* Quick Actions */}
                      <Grid item xs={12}>
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleFormChange('rolePermissions', {
                              CreateProposals: true,
                              EditOwnProposals: true,
                              EditAllProposals: false,
                              DeleteProposals: false,
                              ApproveProposals: false,
                              ViewReports: true,
                              ManageUsers: false,
                              ManageSettings: false
                            })}
                          >
                            Reset to Basic
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="primary"
                            onClick={() => handleFormChange('rolePermissions', {
                              CreateProposals: true,
                              EditOwnProposals: true,
                              EditAllProposals: true,
                              DeleteProposals: true,
                              ApproveProposals: true,
                              ViewReports: true,
                              ManageUsers: true,
                              ManageSettings: true
                            })}
                          >
                            Grant All
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="warning"
                            onClick={() => handleFormChange('rolePermissions', {
                              CreateProposals: false,
                              EditOwnProposals: false,
                              EditAllProposals: false,
                              DeleteProposals: false,
                              ApproveProposals: false,
                              ViewReports: false,
                              ManageUsers: false,
                              ManageSettings: false
                            })}
                          >
                            Revoke All
                          </Button>
                        </Stack>
                      </Grid>
                    </Grid>
                  </AccordionDetails>
                </Accordion>

                {/* Workflow Roles Section */}
                <Accordion sx={{ mt: 2 }}>
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    aria-controls="workflow-roles-content"
                    id="workflow-roles-header"
                  >
                    <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <HierarchyIcon fontSize="small" />
                      Workflow Roles
                      <Chip
                        label={`${Object.values(formData.workflowRoles || {}).filter(Boolean).length} selected`}
                        size="small"
                        color="secondary"
                        variant="outlined"
                      />
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 2 }}>
                      Select workflow roles to assign. These map to the backend's legacy roles automatically.
                    </Typography>

                    <Grid container spacing={2}>
                      {/* Responsibility Center Roles */}
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                          Responsibility Center Roles
                        </Typography>
                        <Stack spacing={1}>
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={formData.workflowRoles.responsibilityCenterCreator || false}
                                onChange={(e) => handleFormChange('workflowRoles', {
                                  ...formData.workflowRoles,
                                  responsibilityCenterCreator: e.target.checked
                                })}
                                size="small"
                              />
                            }
                            label="Responsibility Center Creator"
                            disabled={!(formData.assignmentLevel === 'RESPONSIBILITY_CENTER' || formData.assignmentLevel === 'FULL')}
                          />
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={formData.workflowRoles.responsibilityCenterApprover || false}
                                onChange={(e) => handleFormChange('workflowRoles', {
                                  ...formData.workflowRoles,
                                  responsibilityCenterApprover: e.target.checked
                                })}
                                size="small"
                              />
                            }
                            label="Responsibility Center Approver"
                            disabled={!(formData.assignmentLevel === 'RESPONSIBILITY_CENTER' || formData.assignmentLevel === 'FULL')}
                          />
                        </Stack>
                      </Grid>

                      {/* Office Roles */}
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                          Office Roles
                        </Typography>
                        <Stack spacing={1}>
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={formData.workflowRoles.officeCreator || false}
                                onChange={(e) => handleFormChange('workflowRoles', {
                                  ...formData.workflowRoles,
                                  officeCreator: e.target.checked
                                })}
                                size="small"
                              />
                            }
                            label="Office Creator"
                            disabled={!(formData.assignmentLevel === 'OFFICE' || formData.assignmentLevel === 'FULL')}
                          />
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={formData.workflowRoles.officeConsolidator || false}
                                onChange={(e) => handleFormChange('workflowRoles', {
                                  ...formData.workflowRoles,
                                  officeConsolidator: e.target.checked
                                })}
                                size="small"
                              />
                            }
                            label="Office Consolidator"
                            disabled={!(formData.assignmentLevel === 'OFFICE' || formData.assignmentLevel === 'FULL')}
                          />
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={formData.workflowRoles.officeSubmission || false}
                                onChange={(e) => handleFormChange('workflowRoles', {
                                  ...formData.workflowRoles,
                                  officeSubmission: e.target.checked
                                })}
                                size="small"
                              />
                            }
                            label="Office Submission"
                            disabled={!(formData.assignmentLevel === 'OFFICE' || formData.assignmentLevel === 'FULL')}
                          />
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={formData.workflowRoles.officeFinalVerifier || false}
                                onChange={(e) => handleFormChange('workflowRoles', {
                                  ...formData.workflowRoles,
                                  officeFinalVerifier: e.target.checked
                                })}
                                size="small"
                              />
                            }
                            label="Office Final Verifier"
                            disabled={!(formData.assignmentLevel === 'OFFICE' || formData.assignmentLevel === 'FULL')}
                          />
                        </Stack>
                      </Grid>

                      {/* Administrative/Regional Roles */}
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                          Administrative Roles
                        </Typography>
                        <Stack spacing={1}>
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={formData.workflowRoles.regionCreator || false}
                                onChange={(e) => handleFormChange('workflowRoles', {
                                  ...formData.workflowRoles,
                                  regionCreator: e.target.checked
                                })}
                                size="small"
                              />
                            }
                            label="Region Creator"
                            disabled={!(formData.assignmentLevel === 'FULL')}
                          />
                        </Stack>
                      </Grid>

                      {/* Quick Actions */}
                      <Grid item xs={12}>
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleFormChange('workflowRoles', getDefaultWorkflowRolesMap())}
                          >
                            Clear All
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="primary"
                            onClick={() => handleFormChange('workflowRoles', WORKFLOW_ROLES.reduce((acc, r) => ({ ...acc, [r.key]: true }), {}))}
                          >
                            Select All
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleFormChange('workflowRoles', {
                              ...getDefaultWorkflowRolesMap(),
                              responsibilityCenterCreator: formData.assignmentLevel === 'RESPONSIBILITY_CENTER' || formData.assignmentLevel === 'OFFICE',
                              officeCreator: formData.assignmentLevel === 'OFFICE',
                              officeConsolidator: formData.assignmentLevel === 'OFFICE',
                              officeSubmission: formData.assignmentLevel === 'OFFICE'
                            })}
                          >
                            Suggest for Level
                          </Button>
                        </Stack>
                      </Grid>
                    </Grid>
                  </AccordionDetails>
                </Accordion>

                {/* Restrictions Management Section */}
                <Accordion expanded={showRestrictions} onChange={() => setShowRestrictions(!showRestrictions)} sx={{ mt: 2 }}>
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    aria-controls="restrictions-content"
                    id="restrictions-header"
                  >
                    <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <DomainIcon fontSize="small" />
                      Access Restrictions
                      <Chip
                        label={`${formData.restrictions?.allowedBudgetTypes?.length || 0} types, ${formData.restrictions?.allowedFiscalYears?.length || 0} years${formData.restrictions?.readOnlyMode ? ' (Read-Only)' : ''}`}
                        size="small"
                        color="info"
                        variant="outlined"
                      />
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 2 }}>
                      Configure access restrictions to limit what budget types and fiscal years this user can work with.
                    </Typography>

                    <Grid container spacing={2}>
                      {/* Budget Types */}
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                          Allowed Budget Types
                        </Typography>
                        <Stack spacing={1}>
                          {['Initial', 'NEP', 'GAA', 'Supplemental', 'Augmentation'].map((budgetType) => (
                            <FormControlLabel
                              key={budgetType}
                              control={
                                <Checkbox
                                  checked={formData.restrictions?.allowedBudgetTypes?.includes(budgetType) || false}
                                  onChange={(e) => {
                                    const currentTypes = formData.restrictions?.allowedBudgetTypes || [];
                                    const newTypes = e.target.checked
                                      ? [...currentTypes, budgetType]
                                      : currentTypes.filter(type => type !== budgetType);
                                    handleFormChange('restrictions', {
                                      ...formData.restrictions,
                                      allowedBudgetTypes: newTypes
                                    });
                                  }}
                                  size="small"
                                />
                              }
                              label={budgetType}
                            />
                          ))}
                        </Stack>
                      </Grid>

                      {/* Fiscal Years */}
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                          Allowed Fiscal Years
                        </Typography>
                        <Stack spacing={1}>
                          {(() => {
                            // Use fiscal years from database settings instead of dynamic generation
                            const fiscalYears = Array.isArray(settings) ? settings.map(setting => setting.fiscalYear) : [];
                            return fiscalYears;
                          })().map((year) => (
                            <FormControlLabel
                              key={year}
                              control={
                                <Checkbox
                                  checked={formData.restrictions?.allowedFiscalYears?.includes(year) || false}
                                  onChange={(e) => {
                                    const currentYears = formData.restrictions?.allowedFiscalYears || [];
                                    const newYears = e.target.checked
                                      ? [...currentYears, year]
                                      : currentYears.filter(y => y !== year);
                                    handleFormChange('restrictions', {
                                      ...formData.restrictions,
                                      allowedFiscalYears: newYears
                                    });
                                  }}
                                  size="small"
                                />
                              }
                              label={`FY ${year}`}
                            />
                          ))}
                        </Stack>
                      </Grid>

                      {/* Read Only Mode */}
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                          Access Mode
                        </Typography>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={formData.restrictions?.readOnlyMode || false}
                              onChange={(e) => handleFormChange('restrictions', {
                                ...formData.restrictions,
                                readOnlyMode: e.target.checked
                              })}
                              size="small"
                              color="warning"
                            />
                          }
                          label={
                            <Box>
                              <Typography variant="body2">Read-Only Mode</Typography>
                              <Typography variant="caption" color="text.secondary">
                                User can only view data, cannot make changes
                              </Typography>
                            </Box>
                          }
                        />
                      </Grid>

                      {/* Quick Actions for Restrictions */}
                      <Grid item xs={12}>
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => {
                              const activeSetting = Array.isArray(settings) ? settings.find(setting => setting.isActive) : null;
                              const activeFiscalYear = activeSetting ? activeSetting.fiscalYear : new Date().getFullYear().toString();
                              handleFormChange('restrictions', {
                                readOnlyMode: false,
                                allowedBudgetTypes: ['Initial', 'NEP', 'GAA'],
                                allowedFiscalYears: [activeFiscalYear]
                              });
                            }}
                          >
                            Reset to Current
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="success"
                            onClick={() => {
                              // Use all fiscal years from database settings for "Allow All"
                              const fiscalYears = Array.isArray(settings) ? settings.map(setting => setting.fiscalYear) : [];
                              handleFormChange('restrictions', {
                                readOnlyMode: false,
                                allowedBudgetTypes: ['Initial', 'NEP', 'GAA', 'Supplemental', 'Augmentation'],
                                allowedFiscalYears: fiscalYears
                              });
                            }}
                          >
                            Allow All
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="warning"
                            onClick={() => handleFormChange('restrictions', {
                              readOnlyMode: true,
                              allowedBudgetTypes: ['Initial'],
                              allowedFiscalYears: [new Date().getFullYear().toString()]
                            })}
                          >
                            Read-Only + Limited
                          </Button>
                        </Stack>
                      </Grid>
                    </Grid>
                  </AccordionDetails>
                </Accordion>
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
                                  {assignment.restrictions?.readOnlyMode && (
                                    <Typography variant="caption" display="block" sx={{ color: 'warning.main' }}>
                                      ⚠️ Read-Only Mode
                                    </Typography>
                                  )}
                                  {assignment.restrictions?.allowedBudgetTypes && (
                                    <Typography variant="caption" display="block">
                                      Budget Types: {assignment.restrictions.allowedBudgetTypes.join(', ')}
                                    </Typography>
                                  )}
                                  {assignment.restrictions?.allowedFiscalYears && (
                                    <Typography variant="caption" display="block">
                                      Fiscal Years: {assignment.restrictions.allowedFiscalYears.join(', ')}
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
                                {/* Show restrictions indicator if user has restrictions configured */}
                                {(() => {
                                  const activeSetting = Array.isArray(settings) ? settings.find(setting => setting.isActive) : null;
                                  const defaultFiscalYear = activeSetting ? activeSetting.fiscalYear : new Date().getFullYear().toString();
                                  const defaultRestrictions = {
                                    readOnlyMode: false,
                                    allowedBudgetTypes: ['Initial', 'NEP', 'GAA'],
                                    allowedFiscalYears: [defaultFiscalYear]
                                  };
                                  const userRestrictions = assignment.restrictions || {};
                                  const hasRestrictions = userRestrictions.readOnlyMode ||
                                    userRestrictions.allowedBudgetTypes?.length !== defaultRestrictions.allowedBudgetTypes.length ||
                                    userRestrictions.allowedFiscalYears?.length !== defaultRestrictions.allowedFiscalYears.length;
                                  return hasRestrictions && (
                                    <Tooltip title="Access restrictions configured">
                                      <Badge
                                        variant="dot"
                                        color="warning"
                                        sx={{
                                          '& .MuiBadge-dot': {
                                            width: 8,
                                            height: 8,
                                            borderRadius: '50%',
                                            ml: 0.5
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
                                onClick={() => {
                                  setEditingAssignment(assignment);
                                  // Extract only the necessary form fields from the assignment
                                  const reverseRoleMap = {
                                    divisionCreator: 'responsibilityCenterCreator',
                                    divisionApprover: 'responsibilityCenterApprover',
                                    departmentCreator: 'officeCreator',
                                    departmentConsolidator: 'officeConsolidator',
                                    departmentSubmission: 'officeSubmission',
                                    regionFinalVerifier: 'officeFinalVerifier',
                                    regionCreator: 'regionCreator'
                                  };
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
                                    assignmentLevel: reverseAssignmentLevelMap[assignment.assignmentLevel] || assignment.assignmentLevel,
                                    officeId: assignment.departmentId || '', // Map departmentId back to officeId for form
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
                                    },
                                    restrictions: assignment.restrictions || {
                                      readOnlyMode: false,
                                      allowedBudgetTypes: ['Initial', 'NEP', 'GAA'],
                                      allowedFiscalYears: (() => {
                                        const activeSetting = Array.isArray(settings) ? settings.find(setting => setting.isActive) : null;
                                        return activeSetting ? [activeSetting.fiscalYear] : [new Date().getFullYear().toString()];
                                      })()
                                    },
                                    // Convert legacy roles from server back to UI keys for checkbox map
                                    workflowRoles: (assignment.workflowRoles || []).reduce((acc, legacyRole) => {
                                      const uiKey = reverseRoleMap[legacyRole];
                                      if (uiKey) acc[uiKey] = true;
                                      return acc;
                                    }, getDefaultWorkflowRolesMap())
                                  };
                                  setFormData(formFields);
                                  setShowPermissions(true); // Show permissions when editing
                                  setShowRestrictions(true); // Show restrictions when editing
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