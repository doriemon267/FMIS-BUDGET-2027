import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Alert,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../config/api';
import DashboardHeader from '../global/components/DashboardHeader';
import CustomSnackbar from '../global/components/CustomSnackbar';

function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`org-setup-tabpanel-${index}`}
      aria-labelledby={`org-setup-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const OrganizationSetupPage = () => {
  const [tabValue, setTabValue] = useState(0);
  const queryClient = useQueryClient();
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Dialog States
  const [regionDialog, setRegionDialog] = useState({ open: false, data: null });
  const [departmentDialog, setDepartmentDialog] = useState({ open: false, data: null });
  const [mappingDialog, setMappingDialog] = useState({ open: false, data: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null, type: '' });

  // Fetching Data
  const { data: regions = [], isLoading: loadingRegions } = useQuery({
    queryKey: ['regions'],
    queryFn: async () => {
      const res = await api.get('/api/regions');
      return res.data;
    }
  });

  const { data: departments = [], isLoading: loadingDepartments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const res = await api.get('/api/departments');
      return res.data.departments || res.data;
    }
  });

  const { data: mappings = [], isLoading: loadingMappings } = useQuery({
    queryKey: ['organization-mappings'],
    queryFn: async () => {
      const res = await api.get('/api/organization-structure');
      return res.data;
    }
  });

  // Mutations
  const saveRegion = useMutation({
    mutationFn: async (data) => {
      if (data._id) {
        return api.put(`/api/regions/${data._id}`, data);
      }
      return api.post('/api/regions', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['regions']);
      setRegionDialog({ open: false, data: null });
      setSnackbar({ open: true, message: 'Region saved successfully', severity: 'success' });
    },
    onError: (error) => {
      setSnackbar({ open: true, message: error.response?.data?.error || 'Failed to save region', severity: 'error' });
    }
  });

  const deleteRegion = useMutation({
    mutationFn: async (id) => api.delete(`/api/regions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['regions']);
      setDeleteDialog({ open: false, id: null, type: '' });
      setSnackbar({ open: true, message: 'Region deleted successfully', severity: 'success' });
    }
  });

  const saveDepartment = useMutation({
    mutationFn: async (data) => {
      if (data._id) {
        return api.put(`/api/departments/${data._id}`, data);
      }
      return api.post('/api/departments', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['departments']);
      setDepartmentDialog({ open: false, data: null });
      setSnackbar({ open: true, message: 'Department saved successfully', severity: 'success' });
    },
    onError: (error) => {
      setSnackbar({ open: true, message: error.response?.data?.error || 'Failed to save department', severity: 'error' });
    }
  });

  const deleteDepartment = useMutation({
    mutationFn: async (id) => api.delete(`/api/departments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['departments']);
      setDeleteDialog({ open: false, id: null, type: '' });
      setSnackbar({ open: true, message: 'Department deleted successfully', severity: 'success' });
    }
  });

  const saveMapping = useMutation({
    mutationFn: async (data) => api.post('/api/organization-structure', data),
    onSuccess: () => {
      queryClient.invalidateQueries(['organization-mappings']);
      setMappingDialog({ open: false, data: null });
      setSnackbar({ open: true, message: 'Mapping saved successfully', severity: 'success' });
    },
    onError: (error) => {
      setSnackbar({ open: true, message: error.response?.data?.error || 'Failed to save mapping', severity: 'error' });
    }
  });

  const deleteMapping = useMutation({
    mutationFn: async (id) => api.delete(`/api/organization-structure/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['organization-mappings']);
      setDeleteDialog({ open: false, id: null, type: '' });
      setSnackbar({ open: true, message: 'Mapping deleted successfully', severity: 'success' });
    }
  });

  const confirmDelete = () => {
    if (deleteDialog.type === 'region') deleteRegion.mutate(deleteDialog.id);
    if (deleteDialog.type === 'department') deleteDepartment.mutate(deleteDialog.id);
    if (deleteDialog.type === 'mapping') deleteMapping.mutate(deleteDialog.id);
  };

  // Region Dialog Component
  const RegionDialog = () => {
    const [formData, setFormData] = useState(regionDialog.data || { Region: '' });
    
    return (
      <Dialog open={regionDialog.open} onClose={() => setRegionDialog({ open: false, data: null })} fullWidth maxWidth="sm">
        <DialogTitle>{formData._id ? 'Edit Region' : 'Add Region'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Region Name"
            fullWidth
            variant="outlined"
            value={formData.Region}
            onChange={(e) => setFormData({ ...formData, Region: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRegionDialog({ open: false, data: null })}>Cancel</Button>
          <Button onClick={() => saveRegion.mutate(formData)} variant="contained" disabled={!formData.Region}>Save</Button>
        </DialogActions>
      </Dialog>
    );
  };

  // Department Dialog Component
  const DepartmentDialog = () => {
    const [formData, setFormData] = useState(departmentDialog.data || { Department: '', displayOrder: 999 });
    
    return (
      <Dialog open={departmentDialog.open} onClose={() => setDepartmentDialog({ open: false, data: null })} fullWidth maxWidth="sm">
        <DialogTitle>{formData._id ? 'Edit Department' : 'Add Department'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Department Name"
            fullWidth
            variant="outlined"
            value={formData.Department}
            onChange={(e) => setFormData({ ...formData, Department: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Display Order"
            type="number"
            fullWidth
            variant="outlined"
            value={formData.displayOrder}
            onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 999 })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDepartmentDialog({ open: false, data: null })}>Cancel</Button>
          <Button onClick={() => saveDepartment.mutate(formData)} variant="contained" disabled={!formData.Department}>Save</Button>
        </DialogActions>
      </Dialog>
    );
  };

  // Mapping Dialog Component
  const MappingDialog = () => {
    const [formData, setFormData] = useState(mappingDialog.data || {
      regionId: '',
      departmentId: '',
      departmentName: '',
      divisions: []
    });

    const addDivision = () => {
      setFormData({
        ...formData,
        divisions: [...formData.divisions, { name: '', code: '', isActive: true, sections: [] }]
      });
    };

    const updateDivision = (index, field, value) => {
      const newDivisions = [...formData.divisions];
      newDivisions[index][field] = value;
      setFormData({ ...formData, divisions: newDivisions });
    };

    const removeDivision = (index) => {
      const newDivisions = [...formData.divisions];
      newDivisions.splice(index, 1);
      setFormData({ ...formData, divisions: newDivisions });
    };

    const addSection = (divIndex) => {
      const newDivisions = [...formData.divisions];
      newDivisions[divIndex].sections.push({ name: '', code: '', isActive: true });
      setFormData({ ...formData, divisions: newDivisions });
    };

    const updateSection = (divIndex, secIndex, field, value) => {
      const newDivisions = [...formData.divisions];
      newDivisions[divIndex].sections[secIndex][field] = value;
      setFormData({ ...formData, divisions: newDivisions });
    };

    const removeSection = (divIndex, secIndex) => {
      const newDivisions = [...formData.divisions];
      newDivisions[divIndex].sections.splice(secIndex, 1);
      setFormData({ ...formData, divisions: newDivisions });
    };

    const handleSave = () => {
      const dept = departments.find(d => d._id === formData.departmentId);
      const payload = {
        ...formData,
        departmentName: dept ? dept.Department : formData.departmentName,
        hasSubDivisions: formData.divisions.length > 0
      };
      saveMapping.mutate(payload);
    };

    return (
      <Dialog open={mappingDialog.open} onClose={() => setMappingDialog({ open: false, data: null })} fullWidth maxWidth="md">
        <DialogTitle>{mappingDialog.data ? 'Edit Structure Mapping' : 'Add Structure Mapping'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 2, mb: 3, mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Region (Optional)</InputLabel>
              <Select
                value={formData.regionId || ''}
                label="Region (Optional)"
                onChange={(e) => setFormData({ ...formData, regionId: e.target.value })}
              >
                <MenuItem value=""><em>None (Central Office typically)</em></MenuItem>
                {regions.map((reg) => (
                  <MenuItem key={reg._id} value={reg._id}>{reg.Region}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Department</InputLabel>
              <Select
                value={formData.departmentId || ''}
                label="Department"
                onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
              >
                {departments.map((dept) => (
                  <MenuItem key={dept._id} value={dept._id}>{dept.Department}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Divisions & Units</Typography>
            <Button startIcon={<AddIcon />} variant="outlined" onClick={addDivision} size="small">Add Division</Button>
          </Box>

          {formData.divisions.map((div, divIndex) => (
            <Paper key={divIndex} sx={{ p: 2, mb: 2, border: '1px solid #e0e0e0' }} elevation={0}>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
                <TextField
                  label="Division Name"
                  size="small"
                  fullWidth
                  value={div.name}
                  onChange={(e) => updateDivision(divIndex, 'name', e.target.value)}
                />
                <TextField
                  label="Code (Optional)"
                  size="small"
                  sx={{ width: '150px' }}
                  value={div.code || ''}
                  onChange={(e) => updateDivision(divIndex, 'code', e.target.value)}
                />
                <IconButton color="error" onClick={() => removeDivision(divIndex)}>
                  <DeleteIcon />
                </IconButton>
              </Box>
              
              <Box sx={{ pl: 4, borderLeft: '2px solid #primary.main' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle2" color="textSecondary">Units / Sections</Typography>
                  <Button size="small" onClick={() => addSection(divIndex)}>Add Unit</Button>
                </Box>
                {div.sections && div.sections.map((sec, secIndex) => (
                  <Box key={secIndex} sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 1 }}>
                    <TextField
                      label="Unit/Section Name"
                      size="small"
                      fullWidth
                      value={sec.name}
                      onChange={(e) => updateSection(divIndex, secIndex, 'name', e.target.value)}
                    />
                    <IconButton color="error" size="small" onClick={() => removeSection(divIndex, secIndex)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            </Paper>
          ))}

        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMappingDialog({ open: false, data: null })}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={!formData.departmentId}>Save</Button>
        </DialogActions>
      </Dialog>
    );
  };

  return (
    <Box sx={{ flexGrow: 1, p: { xs: 2, md: 3 } }}>
      <DashboardHeader 
        title="Organization Structure Setup" 
        subtitle="Manage Regions, Departments, Divisions, and Units mappings"
      />

      <Paper sx={{ width: '100%', mb: 2 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
            <Tab label="Regions" />
            <Tab label="Departments" />
            <Tab label="Structure Mappings" />
          </Tabs>
        </Box>

        {/* REGIONS TAB */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setRegionDialog({ open: true, data: null })}>
              Add Region
            </Button>
          </Box>
          {loadingRegions ? <CircularProgress /> : (
            <TableContainer component={Paper} elevation={0} variant="outlined">
              <Table size="small">
                <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableRow>
                    <TableCell>Region Name</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {regions.map((row) => (
                    <TableRow key={row._id} hover>
                      <TableCell>{row.Region}</TableCell>
                      <TableCell align="right">
                        <IconButton color="primary" onClick={() => setRegionDialog({ open: true, data: row })}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton color="error" onClick={() => setDeleteDialog({ open: true, id: row._id, type: 'region' })}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {regions.length === 0 && (
                    <TableRow><TableCell colSpan={2} align="center">No regions found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>

        {/* DEPARTMENTS TAB */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDepartmentDialog({ open: true, data: null })}>
              Add Department
            </Button>
          </Box>
          {loadingDepartments ? <CircularProgress /> : (
            <TableContainer component={Paper} elevation={0} variant="outlined">
              <Table size="small">
                <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableRow>
                    <TableCell>Department Name</TableCell>
                    <TableCell>Display Order</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {departments.map((row) => (
                    <TableRow key={row._id} hover>
                      <TableCell>{row.Department}</TableCell>
                      <TableCell>{row.displayOrder}</TableCell>
                      <TableCell align="right">
                        <IconButton color="primary" onClick={() => setDepartmentDialog({ open: true, data: row })}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton color="error" onClick={() => setDeleteDialog({ open: true, id: row._id, type: 'department' })}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {departments.length === 0 && (
                    <TableRow><TableCell colSpan={3} align="center">No departments found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>

        {/* MAPPINGS TAB */}
        <TabPanel value={tabValue} index={2}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setMappingDialog({ open: true, data: null })}>
              Add Mapping
            </Button>
          </Box>
          {loadingMappings ? <CircularProgress /> : (
            <Box>
              {mappings.map((mapping) => (
                <Accordion key={mapping._id} sx={{ mb: 1, border: '1px solid #e0e0e0', boxShadow: 'none' }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ backgroundColor: '#fafafa' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                        {mapping.departmentName || mapping.departmentId?.Department}
                      </Typography>
                      {mapping.regionId && (
                        <Chip label={`Region: ${mapping.regionId.Region}`} size="small" color="primary" variant="outlined" />
                      )}
                      <Box sx={{ flexGrow: 1 }} />
                      <Typography variant="body2" color="textSecondary">
                        {mapping.divisions?.length || 0} Divisions
                      </Typography>
                      <IconButton size="small" color="primary" onClick={(e) => { e.stopPropagation(); setMappingDialog({ open: true, data: mapping }); }}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); setDeleteDialog({ open: true, id: mapping._id, type: 'mapping' }); }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    {mapping.divisions && mapping.divisions.length > 0 ? (
                      <Box sx={{ pl: 2 }}>
                        {mapping.divisions.map((div, i) => (
                          <Box key={i} sx={{ mb: 2 }}>
                            <Typography variant="subtitle2" color="primary">• {div.name}</Typography>
                            {div.sections && div.sections.length > 0 ? (
                              <Box sx={{ pl: 2, mt: 0.5, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                {div.sections.map((sec, j) => (
                                  <Chip key={j} label={sec.name} size="small" variant="outlined" />
                                ))}
                              </Box>
                            ) : (
                              <Typography variant="caption" color="textSecondary" sx={{ pl: 2 }}>No units defined</Typography>
                            )}
                          </Box>
                        ))}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="textSecondary">No divisions mapped to this department.</Typography>
                    )}
                  </AccordionDetails>
                </Accordion>
              ))}
              {mappings.length === 0 && (
                <Alert severity="info">No organization structure mappings found. Create one to get started.</Alert>
              )}
            </Box>
          )}
        </TabPanel>
      </Paper>

      {/* Dialogs */}
      {regionDialog.open && <RegionDialog />}
      {departmentDialog.open && <DepartmentDialog />}
      {mappingDialog.open && <MappingDialog />}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, id: null, type: '' })}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this {deleteDialog.type}? This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, id: null, type: '' })}>Cancel</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>

      <CustomSnackbar
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      />
    </Box>
  );
};

export default OrganizationSetupPage;
