import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Alert,
  CircularProgress,
  Tooltip,
  Tab,
  Tabs
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Save as SaveIcon,
  Edit as EditIcon,
  ContentCopy as CopyIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  CompareArrows as CompareIcon
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import api from '../config/api';
import { useRegion } from '../context/RegionContext';

const TierComparisonPage = () => {
  // State management
  const { selectedRegion } = useRegion();
  const [regions, setRegions] = useState([]);
  const [fiscalYears, setFiscalYears] = useState([]);
  const [selectedComparisonRegion, setSelectedComparisonRegion] = useState(selectedRegion || '');
  const [fiscalYear, setFiscalYear] = useState('');
  const [budgetType, setBudgetType] = useState('Initial');
  const [loading, setLoading] = useState(false);
  const [copying, setCopying] = useState(false);
  
  // Tier 1 and Tier 2 data
  const [tier1Data, setTier1Data] = useState(null);
  const [tier2Data, setTier2Data] = useState([]);
  const [tier1Totals, setTier1Totals] = useState(null);
  const [tier2Totals, setTier2Totals] = useState(null);
  
  // UI state
  const [activeTab, setActiveTab] = useState(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedTier2, setSelectedTier2] = useState(null);
  const [editFormData, setEditFormData] = useState({});

  // Fetch regions and fiscal years on component mount and when filters change
  useEffect(() => {
    fetchRegions();
    fetchFiscalYears();
  }, [budgetType]);

  // Fetch data when region or filters change
  useEffect(() => {
    if (selectedComparisonRegion && fiscalYear) {
      fetchTier1Data();
      fetchTier2Data();
    }
  }, [selectedComparisonRegion, fiscalYear, budgetType]);

  // Set first fiscal year as default when fiscal years are loaded
  useEffect(() => {
    if (fiscalYears.length > 0 && !fiscalYear) {
      setFiscalYear(fiscalYears[0]);
    }
  }, [fiscalYears]);

  // Update selected region when context changes
  useEffect(() => {
    if (selectedRegion && !selectedComparisonRegion) {
      setSelectedComparisonRegion(selectedRegion);
    }
  }, [selectedRegion]);

  // Fetch available regions
  const fetchRegions = async () => {
    try {
      const response = await api.get('/api/tier-comparison/regions', {
        params: { fiscalYear, budgetType }
      });
      if (response.data.success) {
        setRegions(response.data.data);
        // Auto-select first region if none selected
        if (response.data.data.length > 0 && !selectedComparisonRegion) {
          setSelectedComparisonRegion(response.data.data[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching regions:', error);
      toast.error('Failed to fetch regions');
    }
  };

  // Fetch available fiscal years
  const fetchFiscalYears = async () => {
    try {
      const response = await api.get('/api/tier-comparison/fiscal-years', {
        params: { region: selectedComparisonRegion, budgetType }
      });
      if (response.data.success) {
        setFiscalYears(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching fiscal years:', error);
      toast.error('Failed to fetch fiscal years');
    }
  };

  // Fetch Tier 1 finalized proposals
  const fetchTier1Data = async () => {
    if (!selectedComparisonRegion) return;
    
    setLoading(true);
    try {
      const response = await api.get('/api/tier-comparison/tier1/finalized', {
        params: {
          region: selectedComparisonRegion,
          fiscalYear,
          budgetType
        }
      });
      
      if (response.data.success) {
        setTier1Data(response.data.data);
        setTier1Totals(response.data.totals);
      }
    } catch (error) {
      console.error('Error fetching Tier 1 data:', error);
      toast.error('Failed to fetch Tier 1 proposals');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Tier 2 proposals
  const fetchTier2Data = async () => {
    if (!selectedComparisonRegion) return;
    
    setLoading(true);
    try {
      const response = await api.get('/api/tier-comparison/tier2', {
        params: {
          region: selectedComparisonRegion,
          fiscalYear,
          budgetType
        }
      });
      
      if (response.data.success) {
        setTier2Data(response.data.data);
        setTier2Totals(response.data.totals);
      }
    } catch (error) {
      console.error('Error fetching Tier 2 data:', error);
      toast.error('Failed to fetch Tier 2 proposals');
    } finally {
      setLoading(false);
    }
  };

  // Copy Tier 1 to Tier 2
  const handleCopyToTier2 = async () => {
    if (!selectedComparisonRegion) {
      toast.error('Please select a region first');
      return;
    }

    if (tier2Data.length > 0) {
      const confirm = window.confirm(
        'Tier 2 data already exists for this region. This action will be prevented. ' +
        'Please update existing Tier 2 records instead.'
      );
      if (!confirm) return;
    }

    setCopying(true);
    try {
      const response = await api.post('/api/tier-comparison/tier2/copy-from-tier1', {
        region: selectedComparisonRegion,
        fiscalYear,
        budgetType
      });

      if (response.data.success) {
        toast.success(`Successfully copied ${response.data.metadata.totalCreated} Tier 1 proposals to Tier 2`);
        fetchTier2Data();
      }
    } catch (error) {
      console.error('Error copying to Tier 2:', error);
      const message = error.response?.data?.message || 'Failed to copy Tier 1 to Tier 2';
      toast.error(message);
    } finally {
      setCopying(false);
    }
  };

  // Open edit dialog for Tier 2 proposal
  const handleEditTier2 = (tier2Proposal) => {
    setSelectedTier2(tier2Proposal);
    setEditFormData({
      title: tier2Proposal.title || '',
      description: tier2Proposal.description || '',
      tier2Amount: tier2Proposal.tier2Amount || 0,
      tier2Remarks: tier2Proposal.tier2Remarks || '',
      priority: tier2Proposal.priority || 'Medium',
      tier2Status: tier2Proposal.tier2Status || 'Draft'
    });
    setEditDialogOpen(true);
  };

  // Save Tier 2 edits
  const handleSaveTier2 = async () => {
    if (!selectedTier2) return;

    setLoading(true);
    try {
      const response = await api.put(
        `/api/tier-comparison/tier2/${selectedTier2._id}`,
        editFormData
      );

      if (response.data.success) {
        toast.success('Tier 2 proposal updated successfully');
        setEditDialogOpen(false);
        fetchTier2Data();
      }
    } catch (error) {
      console.error('Error updating Tier 2:', error);
      toast.error(error.response?.data?.message || 'Failed to update Tier 2 proposal');
    } finally {
      setLoading(false);
    }
  };

  // Delete Tier 2 proposal
  const handleDeleteTier2 = async (tier2Id) => {
    if (!window.confirm('Are you sure you want to delete this Tier 2 proposal?')) {
      return;
    }

    try {
      const response = await api.delete(`/api/tier-comparison/tier2/${tier2Id}`);
      if (response.data.success) {
        toast.success('Tier 2 proposal deleted successfully');
        fetchTier2Data();
      }
    } catch (error) {
      console.error('Error deleting Tier 2:', error);
      toast.error(error.response?.data?.message || 'Failed to delete Tier 2 proposal');
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  // Render Tier 1 data table
  const renderTier1Table = () => {
    if (!tier1Data || loading) {
      return (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
          <CircularProgress />
        </Box>
      );
    }

    const categories = [
      { key: 'personnel', label: 'Personnel Services' },
      { key: 'mooe', label: 'MOOE' },
      { key: 'capital', label: 'Capital Outlay' },
      { key: 'income', label: 'Income' },
      { key: 'budgetarySupport', label: 'Budgetary Support' }
    ];

    return (
      <TableContainer component={Paper} sx={{ maxHeight: '600px', overflow: 'auto' }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell><strong>Category</strong></TableCell>
              <TableCell><strong>Department</strong></TableCell>
              <TableCell><strong>Description</strong></TableCell>
              <TableCell align="right"><strong>Amount</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {categories.map(category => {
              const items = tier1Data[category.key] || [];
              return items.map((item, idx) => (
                <TableRow key={`${category.key}-${idx}`} hover>
                  <TableCell>{category.label}</TableCell>
                  <TableCell>{item.department || 'N/A'}</TableCell>
                  <TableCell>
                    {item.particulars || item.accountingTitle || item.description || item.positionTitle || 'N/A'}
                  </TableCell>
                  <TableCell align="right">
                    {formatCurrency(item.amount || item.cost || item.total || item.grandTotal || 0)}
                  </TableCell>
                  <TableCell>
                    <Chip label={item.status} color="success" size="small" />
                  </TableCell>
                </TableRow>
              ));
            })}
            {tier1Totals && (
              <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                <TableCell colSpan={3}><strong>Grand Total</strong></TableCell>
                <TableCell align="right">
                  <strong>{formatCurrency(tier1Totals.grandTotal)}</strong>
                </TableCell>
                <TableCell />
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  // Render Tier 2 data table
  const renderTier2Table = () => {
    if (loading) {
      return (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
          <CircularProgress />
        </Box>
      );
    }

    if (tier2Data.length === 0) {
      return (
        <Alert severity="info" sx={{ mt: 2 }}>
          No Tier 2 proposals found. Click "Copy Tier 1 to Tier 2" to create editable copies.
        </Alert>
      );
    }

    return (
      <TableContainer component={Paper} sx={{ maxHeight: '600px', overflow: 'auto' }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell><strong>Title</strong></TableCell>
              <TableCell align="right"><strong>Tier 1 Amount</strong></TableCell>
              <TableCell align="right"><strong>Tier 2 Amount</strong></TableCell>
              <TableCell align="right"><strong>Adjustment</strong></TableCell>
              <TableCell><strong>Priority</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell align="center"><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tier2Data.map((item) => (
              <TableRow key={item._id} hover>
                <TableCell>{item.title}</TableCell>
                <TableCell align="right">{formatCurrency(item.tier1Amount)}</TableCell>
                <TableCell align="right">{formatCurrency(item.tier2Amount)}</TableCell>
                <TableCell align="right">
                  <Typography 
                    color={item.adjustmentAmount >= 0 ? 'success.main' : 'error.main'}
                    fontWeight="bold"
                  >
                    {formatCurrency(item.adjustmentAmount)}
                    {item.adjustmentPercentage !== 0 && ` (${item.adjustmentPercentage}%)`}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip 
                    label={item.priority} 
                    color={
                      item.priority === 'Critical' ? 'error' : 
                      item.priority === 'High' ? 'warning' : 
                      'default'
                    } 
                    size="small" 
                  />
                </TableCell>
                <TableCell>
                  <Chip 
                    label={item.tier2Status} 
                    color={item.tier2Status === 'Finalized' ? 'success' : 'primary'} 
                    size="small" 
                  />
                </TableCell>
                <TableCell align="center">
                  <Tooltip title="Edit">
                    <IconButton 
                      size="small" 
                      color="primary" 
                      onClick={() => handleEditTier2(item)}
                      disabled={item.tier2Status === 'Finalized'}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton 
                      size="small" 
                      color="error" 
                      onClick={() => handleDeleteTier2(item._id)}
                      disabled={item.tier2Status === 'Finalized'}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {tier2Totals && (
              <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                <TableCell><strong>Totals</strong></TableCell>
                <TableCell align="right"><strong>{formatCurrency(tier2Totals.tier1Amount)}</strong></TableCell>
                <TableCell align="right"><strong>{formatCurrency(tier2Totals.tier2Amount)}</strong></TableCell>
                <TableCell align="right">
                  <strong 
                    style={{ 
                      color: tier2Totals.adjustmentAmount >= 0 ? 'green' : 'red' 
                    }}
                  >
                    {formatCurrency(tier2Totals.adjustmentAmount)}
                  </strong>
                </TableCell>
                <TableCell colSpan={3} />
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Tier Comparison: Tier 1 vs Tier 2
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Compare finalized Tier 1 proposals with editable Tier 2 proposals for budget planning and adjustments.
        </Typography>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Region</InputLabel>
                <Select
                  value={selectedComparisonRegion}
                  label="Region"
                  onChange={(e) => setSelectedComparisonRegion(e.target.value)}
                >
                  {regions.map((region) => (
                    <MenuItem key={region} value={region}>
                      {region}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Fiscal Year</InputLabel>
                <Select
                  value={fiscalYear}
                  label="Fiscal Year"
                  onChange={(e) => setFiscalYear(e.target.value)}
                >
                  {fiscalYears.map((year) => (
                    <MenuItem key={year} value={year}>
                      {year}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Budget Type</InputLabel>
                <Select
                  value={budgetType}
                  label="Budget Type"
                  onChange={(e) => setBudgetType(e.target.value)}
                >
                  <MenuItem value="Initial">Initial</MenuItem>
                  <MenuItem value="NEP">NEP</MenuItem>
                  <MenuItem value="GAA">GAA</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Box display="flex" gap={1}>
                <Button
                  variant="contained"
                  startIcon={<RefreshIcon />}
                  onClick={() => {
                    fetchTier1Data();
                    fetchTier2Data();
                  }}
                  disabled={!selectedComparisonRegion || loading}
                >
                  Refresh
                </Button>
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<CopyIcon />}
                  onClick={handleCopyToTier2}
                  disabled={!selectedComparisonRegion || copying || tier2Data.length > 0}
                >
                  Copy to Tier 2
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {tier1Totals && tier2Totals && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="primary">Tier 1 Total</Typography>
                <Typography variant="h4">{formatCurrency(tier1Totals.grandTotal)}</Typography>
                <Typography variant="caption" color="text.secondary">Finalized Proposals</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="secondary">Tier 2 Total</Typography>
                <Typography variant="h4">{formatCurrency(tier2Totals.tier2Amount)}</Typography>
                <Typography variant="caption" color="text.secondary">Adjusted Proposals</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" color={tier2Totals.adjustmentAmount >= 0 ? 'success.main' : 'error.main'}>
                  Adjustment
                </Typography>
                <Typography variant="h4" color={tier2Totals.adjustmentAmount >= 0 ? 'success.main' : 'error.main'}>
                  {formatCurrency(tier2Totals.adjustmentAmount)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Difference from Tier 1
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Comparison Panels */}
      <Card>
        <CardContent>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs value={activeTab} onChange={(e, val) => setActiveTab(val)}>
              <Tab label="Tier 1 (Read-Only)" icon={<VisibilityIcon />} iconPosition="start" />
              <Tab label="Tier 2 (Editable)" icon={<EditIcon />} iconPosition="start" />
            </Tabs>
          </Box>

          {activeTab === 0 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Tier 1 Finalized Proposals - Read Only
              </Typography>
              {renderTier1Table()}
            </Box>
          )}

          {activeTab === 1 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Tier 2 Proposals - Editable
              </Typography>
              {renderTier2Table()}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog 
        open={editDialogOpen} 
        onClose={() => setEditDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Edit Tier 2 Proposal</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="Title"
              value={editFormData.title || ''}
              onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
            />
            
            <TextField
              fullWidth
              label="Description"
              multiline
              rows={3}
              value={editFormData.description || ''}
              onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
            />

            <TextField
              fullWidth
              label="Tier 2 Amount"
              type="number"
              value={editFormData.tier2Amount || 0}
              onChange={(e) => setEditFormData({ ...editFormData, tier2Amount: parseFloat(e.target.value) || 0 })}
            />

            <TextField
              fullWidth
              label="Remarks / Justification"
              multiline
              rows={3}
              value={editFormData.tier2Remarks || ''}
              onChange={(e) => setEditFormData({ ...editFormData, tier2Remarks: e.target.value })}
            />

            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select
                value={editFormData.priority || 'Medium'}
                label="Priority"
                onChange={(e) => setEditFormData({ ...editFormData, priority: e.target.value })}
              >
                <MenuItem value="Low">Low</MenuItem>
                <MenuItem value="Medium">Medium</MenuItem>
                <MenuItem value="High">High</MenuItem>
                <MenuItem value="Critical">Critical</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={editFormData.tier2Status || 'Draft'}
                label="Status"
                onChange={(e) => setEditFormData({ ...editFormData, tier2Status: e.target.value })}
              >
                <MenuItem value="Draft">Draft</MenuItem>
                <MenuItem value="Under Review">Under Review</MenuItem>
                <MenuItem value="Approved">Approved</MenuItem>
                <MenuItem value="Finalized">Finalized</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleSaveTier2} 
            variant="contained" 
            startIcon={<SaveIcon />}
            disabled={loading}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TierComparisonPage;
