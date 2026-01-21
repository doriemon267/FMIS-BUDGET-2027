import React, { useState, useMemo } from 'react';
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
  Tabs,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Save as SaveIcon,
  Edit as EditIcon,
  ContentCopy as CopyIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  CompareArrows as CompareIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../config/api';
import { useRegion } from '../context/RegionContext';

// Helper to format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(amount || 0);
};

// API Functions for react-query
const fetchRegions = async () => {
  const { data } = await api.get('/api/tier-comparison/regions');
  if (data.success) {
    return data.data;
  }
  throw new Error('Failed to fetch regions');
};

const fetchFiscalYears = async (region) => {
  if (!region) return [];
  const { data } = await api.get('/api/tier-comparison/fiscal-years', { params: { region } });
  if (data.success) {
    return data.data;
  }
  throw new Error('Failed to fetch fiscal years');
};

const fetchTier1Data = async (region, fiscalYear) => {
  if (!region || !fiscalYear) return null;
  const { data } = await api.get('/api/tier-comparison/tier1/finalized', { params: { region, fiscalYear } });
  if (data.success) {
    return data;
  }
  throw new Error('Failed to fetch Tier 1 data');
};

const fetchTier2Data = async (region, fiscalYear) => {
  if (!region || !fiscalYear) return [];
  const { data } = await api.get('/api/tier-comparison/tier2', { params: { region, fiscalYear } });
  if (data.success) {
    return data;
  }
  throw new Error('Failed to fetch Tier 2 data');
};

