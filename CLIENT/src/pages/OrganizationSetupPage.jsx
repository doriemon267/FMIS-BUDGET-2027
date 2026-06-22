import React, { useState, useMemo } from 'react';
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
  Chip,
  TablePagination,
  InputAdornment,
  Checkbox,
  ListItemText
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  ExpandMore as ExpandMoreIcon,
  Search as SearchIcon,
  Download as DownloadIcon
} from '@mui/icons-material';
import * as XLSX from 'xlsx';
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

  // Pagination & Search States
  const [regionPage, setRegionPage] = useState(0);
  const [regionRowsPerPage, setRegionRowsPerPage] = useState(10);
  const [regionSearch, setRegionSearch] = useState('');

  const [deptPage, setDeptPage] = useState(0);
  const [deptRowsPerPage, setDeptRowsPerPage] = useState(10);
  const [deptSearch, setDeptSearch] = useState('');

  const [mappingPage, setMappingPage] = useState(0);
  const [mappingRowsPerPage, setMappingRowsPerPage] = useState(10);
  const [mappingSearch, setMappingSearch] = useState('');

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

  // Filter and Paginate Regions
  const filteredRegions = useMemo(() => {
    return regions.filter(r => r.Region?.toLowerCase().includes(regionSearch.toLowerCase()));
  }, [regions, regionSearch]);
  
  const paginatedRegions = useMemo(() => {
    return filteredRegions.slice(regionPage * regionRowsPerPage, regionPage * regionRowsPerPage + regionRowsPerPage);
  }, [filteredRegions, regionPage, regionRowsPerPage]);

  // Filter and Paginate Departments
  const filteredDepartments = useMemo(() => {
    return departments.filter(d => d.Department?.toLowerCase().includes(deptSearch.toLowerCase()));
  }, [departments, deptSearch]);

  const paginatedDepartments = useMemo(() => {
    return filteredDepartments.slice(deptPage * deptRowsPerPage, deptPage * deptRowsPerPage + deptRowsPerPage);
  }, [filteredDepartments, deptPage, deptRowsPerPage]);

  // Filter and Paginate Mappings
  const filteredMappings = useMemo(() => {
    const searchLower = mappingSearch.toLowerCase();
    const filtered = mappings.filter(m => {
      const deptMatch = (m.departmentName || m.departmentId?.Department || '').toLowerCase().includes(searchLower);
      const regionMatch = m.regionIds ? m.regionIds.some(r => r.Region?.toLowerCase().includes(searchLower)) : false;
      return deptMatch || regionMatch;
    });

    // Sort by Region then Department
    return filtered.sort((a, b) => {
      const regA = a.regionIds && a.regionIds.length > 0 ? a.regionIds[0].Region : 'Central Office';
      const regB = b.regionIds && b.regionIds.length > 0 ? b.regionIds[0].Region : 'Central Office';
      if (regA !== regB) return regA.localeCompare(regB);
      
      const deptA = a.departmentName || a.departmentId?.Department || '';
      const deptB = b.departmentName || b.departmentId?.Department || '';
      return deptA.localeCompare(deptB);
    });
  }, [mappings, mappingSearch]);

  const paginatedMappings = useMemo(() => {
    return filteredMappings.slice(mappingPage * mappingRowsPerPage, mappingPage * mappingRowsPerPage + mappingRowsPerPage);
  }, [filteredMappings, mappingPage, mappingRowsPerPage]);


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

  const handleExportExcel = () => {
    let exportData = [];
    let filename = '';
    let sheetName = '';

    if (tabValue === 0) { // Regions
      exportData = filteredRegions.map(r => ({
        'Region Name': r.Region
      }));
      filename = `regions_${new Date().toISOString().split('T')[0]}.xlsx`;
      sheetName = 'Regions';
    } else if (tabValue === 1) { // Departments
      exportData = filteredDepartments.map(d => ({
        'Department Name': d.Department,
        'Display Order': d.displayOrder
      }));
      filename = `departments_${new Date().toISOString().split('T')[0]}.xlsx`;
      sheetName = 'Departments';
    } else if (tabValue === 2) { // Structure Mappings
      exportData = [];
      filteredMappings.forEach(m => {
        const region = m.regionIds && m.regionIds.length > 0 ? m.regionIds.map(r => r.Region).join(', ') : 'Central Office';
        const dept = m.departmentName || m.departmentId?.Department || '';
        
        if (!m.divisions || m.divisions.length === 0) {
          exportData.push({
            'Region': region,
            'Department': dept,
            'Division': 'No divisions mapped',
            'Units/Sections': ''
          });
        } else {
          m.divisions.forEach(div => {
            const units = div.sections?.map(s => s.name).join(', ') || 'No units defined';
            exportData.push({
              'Region': region,
              'Department': dept,
              'Division': div.name,
              'Units/Sections': units
            });
          });
        }
      });
      filename = `organization_structure_${new Date().toISOString().split('T')[0]}.xlsx`;
      sheetName = 'Organization Structure';
    }

    if (exportData.length === 0) {
      setSnackbar({ open: true, message: 'No data to export', severity: 'warning' });
      return;
    }

    try {
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(exportData);

      // Auto-size columns
      const colWidths = Object.keys(exportData[0]).map(key => ({
        wch: Math.max(key.length, 20)
      }));
      worksheet['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      XLSX.writeFile(workbook, filename);
      setSnackbar({ open: true, message: 'Excel file exported successfully', severity: 'success' });
    } catch (error) {
      console.error('Export error:', error);
      setSnackbar({ open: true, message: 'Failed to export Excel file', severity: 'error' });
    }
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
    const initData = mappingDialog.data ? { 
      ...mappingDialog.data, 
      regionIds: mappingDialog.data.regionIds ? mappingDialog.data.regionIds.map(r => r._id || r) : [] 
    } : {
      regionIds: [],
      departmentId: '',
      departmentName: '',
      divisions: []
    };
    const [formData, setFormData] = useState(initData);

    const addDivision = () => {
      setFormData({
        ...formData,
        divisions: [{ _tempId: Math.random().toString(36).substr(2, 9), name: '', code: '', isActive: true, sections: [] }, ...formData.divisions]
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
      newDivisions[divIndex].sections = [{ _tempId: Math.random().toString(36).substr(2, 9), name: '', code: '', isActive: true }, ...(newDivisions[divIndex].sections || [])];
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
              <InputLabel>Regions (Optional)</InputLabel>
              <Select
                multiple
                value={formData.regionIds || []}
                label="Regions (Optional)"
                onChange={(e) => {
                  const {
                    target: { value },
                  } = e;
                  setFormData({
                    ...formData,
                    regionIds: typeof value === 'string' ? value.split(',') : value,
                  });
                }}
                renderValue={(selected) => {
                  if (!selected || selected.length === 0) return <em>None (Central Office typically)</em>;
                  return selected.map(id => regions.find(r => r._id === id)?.Region).filter(Boolean).join(', ');
                }}
              >
                {regions.map((reg) => (
                  <MenuItem key={reg._id} value={reg._id}>
                    <Checkbox checked={(formData.regionIds || []).indexOf(reg._id) > -1} />
                    <ListItemText primary={reg.Region} />
                  </MenuItem>
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
            <Typography variant="h6" sx={{ fontWeight: 600 }}>Divisions & Units</Typography>
            <Button startIcon={<AddIcon />} variant="contained" color="primary" onClick={addDivision} size="small" sx={{ borderRadius: 2 }}>Add Division</Button>
          </Box>

          {formData.divisions.map((div, divIndex) => (
            <Paper key={div._id || div._tempId || divIndex} sx={{ p: 2.5, mb: 3, border: '1px solid #eaeaea', borderTop: '4px solid', borderTopColor: 'primary.main', borderRadius: 2, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', transition: 'all 0.3s ease', '&:hover': { boxShadow: '0 6px 25px rgba(0,0,0,0.06)' } }}>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', mb: 2 }}>
                <TextField
                  autoFocus={!!div._tempId}
                  label="Division Name"
                  size="small"
                  fullWidth
                  variant="outlined"
                  value={div.name}
                  onChange={(e) => updateDivision(divIndex, 'name', e.target.value)}
                  sx={{ backgroundColor: '#fff' }}
                />
                <TextField
                  label="Code (Optional)"
                  size="small"
                  variant="outlined"
                  sx={{ width: '180px', backgroundColor: '#fff' }}
                  value={div.code || ''}
                  onChange={(e) => updateDivision(divIndex, 'code', e.target.value)}
                />
                <IconButton color="error" onClick={() => removeDivision(divIndex)} sx={{ mt: 0.5, bgcolor: '#fff5f5', '&:hover': { bgcolor: '#ffebeb' } }}>
                  <DeleteIcon />
                </IconButton>
              </Box>
              
              <Box sx={{ pl: 4, py: 1.5, pr: 2, ml: 1, borderLeft: '2px solid #e0e0e0', backgroundColor: '#fafafa', borderRadius: '0 8px 8px 0' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle2" color="textSecondary" sx={{ fontWeight: 600, letterSpacing: 0.5 }}>UNITS / SECTIONS</Typography>
                  <Button size="small" startIcon={<AddIcon />} variant="outlined" sx={{ borderRadius: 2 }} onClick={() => addSection(divIndex)}>Add Unit</Button>
                </Box>
                {div.sections && div.sections.map((sec, secIndex) => (
                  <Box key={sec._id || sec._tempId || secIndex} sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 1.5, p: 1, backgroundColor: '#fff', border: '1px solid #eee', borderRadius: 1 }}>
                    <TextField
                      autoFocus={!!sec._tempId}
                      label="Unit/Section Name"
                      size="small"
                      fullWidth
                      variant="standard"
                      InputProps={{ disableUnderline: true, sx: { px: 1 } }}
                      value={sec.name}
                      onChange={(e) => updateSection(divIndex, secIndex, 'name', e.target.value)}
                    />
                    <IconButton color="error" size="small" onClick={() => removeSection(divIndex, secIndex)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
                {(!div.sections || div.sections.length === 0) && (
                  <Typography variant="body2" color="textSecondary" sx={{ fontStyle: 'italic', textAlign: 'center', py: 1 }}>
                    No units/sections added yet.
                  </Typography>
                )}
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
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <TextField
              size="small"
              placeholder="Search Regions..."
              value={regionSearch}
              onChange={(e) => { setRegionSearch(e.target.value); setRegionPage(0); }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              sx={{ width: 300 }}
            />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button 
                variant="outlined" 
                color="success" 
                startIcon={<DownloadIcon />} 
                onClick={handleExportExcel}
              >
                Export Excel
              </Button>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setRegionDialog({ open: true, data: null })}>
                Add Region
              </Button>
            </Box>
          </Box>
          {loadingRegions ? <CircularProgress /> : (
            <Paper elevation={0} variant="outlined">
              <TableContainer>
                <Table size="small">
                  <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
                    <TableRow>
                      <TableCell>Region Name</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedRegions.map((row) => (
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
                    {paginatedRegions.length === 0 && (
                      <TableRow><TableCell colSpan={2} align="center">No regions found</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                rowsPerPageOptions={[5, 10, 25]}
                component="div"
                count={filteredRegions.length}
                rowsPerPage={regionRowsPerPage}
                page={regionPage}
                onPageChange={(e, newPage) => setRegionPage(newPage)}
                onRowsPerPageChange={(e) => {
                  setRegionRowsPerPage(parseInt(e.target.value, 10));
                  setRegionPage(0);
                }}
              />
            </Paper>
          )}
        </TabPanel>

        {/* DEPARTMENTS TAB */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <TextField
              size="small"
              placeholder="Search Departments..."
              value={deptSearch}
              onChange={(e) => { setDeptSearch(e.target.value); setDeptPage(0); }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              sx={{ width: 300 }}
            />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button 
                variant="outlined" 
                color="success" 
                startIcon={<DownloadIcon />} 
                onClick={handleExportExcel}
              >
                Export Excel
              </Button>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDepartmentDialog({ open: true, data: null })}>
                Add Department
              </Button>
            </Box>
          </Box>
          {loadingDepartments ? <CircularProgress /> : (
            <Paper elevation={0} variant="outlined">
              <TableContainer>
                <Table size="small">
                  <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
                    <TableRow>
                      <TableCell>Department Name</TableCell>
                      <TableCell>Display Order</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedDepartments.map((row) => (
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
                    {paginatedDepartments.length === 0 && (
                      <TableRow><TableCell colSpan={3} align="center">No departments found</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                rowsPerPageOptions={[5, 10, 25]}
                component="div"
                count={filteredDepartments.length}
                rowsPerPage={deptRowsPerPage}
                page={deptPage}
                onPageChange={(e, newPage) => setDeptPage(newPage)}
                onRowsPerPageChange={(e) => {
                  setDeptRowsPerPage(parseInt(e.target.value, 10));
                  setDeptPage(0);
                }}
              />
            </Paper>
          )}
        </TabPanel>

        {/* MAPPINGS TAB */}
        <TabPanel value={tabValue} index={2}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <TextField
              size="small"
              placeholder="Search Mappings..."
              value={mappingSearch}
              onChange={(e) => { setMappingSearch(e.target.value); setMappingPage(0); }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              sx={{ width: 300 }}
            />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button 
                variant="outlined" 
                color="success" 
                startIcon={<DownloadIcon />} 
                onClick={handleExportExcel}
              >
                Export Excel
              </Button>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setMappingDialog({ open: true, data: null })}>
                Add Mapping
              </Button>
            </Box>
          </Box>
          {loadingMappings ? <CircularProgress /> : (
            <Box>
              {paginatedMappings.map((mapping) => (
                <Accordion key={mapping._id} sx={{ mb: 1, border: '1px solid #e0e0e0', boxShadow: 'none' }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ backgroundColor: '#fafafa' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                      <Box sx={{ minWidth: '180px', display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {mapping.regionIds && mapping.regionIds.length > 0 ? (
                          mapping.regionIds.map(reg => (
                            <Chip key={reg._id} label={reg.Region} size="small" color="primary" sx={{ fontWeight: 'bold' }} />
                          ))
                        ) : (
                          <Chip label="CENTRAL OFFICE" size="small" variant="outlined" />
                        )}
                      </Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                        {mapping.departmentName || mapping.departmentId?.Department}
                      </Typography>
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
              {paginatedMappings.length === 0 && (
                <Alert severity="info">No organization structure mappings found. Create one to get started.</Alert>
              )}
              
              <TablePagination
                rowsPerPageOptions={[5, 10, 25]}
                component="div"
                count={filteredMappings.length}
                rowsPerPage={mappingRowsPerPage}
                page={mappingPage}
                onPageChange={(e, newPage) => setMappingPage(newPage)}
                onRowsPerPageChange={(e) => {
                  setMappingRowsPerPage(parseInt(e.target.value, 10));
                  setMappingPage(0);
                }}
              />
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
