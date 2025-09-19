import React, { useState, useMemo } from 'react';
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
  DialogActions
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
  Info as InfoIcon
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
  { value: 'DIVISION', label: 'Division Level', icon: <BusinessIcon />, color: '#2196F3' },
  { value: 'DEPARTMENT', label: 'Department Level', icon: <DomainIcon />, color: '#FF9800' },
  { value: 'REGION', label: 'Region Level', icon: <LocationCityIcon />, color: '#4CAF50' },
  { value: 'FULL', label: 'Full Access (Admin)', icon: <HierarchyIcon />, color: '#9C27B0' },
  { value: 'OWN_ONLY', label: 'Own Records Only', icon: <PersonIcon />, color: '#757575' }
];

const WORKFLOW_ROLES = [
  { key: 'divisionCreator', label: 'Division Creator', description: 'Create proposals at division level' },
  { key: 'divisionApprover', label: 'Division Approver', description: 'Approve division proposals' },
  { key: 'departmentCreator', label: 'Department Creator', description: 'Create proposals at department level' },
  { key: 'departmentConsolidator', label: 'Department Consolidator', description: 'Consolidate division to department' },
  { key: 'departmentSubmission', label: 'Department Submission', description: 'Submit department proposals to region' },
  { key: 'regionCreator', label: 'Region Creator', description: 'Create proposals at region level' },
  { key: 'regionFinalVerifier', label: 'Region Final Verifier', description: 'Final verification/approval at region' }
];

const getDefaultWorkflowRolesMap = () =>
  WORKFLOW_ROLES.reduce((acc, r) => ({ ...acc, [r.key]: false }), {});