const TierComparisonPage = () => {
  const { selectedRegion: contextRegion } = useRegion();
  const queryClient = useQueryClient();

  // State management for filters
  const [selectedComparisonRegion, setSelectedComparisonRegion] = useState(contextRegion || '');
  const [fiscalYear, setFiscalYear] = useState('');
  
  // UI state
  const [activeTab, setActiveTab] = useState(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedTier2, setSelectedTier2] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [displayAmount, setDisplayAmount] = useState('');

  // Queries
  const { data: regions = [], isLoading: isLoadingRegions } = useQuery({
    queryKey: ['tierRegions'],
    queryFn: fetchRegions,
    onSuccess: (data) => {
      if (data.length > 0 && !selectedComparisonRegion) {
        setSelectedComparisonRegion(data[0]);
      }
    }
  });

  const { data: fiscalYears = [], isLoading: isLoadingFiscalYears } = useQuery({
    queryKey: ['tierFiscalYears', selectedComparisonRegion],
    queryFn: () => fetchFiscalYears(selectedComparisonRegion),
    enabled: !!selectedComparisonRegion,
    onSuccess: (data) => {
      if (data.length > 0 && !fiscalYear) {
        setFiscalYear(data[0]);
      }
    }
  });

  const { data: tier1, isLoading: isLoadingTier1, isFetching: isFetchingTier1 } = useQuery({
    queryKey: ['tier1Data', selectedComparisonRegion, fiscalYear],
    queryFn: () => fetchTier1Data(selectedComparisonRegion, fiscalYear),
    enabled: !!selectedComparisonRegion && !!fiscalYear,
  });
  const tier1Data = tier1?.data;
  const tier1Totals = tier1?.totals;

  const { data: tier2, isLoading: isLoadingTier2, isFetching: isFetchingTier2 } = useQuery({
    queryKey: ['tier2Data', selectedComparisonRegion, fiscalYear],
    queryFn: () => fetchTier2Data(selectedComparisonRegion, fiscalYear),
    enabled: !!selectedComparisonRegion && !!fiscalYear,
  });
  const tier2Data = tier2?.data || [];
  const tier2Totals = tier2?.totals;
  
  const loading = isFetchingTier1 || isFetchingTier2;

  // Mutations
  const copyToTier2Mutation = useMutation({
    mutationFn: () => api.post('/api/tier-comparison/tier2/copy-from-tier1', { region: selectedComparisonRegion, fiscalYear }),
    onSuccess: (response) => {
      toast.success(`Successfully copied ${response.data.metadata.totalCreated} Tier 1 proposals to Tier 2`);
      queryClient.invalidateQueries(['tier2Data', selectedComparisonRegion, fiscalYear]);
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Failed to copy Tier 1 to Tier 2';
      toast.error(message);
    }
  });

  const updateTier2Mutation = useMutation({
    mutationFn: (updatedData) => api.put(`/api/tier-comparison/tier2/${selectedTier2._id}`, updatedData),
    onSuccess: () => {
      toast.success('Tier 2 proposal updated successfully');
      setEditDialogOpen(false);
      queryClient.invalidateQueries(['tier2Data', selectedComparisonRegion, fiscalYear]);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update Tier 2 proposal');
    }
  });

  const deleteTier2Mutation = useMutation({
    mutationFn: (tier2Id) => api.delete(`/api/tier-comparison/tier2/${tier2Id}`),
    onSuccess: () => {
      toast.success('Tier 2 proposal deleted successfully');
      queryClient.invalidateQueries(['tier2Data', selectedComparisonRegion, fiscalYear]);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete Tier 2 proposal');
    }
  });

  const handleCopyToTier2 = () => {
    if (tier2Data.length > 0) {
      if (!window.confirm('Tier 2 data already exists. This will be prevented. Please update existing records.')) {
        return;
      }
    }
    copyToTier2Mutation.mutate();
  };
  
  const handleSaveTier2 = () => {
    if (!selectedTier2) return;
    updateTier2Mutation.mutate(editFormData);
  };

  const handleDeleteTier2 = (tier2Id) => {
    if (window.confirm('Are you sure you want to delete this Tier 2 proposal?')) {
      deleteTier2Mutation.mutate(tier2Id);
    }
  };

  const handleEditTier2 = (tier2Proposal) => {
    setSelectedTier2(tier2Proposal);
    const amount = Number(tier2Proposal.tier2Amount || 0).toFixed(2);
    setEditFormData({
      title: tier2Proposal.title || '',
      description: tier2Proposal.description || '',
      tier2Amount: parseFloat(amount),
      tier2Remarks: tier2Proposal.tier2Remarks || '',
      priority: tier2Proposal.priority || 'Medium',
      tier2Status: tier2Proposal.tier2Status || 'Draft'
    });
    setDisplayAmount(Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setEditDialogOpen(true);
  };
  
  const renderTier1Table = () => {
    if (!tier1Data || loading) {
      return (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
          <CircularProgress />
        </Box>
      );
    }

    const incomeCategories = [
      { label: 'IRRIGATION SERVICE FEES', filter: (item) => item.accountingTitle?.toLowerCase().includes('irrigation') },
      { label: 'RENT INCOME', filter: (item) => item.accountingTitle?.toLowerCase().includes('rent') },
      { label: 'WATER SERVICE FEE', filter: (item) => item.accountingTitle?.toLowerCase().includes('water') },
      { label: 'MISCELLANEOUS INCOME', filter: (item) => item.accountingTitle?.toLowerCase().includes('misc') }
    ];

    return (
      <Box>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: '#1976d2' }}>
          A. SOURCES OF FUNDS
        </Typography>
        <TableContainer component={Paper} sx={{ mb: 3, boxShadow: 2, borderRadius: 2, border: '1px solid #e0e0e0' }}>
            <Table size="medium">
                <TableHead>
                    <TableRow sx={{ backgroundColor: '#1976d2' }}>
                        <TableCell sx={{ fontWeight: 'bold', color: 'white', width: '25%', fontSize: '0.95rem' }}>Particulars</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold', color: 'white', width: '15%', fontSize: '0.95rem' }}>PROJECTED CORPORATE INCOME<br />(a)</TableCell>
                        <TableCell colSpan={3} align="center" sx={{ fontWeight: 'bold', color: 'white', width: '30%', fontSize: '0.95rem' }}>PROJECTED SUBSIDY</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold', color: 'white', width: '15%', fontSize: '0.95rem' }}>PROPOSED BUDGET<br />(e = a + d)</TableCell>
                    </TableRow>
                    <TableRow sx={{ backgroundColor: '#1976d2' }}>
                        <TableCell sx={{color: 'white'}}></TableCell>
                        <TableCell sx={{color: 'white'}}></TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold', color: 'white', width: '15%', fontSize: '0.9rem' }}>TIER 1 (b)</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold', color: 'white', width: '15%', fontSize: '0.9rem' }}>TIER 2 (c)</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold', color: 'white', width: '15%', fontSize: '0.9rem' }}>TOTAL (d=b+c)</TableCell>
                        <TableCell sx={{color: 'white'}}></TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    <TableRow>
                        <TableCell colSpan={6} sx={{ p: 0 }}>
                          <Accordion defaultExpanded={false}>
                                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                    <Typography sx={{ fontWeight: 'bold' }}>CORPORATE INCOME</Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <Table size="small">
                                        <TableBody>
                                            {incomeCategories.map((row, idx) => {
                                                const incomeItems = tier1Data.income || [];
                                                const matchingItems = incomeItems.filter(row.filter);
                                                const subtotal = matchingItems.reduce((sum, item) => sum + (item.amount || item.cost || item.total || 0), 0);
                                                return (
                                                    <TableRow key={idx}>
                                                        <TableCell width="25%">{row.label}</TableCell>
                                                        <TableCell align="right" width="15%">{formatCurrency(subtotal)}</TableCell>
                                                        <TableCell align="right" width="15%">-</TableCell>
                                                        <TableCell align="right" width="15%">-</TableCell>
                                                        <TableCell align="right" width="15%">-</TableCell>
                                                        <TableCell align="right" width="15%">{formatCurrency(subtotal)}</TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                            <TableRow sx={{ backgroundColor: '#f0f0f0' }}>
                                                <TableCell component="th" scope="row" sx={{ fontWeight: 'bold' }}>TOTAL CORPORATE INCOME</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(tier1Totals?.income || 0)}</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>-</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>-</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>-</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(tier1Totals?.income || 0)}</TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </AccordionDetails>
                            </Accordion>
                        </TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell colSpan={6} sx={{ p: 0 }}>
                           <Accordion defaultExpanded={false}>
                                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                    <Typography sx={{ fontWeight: 'bold' }}>BUDGETARY SUPPORT</Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <Table size="small">
                                        <TableBody>
                                            <TableRow>
                                                <TableCell width="25%">Subsidy to the National Irrigation Administration:</TableCell>
                                                <TableCell align="right" width="15%">-</TableCell>
                                                <TableCell align="right" width="15%">-</TableCell>
                                                <TableCell align="right" width="15%">-</TableCell>
                                                <TableCell align="right" width="15%">-</TableCell>
                                                <TableCell align="right" width="15%">-</TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell width="25%">a. Operating Requirements</TableCell>
                                                <TableCell align="right" width="15%">{formatCurrency(((tier1Totals?.personnel || 0) * 0.6) + ((tier1Totals?.mooe || 0) * 0.5))}</TableCell>
                                                <TableCell align="right" width="15%">{formatCurrency(((tier1Totals?.personnel || 0) * 0.4) + ((tier1Totals?.mooe || 0) * 0.5) + (tier1Totals?.capital || 0))}</TableCell>
                                                <TableCell align="right" width="15%">{formatCurrency(tier2Totals?.tier2Amount || 0)}</TableCell>
                                                <TableCell align="right" width="15%">{formatCurrency(((tier1Totals?.personnel || 0) * 0.4) + ((tier1Totals?.mooe || 0) * 0.5) + (tier1Totals?.capital || 0) + (tier2Totals?.tier2Amount || 0))}</TableCell>
                                                <TableCell align="right" width="15%">{formatCurrency(((tier1Totals?.personnel || 0) * 0.6) + ((tier1Totals?.mooe || 0) * 0.5) + ((tier1Totals?.personnel || 0) * 0.4) + ((tier1Totals?.mooe || 0) * 0.5) + (tier1Totals?.capital || 0) + (tier2Totals?.tier2Amount || 0))}</TableCell>
                                            </TableRow>
                                            <TableRow sx={{ backgroundColor: '#f0f0f0' }}>
                                                <TableCell component="th" scope="row" sx={{ fontWeight: 'bold' }}>TOTAL BUDGETARY SUPPORT</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(((tier1Totals?.personnel || 0) * 0.6) + ((tier1Totals?.mooe || 0) * 0.5))}</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(((tier1Totals?.personnel || 0) * 0.4) + ((tier1Totals?.mooe || 0) * 0.5) + (tier1Totals?.capital || 0))}</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(tier2Totals?.tier2Amount || 0)}</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(((tier1Totals?.personnel || 0) * 0.4) + ((tier1Totals?.mooe || 0) * 0.5) + (tier1Totals?.capital || 0) + (tier2Totals?.tier2Amount || 0))}</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(((tier1Totals?.personnel || 0) * 0.6) + ((tier1Totals?.mooe || 0) * 0.5) + ((tier1Totals?.personnel || 0) * 0.4) + ((tier1Totals?.mooe || 0) * 0.5) + (tier1Totals?.capital || 0) + (tier2Totals?.tier2Amount || 0))}</TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </AccordionDetails>
                            </Accordion>
                        </TableCell>
                    </TableRow>
                     <TableRow sx={{ backgroundColor: '#2e7d32', color: 'white' }}>
                        <TableCell component="th" scope="row" sx={{ fontWeight: 'bold', color: 'white' }}>TOTAL SOURCES OF FUNDS</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: 'white' }}>{formatCurrency((tier1Totals?.income || 0) + ((tier1Totals?.personnel || 0) * 0.6) + ((tier1Totals?.mooe || 0) * 0.5))}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: 'white' }}>{formatCurrency(((tier1Totals?.personnel || 0) * 0.4) + ((tier1Totals?.mooe || 0) * 0.5) + (tier1Totals?.capital || 0))}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: 'white' }}>{formatCurrency(tier2Totals?.tier2Amount || 0)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: 'white' }}>{formatCurrency(((tier1Totals?.personnel || 0) * 0.4) + ((tier1Totals?.mooe || 0) * 0.5) + (tier1Totals?.capital || 0) + (tier2Totals?.tier2Amount || 0))}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: 'white' }}>{formatCurrency((tier1Totals?.income || 0) + (tier1Totals?.personnel || 0) + (tier1Totals?.mooe || 0) + (tier1Totals?.capital || 0) + (tier2Totals?.tier2Amount || 0))}</TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        </TableContainer>

        {/* SECTION B: USES OF FUNDS */}
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: '#1976d2' }}>
          B. USES OF FUNDS
        </Typography>

        {/* USES OF FUNDS TABLE */}
        <TableContainer sx={{ mb: 3, boxShadow: 2, borderRadius: 2, border: '1px solid #e0e0e0' }}>
          <Table size="medium">
            <TableHead>
              <TableRow sx={{ backgroundColor: '#1976d2' }}>
                <TableCell sx={{ fontWeight: 'bold', color: 'white', width: '25%', fontSize: '0.95rem', letterSpacing: 0.5, py: 2 }}>
                  USE OF FUNDS
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold', color: 'white', width: '15%', fontSize: '0.95rem', letterSpacing: 0.5, py: 2 }}>
                  PROJECTED CORPORATE INCOME<br />(a)
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold', color: 'white', width: '15%', fontSize: '0.95rem', letterSpacing: 0.5, py: 2 }}>
                  PROJECTED SUBSIDY<br />TIER 1 (b)
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold', color: 'white', width: '15%', fontSize: '0.95rem', letterSpacing: 0.5, py: 2 }}>
                  PROJECTED SUBSIDY<br />TIER 2 (c)
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold', color: 'white', width: '15%', fontSize: '0.95rem', letterSpacing: 0.5, py: 2 }}>
                  TOTAL<br />(d = b + c)
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold', color: 'white', width: '15%', fontSize: '0.95rem', letterSpacing: 0.5, py: 2 }}>
                  PROPOSED BUDGET<br />(e = a + d)
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {['personnel', 'mooe', 'capital'].map((categoryKey, idx) => {
                  const categoryMap = {
                      personnel: 'PERSONNEL SERVICES',
                      mooe: 'MAINTENANCE AND OTHER OPERATING EXPENSES',
                      capital: 'CAPITAL OUTLAYS'
                  };
                  const categoryTotal = tier1Totals?.[categoryKey] || 0;
                  const corporateIncome = categoryKey === 'personnel' ? categoryTotal * 0.6 : (categoryKey === 'mooe' ? categoryTotal * 0.5 : 0);
                  const tier1Subsidy = categoryTotal - corporateIncome;
                  // Tier 2 adjustments will be populated when tier2 data has category breakdown
                  const tier2Amount = 0; 
                  const totalSubsidy = tier1Subsidy + tier2Amount;
                  const proposedBudget = corporateIncome + totalSubsidy;
                  
                  return (
                    <TableRow key={categoryKey} sx={{ backgroundColor: idx % 2 === 0 ? '#f9f9f9' : '#fff' }}>
                        <TableCell>{categoryMap[categoryKey]}</TableCell>
                        <TableCell align="right">{formatCurrency(corporateIncome)}</TableCell>
                        <TableCell align="right">{formatCurrency(tier1Subsidy)}</TableCell>
                        <TableCell align="right">{formatCurrency(tier2Amount)}</TableCell>
                        <TableCell align="right">{formatCurrency(totalSubsidy)}</TableCell>
                        <TableCell align="right">{formatCurrency(proposedBudget)}</TableCell>
                    </TableRow>
                  );
              })}

              <TableRow sx={{ backgroundColor: '#e3f2fd', borderTop: '2px solid #1976d2' }}>
                <TableCell sx={{ pl: 3, py: 2, fontWeight: 'bold' }}>
                    TOTAL USES OF FUNDS
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    {formatCurrency(((tier1Totals?.personnel || 0) * 0.6) + ((tier1Totals?.mooe || 0) * 0.5))}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    {formatCurrency(((tier1Totals?.personnel || 0) * 0.4) + ((tier1Totals?.mooe || 0) * 0.5) + (tier1Totals?.capital || 0))}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    {formatCurrency(tier2Totals?.tier2Amount || 0)}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    {formatCurrency(((tier1Totals?.personnel || 0) * 0.4) + ((tier1Totals?.mooe || 0) * 0.5) + (tier1Totals?.capital || 0) + (tier2Totals?.tier2Amount || 0))}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    {formatCurrency((tier1Totals?.personnel || 0) + (tier1Totals?.mooe || 0) + (tier1Totals?.capital || 0) + (tier2Totals?.tier2Amount || 0))}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };
  
  // Render Tier 2 data table
  const renderTier2Table = () => {
    if (isLoadingTier2) {
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
                    <span>
                      <IconButton 
                        size="small" 
                        color="primary" 
                        onClick={() => handleEditTier2(item)}
                        disabled={item.tier2Status === 'Finalized'}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <span>
                      <IconButton 
                        size="small" 
                        color="error" 
                        onClick={() => handleDeleteTier2(item._id)}
                        disabled={item.tier2Status === 'Finalized'}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </span>
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
            <Grid item xs={12} sm={6} md={4}>
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
            
            <Grid item xs={12} sm={6} md={4}>
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

            <Grid item xs={12} sm={6} md={4}>
              <Box display="flex" gap={1}>
                <Button
                  variant="contained"
                  startIcon={<RefreshIcon />}
                  onClick={() => {
                    queryClient.invalidateQueries(['tier1Data', selectedComparisonRegion, fiscalYear]);
                    queryClient.invalidateQueries(['tier2Data', selectedComparisonRegion, fiscalYear]);
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
                  disabled={!selectedComparisonRegion || copyToTier2Mutation.isLoading || tier2Data.length > 0}
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
              value={displayAmount}
              onChange={(e) => {
                const rawValue = e.target.value.replace(/,/g, '');
                if (/^\d*\.?\d*$/.test(rawValue)) {
                  setDisplayAmount(e.target.value);
                  setEditFormData({ ...editFormData, tier2Amount: parseFloat(rawValue) || 0 });
                }
              }}
              onBlur={() => {
                const formatted = Number(editFormData.tier2Amount || 0).toLocaleString('en-US', { 
                  minimumFractionDigits: 2, 
                  maximumFractionDigits: 2 
                });
                setDisplayAmount(formatted);
              }}
              helperText="Enter amount with decimal format (e.g., 12,345,678.90)"
            />

            <TextField
              fullWidth
              label="Remarks / Justification"
              multiline
              rows={3}
              value={editFormData.tier2Remarks || ''}
              onChange={(e) => setEditFormData({ ...editFormData, tier2Remarks: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleSaveTier2} 
            variant="contained" 
            startIcon={<SaveIcon />}
            disabled={updateTier2Mutation.isLoading}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TierComparisonPage;
