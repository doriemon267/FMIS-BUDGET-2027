import React, { useState, useEffect, useCallback } from 'react';
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
  AccordionDetails
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
  AccountTree as AccountTreeIcon,
  Info as InfoIcon
} from '@mui/icons-material';

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

const HierarchicalUserAssignmentPage = () => {
  const { currentUser, jwtToken } = useUser();
  const queryClient = useQueryClient();
  
  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  // Form state
  const [selectedUser, setSelectedUser] = useState('');
  const [formData, setFormData] = useState({
    userId: '',
    userName: '',
    email: '',
    assignmentLevel: 'REGION',
    regionId: '',
    departmentId: '',
    divisionName: '',
    rolePermissions: {
      canCreateProposals: true,
      canEditOwnProposals: true,
      canEditAllProposals: false,
      canDeleteProposals: false,
      canApproveProposals: false,
      canViewReports: true,
      canManageUsers: false,
      canManageSettings: false
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
  
  // Check if user is admin (align with server adminRoute allowed roles)
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
        const res = await api.get('/api/hierarchical-rbac/organization-structure');
        let data = res.data?.data || { availableUnits: { regions: [], departments: [], departmentsWithDivisions: [], divisions: [] }, mappings: [] };

        const regionsCount = data?.availableUnits?.regions?.length || 0;
        const departmentsCount = data?.availableUnits?.departments?.length || 0;

        // Fallback load if empty: fetch plain regions and departments endpoints
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
        console.error('Response data:', error.response?.data);
        console.error('Response status:', error.response?.status);
        console.error('Response headers:', error.response?.headers);
        
        // Show error to user
        setSnackbar({
          open: true,
          message: `Failed to load organization structure: ${error.response?.data?.message || error.message}`,
          severity: 'error'
        });
        
  return { availableUnits: { regions: [], departments: [], departmentsWithDivisions: [], divisions: [] }, mappings: [] };
      }
    },
    retry: 1, // Only retry once
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch hierarchical assignments
  const { data: assignments = [], isLoading: loadingAssignments } = useQuery({
    queryKey: ['hierarchical-assignments'],
    queryFn: async () => {
      try {
        const deriveUserId = () => currentUser?.Username?.[0] || currentUser?.Id || currentUser?.id || currentUser?.userId;

        if (isAdmin) {
          try {
            const res = await api.get('/api/hierarchical-rbac/assignments');
            return res.data?.assignments || [];
          } catch (adminErr) {
            // Fallback: fetch own assignment if admin list fails due to role drift
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
        const status = error?.response?.status;
        const dataMsg = error?.response?.data?.message;
        console.error('Error fetching hierarchical assignments:', status, dataMsg || error.message);
        return [];
      }
    }
  });

  // Mutation for creating/updating assignments
  const createOrUpdateMutation = useMutation({
    mutationFn: async (data) => {
      return api.post('/api/hierarchical-rbac/assignments', data, {
        headers: { Authorization: `Bearer ${jwtToken}` }
      });
    },
    onSuccess: (response) => {
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
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Failed to save hierarchical assignment',
        severity: 'error'
      });
    }
  });

  // Mutation for deleting assignments
  const deleteMutation = useMutation({
    mutationFn: async (userId) => {
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
        message: 'Failed to delete hierarchical assignment',
        severity: 'error'
      });
    }
  });

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
      rolePermissions: {
        canCreateProposals: true,
        canEditOwnProposals: true,
        canEditAllProposals: false,
        canDeleteProposals: false,
        canApproveProposals: false,
        canViewReports: true,
        canManageUsers: false,
        canManageSettings: false
      }
    });
    setEditingAssignment(null);
    setSelectedUser('');
  };

  // Get available divisions for selected department
  const getAvailableDivisions = () => {
    if (!formData.departmentId || !organizationStructure?.availableUnits?.departmentsWithDivisions) {
      return [];
    }
    
    // Filter departmentsWithDivisions by selected region if applicable
    let deptsWithDivisions = organizationStructure.availableUnits.departmentsWithDivisions;
    if (formData.regionId) {
      deptsWithDivisions = deptsWithDivisions.filter(dept => dept.regionId === formData.regionId);
    }
    
    const department = deptsWithDivisions.find(
      dept => dept.departmentId === formData.departmentId
    );
    
    return department ? department.divisions : [];
  };

  // Get departments that have divisions (for Division level assignments)
  const getDepartmentsWithDivisions = () => {
    if (!organizationStructure?.availableUnits?.departmentsWithDivisions) {
      return [];
    }
    
    let depts = organizationStructure.availableUnits.departmentsWithDivisions;
    
    // Filter by selected region if one is selected
    if (formData.regionId) {
      depts = depts.filter(dept => dept.regionId === formData.regionId);
    }

    return depts;
  };

  // Get departments filtered by selected region (for Department level assignments)
  const getFilteredDepartments = () => {
    if (!organizationStructure?.availableUnits?.departments) {
      return [];
    }
    
    let depts = organizationStructure.availableUnits.departments;
    
    // Filter by selected region if one is selected
    if (formData.regionId) {
      // Get department IDs from mappings that match the selected region
      const regionMappings = organizationStructure.mappings?.filter(mapping => 
        mapping.regionId === formData.regionId
      ) || [];
      const departmentIds = regionMappings.map(mapping => mapping.departmentId);
      
      depts = depts.filter(dept => departmentIds.includes(dept.id));
    }

    return depts;
  };

  // Check if selected department has divisions
  const selectedDepartmentHasDivisions = () => {
    if (!formData.departmentId || !organizationStructure?.availableUnits?.departmentsWithDivisions) {
      return false;
    }
    
    // Filter departmentsWithDivisions by selected region if applicable
    let deptsWithDivisions = organizationStructure.availableUnits.departmentsWithDivisions;
    if (formData.regionId) {
      deptsWithDivisions = deptsWithDivisions.filter(dept => dept.regionId === formData.regionId);
    }
    
    const department = deptsWithDivisions.find(
      dept => dept.departmentId === formData.departmentId
    );
    
    return department ? (department.divisions && department.divisions.length > 0) : false;
  };

  const handleFormChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
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

  const handleEditAssignment = (assignment) => {
    setEditingAssignment(assignment);
    setFormData({
      userId: assignment.userId,
      userName: assignment.userName,
      email: assignment.email,
      assignmentLevel: assignment.accessScope,
      regionId: assignment.regions?.[0]?._id || '',
      departmentId: assignment.departments?.[0]?._id || '',
      divisionName: assignment.divisions?.[0] || '',
      rolePermissions: assignment.rolePermissions || {}
    });
    setSelectedUser(assignment.userId);
  };

  const handleSubmit = () => {
    if (!formData.userId || !formData.userName || !formData.email) {
      setSnackbar({
        open: true,
        message: 'Please fill in all required fields',
        severity: 'warning'
      });
      return;
    }

    // Validate required fields based on assignment level
    if (formData.assignmentLevel === 'DIVISION') {
      if (!formData.regionId || !formData.departmentId || !formData.divisionName) {
        setSnackbar({
          open: true,
          message: 'Division assignment requires Region, Department, and Division',
          severity: 'warning'
        });
        return;
      }
      
      // Validate that selected department has divisions
      if (!selectedDepartmentHasDivisions()) {
        setSnackbar({
          open: true,
          message: 'Selected department does not have divisions. Please choose a department with divisions.',
          severity: 'warning'
        });
        return;
      }
      
      // Validate that selected division exists in the department
      const availableDivisions = getAvailableDivisions();
      if (!availableDivisions.some(div => div.name === formData.divisionName)) {
        setSnackbar({
          open: true,
          message: 'Selected division does not exist in the chosen department.',
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
    createOrUpdateMutation.mutate(formData);
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
      
      {/* Debug Information */}
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

      {/* Hierarchical System Overview */}
      <Card sx={{ mb: 3 }}>
        <CardHeader
          avatar={<AccountTreeIcon />}
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
        {/* Assignment Form */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              {editingAssignment ? 'Edit' : 'Create'} Hierarchical Assignment
            </Typography>
            
            <Grid container spacing={2}>
              {/* User Information */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="User ID"
                  value={formData.userId}
                  onChange={(e) => handleFormChange('userId', e.target.value)}
                  disabled={!!editingAssignment}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="User Name"
                  value={formData.userName}
                  onChange={(e) => handleFormChange('userName', e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleFormChange('email', e.target.value)}
                />
              </Grid>

              {/* Assignment Level */}
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Assignment Level</InputLabel>
                  <Select
                    value={formData.assignmentLevel}
                    onChange={(e) => handleFormChange('assignmentLevel', e.target.value)}
                    label="Assignment Level"
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

              {/* Organizational Units */}
              {(formData.assignmentLevel === 'REGION' || formData.assignmentLevel === 'DEPARTMENT' || formData.assignmentLevel === 'DIVISION') && (
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Region</InputLabel>
                    <Select
                      value={formData.regionId}
                      onChange={(e) => {
                        handleFormChange('regionId', e.target.value);
                        // Reset department and division when region changes
                        handleFormChange('departmentId', '');
                        if (formData.assignmentLevel === 'DIVISION') {
                          handleFormChange('divisionName', '');
                        }
                      }}
                      label="Region"
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
                      onChange={(e) => {
                        handleFormChange('departmentId', e.target.value);
                        // Reset division when department changes
                        if (formData.assignmentLevel === 'DIVISION') {
                          handleFormChange('divisionName', '');
                        }
                      }}
                      label="Department"
                    >
                      {/* For Division level, only show departments that have divisions */}
                      {formData.assignmentLevel === 'DIVISION' ? 
                        getDepartmentsWithDivisions().map((department) => (
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
                        getFilteredDepartments().map((department) => (
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
                  
                  {/* Show additional info for Division level */}
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
                    >
                      {getAvailableDivisions().map((division) => (
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
                  
                  {formData.departmentId && getAvailableDivisions().length === 0 && (
                    <Alert severity="error" sx={{ mt: 1 }}>
                      <Typography variant="body2">
                        Selected department has no divisions. Please choose a different department.
                      </Typography>
                    </Alert>
                  )}
                </Grid>
              )}

              {/* Consolidation Info */}
              <Grid item xs={12}>
                <Alert severity="info" icon={<InfoIcon />}>
                  <Typography variant="subtitle2">Consolidation Behavior:</Typography>
                  <Typography variant="body2">
                    {getConsolidationInfo(formData.assignmentLevel)}
                  </Typography>
                </Alert>
              </Grid>

              {/* Role Permissions */}
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

              {/* Action Buttons */}
              <Grid item xs={12}>
                <Stack direction="row" spacing={2}>
                  <Button
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

        {/* Assignments List */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Current Assignments ({assignments.length})
            </Typography>
            
            {loadingAssignments ? (
              <CircularProgress />
            ) : (
              <TableContainer>
                <Table size="small">
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
                              </Stack>
                            </TableCell>
                            <TableCell>
                              <Stack direction="row" spacing={1}>
                                <Tooltip title="Edit Assignment">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleEditAssignment(assignment)}
                                  >
                                    <EditIcon />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete Assignment">
                                  <IconButton
                                    size="small"
                                    onClick={() => deleteMutation.mutate(assignment.userId)}
                                    disabled={deleteMutation.isLoading}
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
    </Box>
  );
};

export default HierarchicalUserAssignmentPage;