const HierarchicalUserAssignmentPage = () => {
  const { currentUser, jwtToken } = useUser();
  const queryClient = useQueryClient();

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Form state
  const [formData, setFormData] = useState({
    userId: '',
    userName: '',
    email: '',
    assignmentLevel: 'REGION',
    regionId: '',
    departmentId: '',
    divisionName: '',
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

  // UI state
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [showPermissions, setShowPermissions] = useState(false);
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
        const res = await api.get('/api/hierarchical-rbac/organization-structure');
        let data = res.data?.data || { availableUnits: { regions: [], departments: [], departmentsWithDivisions: [], divisions: [] }, mappings: [] };

        const regionsCount = data?.availableUnits?.regions?.length || 0;
        const departmentsCount = data?.availableUnits?.departments?.length || 0;

        if (regionsCount === 0 || departmentsCount === 0) {
          const [regionsRes, departmentsRes] = await Promise.allSettled([
            api.get('/api/regions'),
            api.get('/departments')
          ]);

          const fallbackRegions = regionsRes.status === 'fulfilled' ? (regionsRes.value.data || []) : [];
          const fallbackDepartments = departmentsRes.status === 'fulfilled' ? (departmentsRes.value.data || []) : [];

          const normalized = {
            availableUnits: {
              regions: (data.availableUnits.regions?.length ? data.availableUnits.regions : fallbackRegions.map(r => ({ id: r._id, name: r.Region }))) || [],
              departments: (data.availableUnits.departments?.length ? data.availableUnits.departments : fallbackDepartments.map(d => ({ id: d._id, name: d.Department }))) || [],
              departmentsWithDivisions: data.availableUnits.departmentsWithDivisions || []
            },
            mappings: data.mappings || []
          };

          return normalized;
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
            const res = await api.get('/api/hierarchical-rbac/assignments');
            return res.data?.assignments || [];
          } catch (adminErr) {
            const userId = deriveUserId();
            if (!userId) throw adminErr;
            const res = await api.get(`/api/hierarchical-rbac/assignments/${userId}`);
            return res.data?.assignment ? [res.data.assignment] : [];
          }
        }

        const userId = deriveUserId();
        if (!userId) {
          console.error('❌ Unable to derive userId for hierarchical assignment fetch. currentUser:', currentUser);
          return [];
        }
        const res = await api.get(`/api/hierarchical-rbac/assignments/${userId}`);
        return res.data?.assignment ? [res.data.assignment] : [];
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
      return api.post('/api/hierarchical-rbac/assignments', data, {
        headers: { Authorization: `Bearer ${jwtToken}` }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['hierarchical-assignments']);
      setSnackbar({
        open: true,
        message: 'Hierarchical assignment saved successfully',
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
      setSnackbar({ open: true, message: 'Workflow roles updated', severity: 'success' });
      closeRolesDialog();
    },
    onError: (error) => {
      console.error('Error updating workflow roles:', error);
      setSnackbar({ open: true, message: error.response?.data?.message || 'Failed to update workflow roles', severity: 'error' });
    }
  });

  // Helper: Check if user exists
  const checkUserExists = async (userId) => {
    try {
      const res = await api.get(`/api/users/${userId}`, {
        headers: { Authorization: `Bearer ${jwtToken}` }
      });
      return res.data.exists;
    } catch {
      return false;
    }
  };

  // Helper: Validate email format
  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // Helper functions
  const resetForm = () => {
    setFormData({
      userId: '',
      userName: '',
      email: '',
      assignmentLevel: 'REGION',
      regionId: '',
      departmentId: '',
      divisionName: '',
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
    setSelectedUser('');
  };

  // Helper: filter visible workflow roles by assignment level
  const getVisibleWorkflowRoles = (level) => {
    switch (level) {
      case 'DIVISION':
        return WORKFLOW_ROLES.filter(r => ['divisionCreator'].includes(r.key));
      case 'DEPARTMENT':
        return WORKFLOW_ROLES.filter(r => ['divisionApprover', 'departmentCreator', 'departmentConsolidator', 'departmentSubmission'].includes(r.key));
      case 'REGION':
        return WORKFLOW_ROLES.filter(r => ['regionCreator', 'regionFinalVerifier'].includes(r.key));
      case 'FULL':
        return WORKFLOW_ROLES;
      case 'OWN_ONLY':
      default:
        return [];
    }
  };

  // Memoized organizational data
  const filteredDepartments = useMemo(() => getFilteredDepartments(formData.regionId, organizationStructure), [formData.regionId, organizationStructure]);
  const availableDivisions = useMemo(() => getAvailableDivisions(formData.departmentId, formData.regionId, organizationStructure), [formData.departmentId, formData.regionId, organizationStructure]);
  const departmentsWithDivisions = useMemo(() => getDepartmentsWithDivisions(formData.regionId, organizationStructure), [formData.regionId, organizationStructure]);

  const handleFormChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
      ...(field === 'regionId' ? { departmentId: '', divisionName: '' } : {}),
      ...(field === 'departmentId' && prev.assignmentLevel === 'DIVISION' ? { divisionName: '' } : {})
    }));
  };

  const handlePermissionChange = (permission, value) => {
    setFormData(prev => ({
      ...prev,
      rolePermissions: {
        ...prev.rolePermissions,
        [permission]: value
      }
    }));
  };

  const handleWorkflowRoleChange = (roleKey, value) => {
    setFormData(prev => ({
      ...prev,
      workflowRoles: {
        ...prev.workflowRoles,
        [roleKey]: value
      },
      rolePermissions: roleKey === 'regionFinalVerifier' && value
        ? { ...prev.rolePermissions, ApproveProposals: true }
        : prev.rolePermissions
    }));
  };

  const handleEditAssignment = (assignment) => {
    setEditingAssignment(assignment);
    const roleMap = getDefaultWorkflowRolesMap();
    if (Array.isArray(assignment.workflowRoles)) {
      assignment.workflowRoles.forEach(r => { if (r in roleMap) roleMap[r] = true; });
    }
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
    setFormData({
      userId: assignment.userId,
      userName: assignment.userName,
      email: assignment.email,
      assignmentLevel: assignment.accessScope,
      regionId: assignment.regions?.[0]?._id || '',
      departmentId: assignment.departments?.[0]?._id || '',
      divisionName: assignment.divisions?.[0] || '',
      workflowRoles: roleMap,
      rolePermissions: { ...defaultPerms, ...(assignment.rolePermissions || {}) }
    });
    setSelectedUser(assignment.userId);
  };

  const openRolesDialog = (assignment) => {
    const map = getDefaultWorkflowRolesMap();
    if (Array.isArray(assignment.workflowRoles)) {
      assignment.workflowRoles.forEach(r => { if (r in map) map[r] = true; });
    }
    setRolesDialogMap(map);
    setRolesDialogUser(assignment);
    setRolesDialogOpen(true);
  };

  const closeRolesDialog = () => {
    setRolesDialogOpen(false);
    setRolesDialogUser(null);
  };

  const toggleDialogRole = (roleKey, checked) => {
    setRolesDialogMap(prev => ({ ...prev, [roleKey]: checked }));
  };

  const handleSubmit = async () => {
    if (!formData.userId || !formData.userName || !formData.email) {
      setSnackbar({
        open: true,
        message: 'Please fill in all required fields',
        severity: 'warning'
      });
      return;
    }

    if (!isValidEmail(formData.email)) {
      setSnackbar({
        open: true,
        message: 'Invalid email format',
        severity: 'warning'
      });
      return;
    }

    if (!editingAssignment) {
      const userExists = await checkUserExists(formData.userId);
      if (!userExists) {
        setSnackbar({
          open: true,
          message: 'User ID does not exist in the system',
          severity: 'warning'
        });
        return;
      }
    }

    if (formData.assignmentLevel === 'DIVISION') {
      if (!formData.regionId || !formData.departmentId || !formData.divisionName) {
        setSnackbar({
          open: true,
          message: 'Division assignment requires Region, Department, and Division',
          severity: 'warning'
        });
        return;
      }

      if (!selectedDepartmentHasDivisions(formData.departmentId, formData.regionId, organizationStructure)) {
        setSnackbar({
          open: true,
          message: 'Selected department does not have divisions',
          severity: 'warning'
        });
        return;
      }

      if (!availableDivisions.some(div => div.name === formData.divisionName)) {
        setSnackbar({
          open: true,
          message: 'Selected division does not exist in the chosen department',
          severity: 'warning'
        });
        return;
      }
    }

    if (formData.assignmentLevel === 'DEPARTMENT' && (!formData.regionId || !formData.departmentId)) {
      setSnackbar({
        open: true,
        message: 'Department assignment requires Region and Department',
        severity: 'warning'
      });
      return;
    }

    if (formData.assignmentLevel === 'REGION' && !formData.regionId) {
      setSnackbar({
        open: true,
        message: 'Region assignment requires Region',
        severity: 'warning'
      });
      return;
    }

    const selectedWorkflowRoles = Object.entries(formData.workflowRoles || {})
      .filter(([, v]) => v)
      .map(([k]) => k);

    const payload = {
      ...formData,
      rolePermissions: {
        ...formData.rolePermissions,
        ApproveProposals: selectedWorkflowRoles.includes('regionFinalVerifier')
          ? true
          : formData.rolePermissions.ApproveProposals
      }
    };
    delete payload.workflowRoles;
    if (selectedWorkflowRoles.length > 0) {
      payload.workflowRoles = selectedWorkflowRoles;
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

  const getAccessLevelInfo = (level) => {
    return ACCESS_LEVELS.find(al => al.value === level) || ACCESS_LEVELS[0];
  };

  const getConsolidationInfo = (level) => {
    switch (level) {
      case 'DIVISION':
        return 'Proposals consolidate to Department → Region';
      case 'DEPARTMENT':
        return 'Proposals consolidate to Region';
      case 'REGION':
        return 'Proposals saved directly to Region';
      case 'FULL':
        return 'Can access all organizational levels';
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

  // TODO: Add unit tests for handleSubmit, getVisibleWorkflowRoles, etc.
  // Example: test('handleSubmit shows warning for missing userId', () => { ... });

  if (!isAdmin) {
    return (
      <Box sx={{ p: 3 }}>
        <DashboardHeader title="My Hierarchical Access" />
        <Paper sx={{ p: 3, mt: 2 }}>
          {loadingAssignments ? (
            <CircularProgress />
          ) : assignments.length > 0 ? (
            <Grid container spacing={3}>
              {assignments.map((assignment) => (
                <Grid item xs={12} key={assignment.userId}>
                  <Card>
                    <CardHeader
                      avatar={getAccessLevelInfo(assignment.accessScope).icon}
                      title={assignment.userName}
                      subheader={`Access Level: ${getAccessLevelInfo(assignment.accessScope).label}`}
                    />
                    <CardContent>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {getConsolidationInfo(assignment.accessScope)}
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                        {assignment.regions?.map((region) => (
                          <Chip key={region._id} label={region.Region} color="primary" size="small" />
                        ))}
                        {assignment.departments?.map((dept) => (
                          <Chip key={dept._id} label={dept.Department} color="secondary" size="small" />
                        ))}
                        {assignment.divisions?.map((div) => (
                          <Chip key={div} label={div} color="default" size="small" />
                        ))}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          ) : (
            <Alert severity="info">
              No hierarchical assignment found. You have default access to your own records only.
            </Alert>
          )}
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <DashboardHeader title="Hierarchical User Assignments" />

      {process.env.NODE_ENV === 'development' && (
        <Card sx={{ mb: 3, bgcolor: '#f5f5f5' }}>
          <CardHeader title="🐛 Debug Information" />
          <CardContent>
            <Typography variant="body2">
              <strong>Loading Organization:</strong> {loadingOrganization ? 'Yes' : 'No'}<br />
              <strong>Organization Error:</strong> {organizationError ? organizationError.message : 'None'}<br />
              <strong>Regions Count:</strong> {organizationStructure?.availableUnits?.regions?.length || 0}<br />
              <strong>Departments Count:</strong> {organizationStructure?.availableUnits?.departments?.length || 0}<br />
              <strong>Departments with Divisions:</strong> {organizationStructure?.availableUnits?.departmentsWithDivisions?.length || 0}<br />
              <strong>Is Admin:</strong> {isAdmin ? 'Yes' : 'No'}<br />
              <strong>Current User Roles:</strong> {currentUser?.Roles ? JSON.stringify(currentUser.Roles) : 'None'}
            </Typography>
          </CardContent>
        </Card>
      )}

      <Card sx={{ mb: 3 }}>
        <CardHeader
          avatar={<HierarchyIcon />}
          title="Hierarchical RBAC System"
          subheader="Division → Department → Region Consolidation"
        />
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <BusinessIcon sx={{ mr: 1, color: '#2196F3' }} />
                <Typography variant="subtitle2">Division Level</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Proposals consolidate to Department records
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <DomainIcon sx={{ mr: 1, color: '#FF9800' }} />
                <Typography variant="subtitle2">Department Level</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Proposals consolidate to Region records
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <LocationCityIcon sx={{ mr: 1, color: '#4CAF50' }} />
                <Typography variant="subtitle2">Region Level</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Final destination for all proposals
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

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
                <FormControl fullWidth>
                  <InputLabel>Assignment Level</InputLabel>
                  <Select
                    value={formData.assignmentLevel}
                    onChange={(e) => handleFormChange('assignmentLevel', e.target.value)}
                    label="Assignment Level"
                    inputProps={{ 'aria-label': 'Assignment Level' }}
                  >
                    {ACCESS_LEVELS.map((level) => (
                      <MenuItem key={level.value} value={level.value}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          {level.icon}
                          <Typography sx={{ ml: 1 }}>{level.label}</Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {(formData.assignmentLevel === 'REGION' || formData.assignmentLevel === 'DEPARTMENT' || formData.assignmentLevel === 'DIVISION') && (
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Region</InputLabel>
                    <Select
                      value={formData.regionId}
                      onChange={(e) => handleFormChange('regionId', e.target.value)}
                      label="Region"
                      inputProps={{ 'aria-label': 'Region' }}
                    >
                      {organizationStructure?.availableUnits?.regions?.map((region) => (
                        <MenuItem key={region.id} value={region.id}>
                          {region.name} {region.code && `(${region.code})`}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}

              {(formData.assignmentLevel === 'DEPARTMENT' || formData.assignmentLevel === 'DIVISION') && (
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Department</InputLabel>
                    <Select
                      value={formData.departmentId}
                      onChange={(e) => handleFormChange('departmentId', e.target.value)}
                      label="Department"
                      inputProps={{ 'aria-label': 'Department' }}
                    >
                      {formData.assignmentLevel === 'DIVISION' ?
                        departmentsWithDivisions.map((department) => (
                          <MenuItem key={department.departmentId} value={department.departmentId}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                              <Typography>{department.departmentName}</Typography>
                              <Chip
                                label={`${department.divisions.length} divisions`}
                                size="small"
                                color="primary"
                                variant="outlined"
                              />
                            </Box>
                          </MenuItem>
                        )) :
                        filteredDepartments.map((department) => (
                          <MenuItem key={department.id} value={department.id}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                              <Typography>{department.name}</Typography>
                              {department.hasSubDivisions && (
                                <Chip
                                  label="Has divisions"
                                  size="small"
                                  color="secondary"
                                  variant="outlined"
                                />
                              )}
                            </Box>
                          </MenuItem>
                        ))
                      }
                    </Select>
                  </FormControl>

                  {formData.assignmentLevel === 'DIVISION' && (
                    <Alert severity="info" sx={{ mt: 1 }}>
                      <Typography variant="body2">
                        Only departments with divisions are available for Division level assignments.
                      </Typography>
                    </Alert>
                  )}
                </Grid>
              )}

              {formData.assignmentLevel === 'DIVISION' && (
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Division</InputLabel>
                    <Select
                      value={formData.divisionName}
                      onChange={(e) => handleFormChange('divisionName', e.target.value)}
                      label="Division"
                      disabled={!formData.departmentId}
                      inputProps={{ 'aria-label': 'Division' }}
                    >
                      {availableDivisions.map((division) => (
                        <MenuItem key={division.name} value={division.name}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            <Typography>{division.name}</Typography>
                            {division.code && (
                              <Chip
                                label={division.code}
                                size="small"
                                variant="outlined"
                              />
                            )}
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {!formData.departmentId && (
                    <Alert severity="warning" sx={{ mt: 1 }}>
                      <Typography variant="body2">
                        Please select a department first to see available divisions.
                      </Typography>
                    </Alert>
                  )}

                  {formData.departmentId && availableDivisions.length === 0 && (
                    <Alert severity="error" sx={{ mt: 1 }}>
                      <Typography variant="body2">
                        Selected department has no divisions. Please choose a different department.
                      </Typography>
                    </Alert>
                  )}
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
                <Accordion expanded={showPermissions} onChange={() => setShowPermissions(!showPermissions)}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography>Role Permissions</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={1}>
                      {Object.entries(formData.rolePermissions).map(([permission, value]) => (
                        <Grid item xs={12} sm={6} key={permission}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Checkbox
                              checked={value}
                              onChange={(e) => handlePermissionChange(permission, e.target.checked)}
                              inputProps={{ 'aria-label': permission }}
                            />
                            <Typography variant="body2">
                              {permission.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                            </Typography>
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  </AccordionDetails>
                </Accordion>
              </Grid>

              <Grid item xs={12}>
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography>Workflow Roles</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Alert severity="info" sx={{ mb: 2 }}>
                      Region Final Verifier typically requires approval permission. Selecting it will auto-enable approval.
                    </Alert>
                    <Grid container spacing={1}>
                      {getVisibleWorkflowRoles(formData.assignmentLevel).map(role => (
                        <Grid item xs={12} sm={6} key={role.key}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Tooltip title={role.description} arrow>
                              <Checkbox
                                checked={!!formData.workflowRoles?.[role.key]}
                                onChange={(e) => handleWorkflowRoleChange(role.key, e.target.checked)}
                                inputProps={{ 'aria-label': role.label }}
                              />
                            </Tooltip>
                            <Tooltip title={role.description} arrow>
                              <Box>
                                <Typography variant="body2" fontWeight={600}>{role.label}</Typography>
                                <Typography variant="caption" color="text.secondary">{role.description}</Typography>
                              </Box>
                            </Tooltip>
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  </AccordionDetails>
                </Accordion>
              </Grid>

              <Grid item xs={12}>
                <Stack direction="row" spacing={2}>
                  <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={createOrUpdateMutation.isLoading || !formData.userId || !formData.userName || !isValidEmail(formData.email)}
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
                      .map((assignment) => {
                        const levelInfo = getAccessLevelInfo(assignment.accessScope);
                        return (
                          <TableRow key={assignment.userId}>
                            <TableCell>
                              <Box>
                                <Typography variant="body2" fontWeight="bold">
                                  {assignment.userName}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {assignment.userId}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Chip
                                icon={levelInfo.icon}
                                label={levelInfo.label}
                                size="small"
                                sx={{ bgcolor: levelInfo.color, color: 'white' }}
                              />
                            </TableCell>
                            <TableCell>
                              <Stack spacing={0.5}>
                                {assignment.regions?.map((region) => (
                                  <Chip key={region._id} label={`R: ${region.Region}`} size="small" variant="outlined" />
                                ))}
                                {assignment.departments?.map((dept) => (
                                  <Chip key={dept._id} label={`D: ${dept.Department}`} size="small" variant="outlined" />
                                ))}
                                {assignment.divisions?.map((div) => (
                                  <Chip key={div} label={`Div: ${div}`} size="small" variant="outlined" />
                                ))}
                                {Array.isArray(assignment.workflowRoles) && assignment.workflowRoles.length > 0 && (
                                  <Box sx={{ mt: 0.5 }}>
                                    {assignment.workflowRoles.map((r) => {
                                      const friendly = WORKFLOW_ROLES.find(w => w.key === r)?.label || r;
                                      const desc = WORKFLOW_ROLES.find(w => w.key === r)?.description || '';
                                      return (
                                        <Tooltip key={r} title={desc} arrow>
                                          <Chip label={friendly} size="small" color="success" sx={{ mr: 0.5, mb: 0.5 }} />
                                        </Tooltip>
                                      );
                                    })}
                                  </Box>
                                )}
                              </Stack>
                            </TableCell>
                            <TableCell>
                              <Stack direction="row" spacing={1}>
                                <Tooltip title="Edit Assignment">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleEditAssignment(assignment)}
                                    aria-label="Edit Assignment"
                                  >
                                    <EditIcon />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Manage Workflow Roles">
                                  <IconButton
                                    size="small"
                                    onClick={() => openRolesDialog(assignment)}
                                    aria-label="Manage Workflow Roles"
                                  >
                                    <AssignmentIcon />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete Assignment">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleDelete(assignment.userId)}
                                    disabled={deleteMutation.isLoading}
                                    aria-label="Delete Assignment"
                                  >
                                    <DeleteIcon />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        );
                      })}
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

      <Dialog open={rolesDialogOpen} onClose={closeRolesDialog} fullWidth maxWidth="sm">
        <DialogTitle>Manage Workflow Roles{rolesDialogUser ? ` — ${rolesDialogUser.userName}` : ''}</DialogTitle>
        <DialogContent dividers>
          {rolesDialogUser ? (
            <Grid container spacing={1}>
              {getVisibleWorkflowRoles(rolesDialogUser.accessScope).map(role => (
                <Grid item xs={12} sm={6} key={role.key}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Tooltip title={role.description} arrow>
                      <Checkbox
                        checked={!!rolesDialogMap[role.key]}
                        onChange={(e) => toggleDialogRole(role.key, e.target.checked)}
                        inputProps={{ 'aria-label': role.label }}
                      />
                    </Tooltip>
                    <Tooltip title={role.description} arrow>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>{role.label}</Typography>
                        <Typography variant="caption" color="text.secondary">{role.description}</Typography>
                      </Box>
                    </Tooltip>
                  </Box>
                </Grid>
              ))}
            </Grid>
          ) : (
            <Typography variant="body2">No user selected.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeRolesDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (!rolesDialogUser) return;
              const selected = Object.entries(rolesDialogMap)
                .filter(([, v]) => v)
                .map(([k]) => k);
              updateWorkflowRolesMutation.mutate({ userId: rolesDialogUser.userId, workflowRoles: selected });
            }}
            disabled={updateWorkflowRolesMutation.isLoading}
            startIcon={updateWorkflowRolesMutation.isLoading ? <CircularProgress size={18} /> : <AssignmentIcon />}
          >
            Save Roles
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this assignment?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={confirmDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default HierarchicalUserAssignmentPage;
