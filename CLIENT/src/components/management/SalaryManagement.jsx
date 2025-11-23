import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  Snackbar,
  Tabs,
  Tab,
  Card,
  CardContent,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Description as TemplateIcon,
  Grade as GradeIcon
} from '@mui/icons-material';
import {
  getCPSCTemplates,
  createCPSCTemplate,
  updateCPSCTemplate,
  deleteCPSCTemplate,
  getSalaryGradesByTemplate,
  createSalaryGradeWithTemplate,
  updateSalaryGrade,
  deleteSalaryGrade,
  getActiveSalaryGrades
} from '../../services/salaryService';

const CPSC_TEMPLATES = ['CPSC 1', 'CPSC 2', 'CPSC 3', 'CPSC 4', 'CPSC 5'];
const BUDGET_TYPES = ['Initial', 'NEP', 'GAA'];

const SalaryManagement = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [salaryGrades, setSalaryGrades] = useState([]);
  const [loading, setLoading] = useState(false);

  // Dialog states
  const [templateDialog, setTemplateDialog] = useState(false);
  const [salaryGradeDialog, setSalaryGradeDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editingSalaryGrade, setEditingSalaryGrade] = useState(null);

  // Form states
  const [templateForm, setTemplateForm] = useState({
    templateName: 'CPSC 1',
    templateCode: '',
    fiscalYear: new Date().getFullYear(),
    budgetType: 'PS',
    description: '',
    createdBy: 'system'
  });

  const [salaryGradeForm, setSalaryGradeForm] = useState({
    salary_grade: '',
    job_grade: '',
    steps: [],
    rates: {},
    cpscTemplate: '',
    templateName: 'CPSC 1',
    fiscalYear: new Date().getFullYear(),
    budgetType: 'PS',
    createdBy: 'system'
  });

  // Notification states
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  // Load data on component mount
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await getCPSCTemplates();
      setTemplates(response.templates || []);
    } catch (error) {
      showSnackbar('Error loading templates', 'error');
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSalaryGrades = async (templateId) => {
    try {
      setLoading(true);
      const response = await getSalaryGradesByTemplate(templateId);
      setSalaryGrades(response.salaryGrades || []);
    } catch (error) {
      showSnackbar('Error loading salary grades', 'error');
      console.error('Error loading salary grades:', error);
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // Template operations
  const handleCreateTemplate = async () => {
    try {
      await createCPSCTemplate(templateForm);
      showSnackbar('Template created successfully');
      setTemplateDialog(false);
      resetTemplateForm();
      loadTemplates();
    } catch (error) {
      showSnackbar('Error creating template', 'error');
      console.error('Error creating template:', error);
    }
  };

  const handleUpdateTemplate = async () => {
    try {
      await updateCPSCTemplate(editingTemplate._id, templateForm);
      showSnackbar('Template updated successfully');
      setTemplateDialog(false);
      setEditingTemplate(null);
      resetTemplateForm();
      loadTemplates();
    } catch (error) {
      showSnackbar('Error updating template', 'error');
      console.error('Error updating template:', error);
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!window.confirm('Are you sure you want to delete this template? This will also delete all associated salary grades.')) {
      return;
    }

    try {
      await deleteCPSCTemplate(templateId);
      showSnackbar('Template deleted successfully');
      loadTemplates();
      if (selectedTemplate && selectedTemplate._id === templateId) {
        setSelectedTemplate(null);
        setSalaryGrades([]);
      }
    } catch (error) {
      showSnackbar('Error deleting template', 'error');
      console.error('Error deleting template:', error);
    }
  };

  // Salary grade operations
  const handleCreateSalaryGrade = async () => {
    try {
      const formData = {
        ...salaryGradeForm,
        cpscTemplate: selectedTemplate._id
      };
      await createSalaryGradeWithTemplate(formData);
      showSnackbar('Salary grade created successfully');
      setSalaryGradeDialog(false);
      resetSalaryGradeForm();
      loadSalaryGrades(selectedTemplate._id);
    } catch (error) {
      showSnackbar('Error creating salary grade', 'error');
      console.error('Error creating salary grade:', error);
    }
  };

  const handleUpdateSalaryGrade = async () => {
    try {
      await updateSalaryGrade(editingSalaryGrade._id, salaryGradeForm);
      showSnackbar('Salary grade updated successfully');
      setSalaryGradeDialog(false);
      setEditingSalaryGrade(null);
      resetSalaryGradeForm();
      loadSalaryGrades(selectedTemplate._id);
    } catch (error) {
      showSnackbar('Error updating salary grade', 'error');
      console.error('Error updating salary grade:', error);
    }
  };

  const handleDeleteSalaryGrade = async (salaryGradeId) => {
    if (!window.confirm('Are you sure you want to delete this salary grade?')) {
      return;
    }

    try {
      await deleteSalaryGrade(salaryGradeId);
      showSnackbar('Salary grade deleted successfully');
      loadSalaryGrades(selectedTemplate._id);
    } catch (error) {
      showSnackbar('Error deleting salary grade', 'error');
      console.error('Error deleting salary grade:', error);
    }
  };

  // Form reset functions
  const resetTemplateForm = () => {
    setTemplateForm({
      templateName: 'CPSC 1',
      templateCode: '',
      fiscalYear: new Date().getFullYear(),
      budgetType: 'PS',
      description: '',
      createdBy: 'system'
    });
  };

  const resetSalaryGradeForm = () => {
    setSalaryGradeForm({
      salary_grade: '',
      job_grade: '',
      steps: [],
      rates: {},
      cpscTemplate: '',
      templateName: 'CPSC 1',
      fiscalYear: new Date().getFullYear(),
      budgetType: 'PS',
      createdBy: 'system'
    });
  };

  // Dialog open handlers
  const openTemplateDialog = (template = null) => {
    if (template) {
      setEditingTemplate(template);
      setTemplateForm({
        templateName: template.templateName,
        templateCode: template.templateCode,
        fiscalYear: template.fiscalYear,
        budgetType: template.budgetType,
        description: template.description || '',
        createdBy: template.createdBy
      });
    } else {
      resetTemplateForm();
    }
    setTemplateDialog(true);
  };

  const openSalaryGradeDialog = (salaryGrade = null) => {
    if (salaryGrade) {
      setEditingSalaryGrade(salaryGrade);
      setSalaryGradeForm({
        salary_grade: salaryGrade.salary_grade,
        job_grade: salaryGrade.job_grade,
        steps: salaryGrade.steps || [],
        rates: salaryGrade.rates || {},
        cpscTemplate: salaryGrade.cpscTemplate,
        templateName: salaryGrade.templateName,
        fiscalYear: salaryGrade.fiscalYear,
        budgetType: salaryGrade.budgetType,
        createdBy: salaryGrade.createdBy
      });
    } else {
      resetSalaryGradeForm();
    }
    setSalaryGradeDialog(true);
  };

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
    loadSalaryGrades(template._id);
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Salary Management System
      </Typography>

      <Paper sx={{ width: '100%', mb: 2 }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab icon={<TemplateIcon />} label="CPSC Templates" />
          <Tab icon={<GradeIcon />} label="Salary Grades" />
        </Tabs>

        {/* CPSC Templates Tab */}
        {activeTab === 0 && (
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">CPSC Templates</Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => openTemplateDialog()}
              >
                Add Template
              </Button>
            </Box>

            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Template Name</TableCell>
                    <TableCell>Fiscal Year</TableCell>
                    <TableCell>Budget Type</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Salary Grades Count</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow
                      key={template._id}
                      sx={{
                        cursor: 'pointer',
                        backgroundColor: selectedTemplate && selectedTemplate._id === template._id ? '#e3f2fd' : 'inherit'
                      }}
                      onClick={() => handleTemplateSelect(template)}
                    >
                      <TableCell>{template.templateName}</TableCell>
                      <TableCell>{template.fiscalYear}</TableCell>
                      <TableCell>
                        <Chip label={template.budgetType} size="small" />
                      </TableCell>
                      <TableCell>{template.description}</TableCell>
                      <TableCell>{template.salaryGrades?.length || 0}</TableCell>
                      <TableCell>
                        <Tooltip title="Edit Template">
                          <IconButton onClick={(e) => { e.stopPropagation(); openTemplateDialog(template); }}>
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Template">
                          <IconButton onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(template._id); }}>
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Salary Grades Tab */}
        {activeTab === 1 && (
          <Box sx={{ p: 3 }}>
            {selectedTemplate ? (
              <>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Box>
                    <Typography variant="h6">Salary Grades</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Template: {selectedTemplate.templateName} | Fiscal Year: {selectedTemplate.fiscalYear} | Budget Type: {selectedTemplate.budgetType}
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => openSalaryGradeDialog()}
                  >
                    Add Salary Grade
                  </Button>
                </Box>

                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Salary Grade</TableCell>
                        <TableCell>Job Grade</TableCell>
                        <TableCell>Steps</TableCell>
                        <TableCell>Rates</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {salaryGrades.map((grade) => (
                        <TableRow key={grade._id}>
                          <TableCell>{grade.salary_grade}</TableCell>
                          <TableCell>{grade.job_grade}</TableCell>
                          <TableCell>{grade.steps?.join(', ') || 'N/A'}</TableCell>
                          <TableCell>
                            {grade.rates ? Object.entries(grade.rates).map(([step, rate]) => (
                              <Chip key={step} label={`Step ${step}: ₱${rate}`} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                            )) : 'N/A'}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={grade.isActive ? 'Active' : 'Inactive'}
                              color={grade.isActive ? 'success' : 'default'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Tooltip title="Edit Salary Grade">
                              <IconButton onClick={() => openSalaryGradeDialog(grade)}>
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete Salary Grade">
                              <IconButton onClick={() => handleDeleteSalaryGrade(grade._id)}>
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="h6" color="text.secondary">
                  Please select a CPSC template to view salary grades
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </Paper>

      {/* Template Dialog */}
      <Dialog open={templateDialog} onClose={() => setTemplateDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingTemplate ? 'Edit CPSC Template' : 'Create CPSC Template'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Template Name</InputLabel>
                <Select
                  value={templateForm.templateName}
                  onChange={(e) => setTemplateForm({ ...templateForm, templateName: e.target.value })}
                  label="Template Name"
                >
                  {CPSC_TEMPLATES.map((template) => (
                    <MenuItem key={template} value={template}>
                      {template}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Template Code"
                value={templateForm.templateCode}
                onChange={(e) => setTemplateForm({ ...templateForm, templateCode: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Fiscal Year"
                type="number"
                value={templateForm.fiscalYear}
                onChange={(e) => setTemplateForm({ ...templateForm, fiscalYear: parseInt(e.target.value) })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Budget Type</InputLabel>
                <Select
                  value={templateForm.budgetType}
                  onChange={(e) => setTemplateForm({ ...templateForm, budgetType: e.target.value })}
                  label="Budget Type"
                >
                  {BUDGET_TYPES.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={3}
                value={templateForm.description}
                onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemplateDialog(false)}>Cancel</Button>
          <Button
            onClick={editingTemplate ? handleUpdateTemplate : handleCreateTemplate}
            variant="contained"
          >
            {editingTemplate ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Salary Grade Dialog */}
      <Dialog open={salaryGradeDialog} onClose={() => setSalaryGradeDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingSalaryGrade ? 'Edit Salary Grade' : 'Create Salary Grade'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Salary Grade"
                value={salaryGradeForm.salary_grade}
                onChange={(e) => setSalaryGradeForm({ ...salaryGradeForm, salary_grade: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Job Grade"
                value={salaryGradeForm.job_grade}
                onChange={(e) => setSalaryGradeForm({ ...salaryGradeForm, job_grade: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Steps (comma-separated)"
                value={salaryGradeForm.steps.join(', ')}
                onChange={(e) => {
                  const steps = e.target.value.split(',').map(s => s.trim()).filter(s => s);
                  setSalaryGradeForm({ ...salaryGradeForm, steps });
                }}
                helperText="Enter step numbers separated by commas (e.g., 1, 2, 3)"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Rates (JSON format)"
                multiline
                rows={4}
                value={JSON.stringify(salaryGradeForm.rates, null, 2)}
                onChange={(e) => {
                  try {
                    const rates = JSON.parse(e.target.value);
                    setSalaryGradeForm({ ...salaryGradeForm, rates });
                  } catch (error) {
                    // Invalid JSON, keep current value
                  }
                }}
                helperText='Enter rates as JSON object (e.g., {"1": 15000, "2": 16000})'
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSalaryGradeDialog(false)}>Cancel</Button>
          <Button
            onClick={editingSalaryGrade ? handleUpdateSalaryGrade : handleCreateSalaryGrade}
            variant="contained"
          >
            {editingSalaryGrade ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SalaryManagement;