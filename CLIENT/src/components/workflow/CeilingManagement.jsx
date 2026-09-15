import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  IconButton,
  Tooltip,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  Divider,
  Collapse,
  LinearProgress,
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Publish as PublishIcon,
  Lock as LockIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  CompareArrows as CompareIcon,
  PlayArrow as GenerateIcon,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import api from '../../config/api';
import BudgetComparisonView from './BudgetComparisonView';
import { NumericFormat } from 'react-number-format';

// NumericFormat custom component for TextFields
const NumericFormatCustom = React.forwardRef(function NumericFormatCustom(
  props,
  ref,
) {
  const { onChange, ...other } = props;

  return (
    <NumericFormat
      {...other}
      getInputRef={ref}
      onValueChange={(values) => {
        onChange({
          target: {
            name: props.name,
            value: values.value,
          },
        });
      }}
      thousandSeparator
      valueIsNumericString
      decimalScale={2}
      fixedDecimalScale
    />
  );
});

// Brand colors matching the main theme
const BRAND_COLORS = {
  darkGreen: '#375e38',
  deepGreen: '#2d5016',
  lightGreen: '#4CAF50',
  success: '#2e7d32',
  warning: '#ed6c02',
  error: '#d32f2f',
  info: '#0288d1',
};

const formatCurrency = (amount) => {
  return `₱${(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const CeilingManagement = ({ fiscalYear, region, regionName, onRefresh }) => {
  const [loading, setLoading] = useState(false);
  const [ceiling, setCeiling] = useState(null);
  const [finalizedSummary, setFinalizedSummary] = useState(null);
  const [editingAllocation, setEditingAllocation] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [budgetPoolDialogOpen, setBudgetPoolDialogOpen] = useState(false);
  const [newBudgetPool, setNewBudgetPool] = useState(0);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [generationMode, setGenerationMode] = useState('PREPARER');
  const [comparisonExpanded, setComparisonExpanded] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch ceiling data
  const fetchCeiling = useCallback(async () => {
    if (!fiscalYear || !region) return;
    
    setLoading(true);
    try {
      const res = await api.get(`/api/budget-ceiling/${fiscalYear}/${encodeURIComponent(regionName || region)}`);
      if (res.data.success) {
        setCeiling(res.data.data);
      }
    } catch (error) {
      console.error('Error fetching ceiling:', error);
      // Don't show error for 404 - just means no ceiling exists yet
      if (error.response?.status !== 404) {
        toast.error('Failed to fetch ceiling data');
      }
    } finally {
      setLoading(false);
    }
  }, [fiscalYear, region, regionName]);

  // Fetch finalized Initial proposals count for this region (so user sees something before initializing)
  const fetchFinalizedSummary = useCallback(async () => {
    if (!fiscalYear || !region) return;
    try {
      const res = await api.get('/api/budget-ceiling/finalized-initial', {
        params: { region, fiscalYear }
      });
      if (res.data?.success && res.data?.data) {
        setFinalizedSummary(res.data.data.summary || { totalProposals: (res.data.data.proposals || []).length });
      } else {
        setFinalizedSummary({ totalProposals: 0 });
      }
    } catch (err) {
      console.error('Error fetching finalized proposals:', err);
      setFinalizedSummary({ totalProposals: 0 });
    }
  }, [fiscalYear, region]);

  useEffect(() => {
    fetchCeiling();
  }, [fetchCeiling]);

  useEffect(() => {
    if (!ceiling && region && fiscalYear) {
      fetchFinalizedSummary();
    } else {
      setFinalizedSummary(null);
    }
  }, [ceiling, region, fiscalYear, fetchFinalizedSummary]);

  // Initialize ceiling from finalized Initial proposals
  const handleInitializeCeiling = async () => {
    setActionLoading(true);
    try {
      const res = await api.post('/api/budget-ceiling/initialize', {
        fiscalYear,
        region: regionName || region,
        budgetPhase: 'NEP',
        totalBudgetPool: 0
      });
      
      if (res.data.success) {
        toast.success('Ceiling initialized successfully');
        setCeiling(res.data.data);
        fetchCeiling();
      }
    } catch (error) {
      console.error('Error initializing ceiling:', error);
      toast.error(error.response?.data?.message || 'Failed to initialize ceiling');
    } finally {
      setActionLoading(false);
    }
  };

  // Start editing an allocation
  const handleEditAllocation = (allocation) => {
    setEditingAllocation(allocation.division);
    setEditValues({
      ceilingAmount: allocation.ceilingAmount || 0,
      ps: allocation.ceilingBreakdown?.personnelServices || 0,
      mooe: allocation.ceilingBreakdown?.mooe || 0,
      co: allocation.ceilingBreakdown?.capitalOutlay || 0,
      priority: allocation.priority || 'Medium',
      remarks: allocation.remarks || ''
    });
  };

  // Save allocation changes
  const handleSaveAllocation = async () => {
    if (!ceiling?._id || !editingAllocation) return;
    
    setActionLoading(true);
    try {
      const res = await api.put(`/api/budget-ceiling/${ceiling._id}/allocation`, {
        division: editingAllocation,
        ceilingAmount: editValues.ceilingAmount,
        ceilingBreakdown: {
          personnelServices: editValues.ps || 0,
          mooe: editValues.mooe || 0,
          capitalOutlay: editValues.co || 0
        },
        priority: editValues.priority,
        remarks: editValues.remarks
      });
      
      if (res.data.success) {
        toast.success('Ceiling updated successfully');
        setCeiling(res.data.data);
        setEditingAllocation(null);
        setEditValues({});
      }
    } catch (error) {
      console.error('Error saving allocation:', error);
      toast.error('Failed to save ceiling');
    } finally {
      setActionLoading(false);
    }
  };

  // Update budget pool
  const handleUpdateBudgetPool = async () => {
    if (!ceiling?._id) return;
    
    setActionLoading(true);
    try {
      const res = await api.put(`/api/budget-ceiling/${ceiling._id}/budget-pool`, {
        totalBudgetPool: newBudgetPool
      });
      
      if (res.data.success) {
        toast.success('Budget pool updated');
        setCeiling(res.data.data);
        setBudgetPoolDialogOpen(false);
      }
    } catch (error) {
      console.error('Error updating budget pool:', error);
      toast.error('Failed to update budget pool');
    } finally {
      setActionLoading(false);
    }
  };

  // Publish ceiling
  const handlePublish = async () => {
    if (!ceiling?._id) return;
    
    setActionLoading(true);
    try {
      const res = await api.post(`/api/budget-ceiling/${ceiling._id}/publish`);
      
      if (res.data.success) {
        toast.success('Ceiling published! Divisions can now see their allocations.');
        setCeiling(res.data.data);
      }
    } catch (error) {
      console.error('Error publishing ceiling:', error);
      toast.error('Failed to publish ceiling');
    } finally {
      setActionLoading(false);
    }
  };

  // Generate NEP proposals
  const handleGenerateNEP = async () => {
    if (!ceiling?._id) return;
    
    setActionLoading(true);
    try {
      const res = await api.post(`/api/budget-ceiling/${ceiling._id}/generate-nep`, {
        generationMode,
      });
      
      if (res.data.success) {
        const { nepProposals, errors } = res.data.data;
        toast.success(
          `Generated ${nepProposals.length} NEP proposal(s) for ${generationMode === 'BRD' ? 'BRD direct adjustment' : 'Budget Preparer adjustment'}`,
        );
        if (errors.length > 0) {
          errors.forEach(err => toast.warning(err));
        }
        setCeiling(res.data.data.ceiling);
        setGenerateDialogOpen(false);
        if (onRefresh) onRefresh();
      }
    } catch (error) {
      console.error('Error generating NEP:', error);
      toast.error(error.response?.data?.message || 'Failed to generate NEP proposals');
    } finally {
      setActionLoading(false);
    }
  };

  // Calculate totals
  const getTotals = () => {
    if (!ceiling?.allocations) return { initial: 0, ceiling: 0, variance: 0 };
    
    return ceiling.allocations.reduce((acc, alloc) => ({
      initial: acc.initial + (alloc.initialRequestAmount || 0),
      ceiling: acc.ceiling + (alloc.ceilingAmount || 0),
      variance: acc.variance + ((alloc.ceilingAmount || 0) - (alloc.initialRequestAmount || 0))
    }), { initial: 0, ceiling: 0, variance: 0 });
  };

  const totals = getTotals();
  const budgetUtilization = ceiling?.totalBudgetPool > 0 
    ? ((ceiling.totalAllocated / ceiling.totalBudgetPool) * 100).toFixed(1)
    : 0;

  // Render status chip
  const renderStatusChip = (status) => {
    const statusConfig = {
      'Draft': { color: 'default', label: 'Draft' },
      'Published': { color: 'primary', label: 'Published' },
      'Locked': { color: 'warning', label: 'Locked' },
      'Archived': { color: 'success', label: 'Archived' }
    };
    const config = statusConfig[status] || statusConfig['Draft'];
    return <Chip size="small" color={config.color} label={config.label} />;
  };

  // No ceiling yet - show initialize button
  if (!ceiling && !loading) {
    return (
      <Paper 
        elevation={0}
        sx={{ 
          p: 4, 
          mt: 2, 
          background: 'linear-gradient(135deg, #f8f9fa 0%, #e8f5e9 100%)',
          border: '2px dashed #81c784',
          borderRadius: 3,
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Background decoration */}
        <Box sx={{
          position: 'absolute',
          top: -50,
          right: -50,
          width: 200,
          height: 200,
          borderRadius: '50%',
          background: 'rgba(45, 80, 22, 0.05)',
          zIndex: 0
        }} />
        <Box sx={{
          position: 'absolute',
          bottom: -30,
          left: -30,
          width: 120,
          height: 120,
          borderRadius: '50%',
          background: 'rgba(76, 175, 80, 0.08)',
          zIndex: 0
        }} />
        
        <Box sx={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          {/* Icon */}
          <Box sx={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #2d5016 0%, #4CAF50 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 8px 32px rgba(45, 80, 22, 0.25)'
          }}>
            <Typography sx={{ fontSize: '2.5rem' }}>📊</Typography>
          </Box>
          
          <Typography variant="h5" sx={{ 
            color: BRAND_COLORS.deepGreen, 
            fontWeight: 700,
            mb: 1,
            letterSpacing: '-0.5px'
          }}>
            NEP Ceiling Management
          </Typography>
          
          <Box sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1,
            bgcolor: 'rgba(45, 80, 22, 0.1)',
            px: 2,
            py: 0.5,
            borderRadius: 2,
            mb: 2
          }}>
            <Typography sx={{ color: BRAND_COLORS.deepGreen, fontSize: '0.9rem', fontWeight: 500 }}>
              FY {fiscalYear}
            </Typography>
            <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: BRAND_COLORS.deepGreen }} />
            <Typography sx={{ color: BRAND_COLORS.deepGreen, fontSize: '0.9rem', fontWeight: 500 }}>
              {regionName || region || 'No region selected'}
            </Typography>
          </Box>
          
          <Typography sx={{ color: '#666', mb: 1, fontSize: '0.95rem' }}>
            No budget ceiling has been configured yet for this fiscal year and region.
          </Typography>
          
          <Typography sx={{ color: '#888', fontSize: '0.85rem', mb: 2, maxWidth: 500, mx: 'auto' }}>
            Initialize from finalized Initial proposals to start setting NEP budget ceilings. 
            This will aggregate all approved Initial proposal amounts per division.
          </Typography>

          {/* Finalized proposals count so user sees something (e.g. Super Admin) */}
          {finalizedSummary != null && (
            <Alert severity={finalizedSummary.totalProposals > 0 ? 'success' : 'info'} sx={{ mb: 3, maxWidth: 420, mx: 'auto' }}>
              <strong>
                {finalizedSummary.totalProposals > 0
                  ? `${finalizedSummary.totalProposals} finalized Initial proposal(s) in this region.`
                  : 'No finalized Initial proposals in this region.'}
              </strong>
              {finalizedSummary.totalProposals === 0 && (
                <Typography component="span" display="block" sx={{ mt: 0.5, fontSize: '0.9rem' }}>
                  Switch region above (e.g. Central Office) or finalize proposals in All Proposals first.
                </Typography>
              )}
            </Alert>
          )}
          
          {/* Feature highlights */}
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: 3, 
            mb: 4,
            flexWrap: 'wrap'
          }}>
            {[
              { icon: '📋', label: 'Aggregate Proposals', desc: 'Pull from finalized Initial' },
              { icon: '✏️', label: 'Set Ceilings', desc: 'Per division allocation' },
              { icon: '📤', label: 'Publish & Generate', desc: 'Create NEP proposals' },
            ].map((feature, idx) => (
              <Box key={idx} sx={{
                textAlign: 'center',
                p: 2,
                borderRadius: 2,
                bgcolor: 'rgba(255,255,255,0.7)',
                minWidth: 140,
                transition: 'all 0.2s',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                }
              }}>
                <Typography sx={{ fontSize: '1.8rem', mb: 0.5 }}>{feature.icon}</Typography>
                <Typography sx={{ fontWeight: 600, color: BRAND_COLORS.deepGreen, fontSize: '0.85rem' }}>
                  {feature.label}
                </Typography>
                <Typography sx={{ color: '#888', fontSize: '0.75rem' }}>
                  {feature.desc}
                </Typography>
              </Box>
            ))}
          </Box>
          
          <Button
            variant="contained"
            size="large"
            onClick={handleInitializeCeiling}
            disabled={actionLoading}
            startIcon={actionLoading ? <CircularProgress size={20} color="inherit" /> : <GenerateIcon />}
            sx={{
              bgcolor: BRAND_COLORS.deepGreen,
              px: 4,
              py: 1.5,
              fontSize: '1rem',
              fontWeight: 600,
              borderRadius: 2,
              boxShadow: '0 4px 14px rgba(45, 80, 22, 0.35)',
              '&:hover': { 
                bgcolor: BRAND_COLORS.darkGreen,
                transform: 'translateY(-1px)',
                boxShadow: '0 6px 20px rgba(45, 80, 22, 0.4)'
              },
              transition: 'all 0.2s ease'
            }}
          >
            {actionLoading ? 'Initializing...' : 'Initialize Ceiling from Initial Proposals'}
          </Button>
          
          <Typography sx={{ color: '#aaa', fontSize: '0.75rem', mt: 2 }}>
            💡 Tip: Ensure all Initial proposals for this region are finalized before initializing
          </Typography>
        </Box>
      </Paper>
    );
  }

  return (
    <Box sx={{ mt: 2 }}>
      {loading && <LinearProgress sx={{ mb: 2, bgcolor: '#c8e6c9', '& .MuiLinearProgress-bar': { bgcolor: BRAND_COLORS.deepGreen } }} />}
      
      {/* Header Section */}
      <Paper 
        elevation={0}
        sx={{ 
          p: 0, 
          mb: 2, 
          bgcolor: '#fff', 
          borderRadius: 3,
          overflow: 'hidden',
          border: '1px solid #e0e0e0'
        }}
      >
        {/* Green header bar */}
        <Box sx={{
          background: `linear-gradient(135deg, ${BRAND_COLORS.deepGreen} 0%, ${BRAND_COLORS.darkGreen} 100%)`,
          px: 3,
          py: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              bgcolor: 'rgba(255,255,255,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Typography sx={{ fontSize: '1.5rem' }}>📊</Typography>
            </Box>
            <Box>
              <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, letterSpacing: '-0.3px' }}>
                NEP Budget Ceiling
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                <Chip 
                  size="small" 
                  label={`FY ${fiscalYear}`} 
                  sx={{ 
                    bgcolor: 'rgba(255,255,255,0.2)', 
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '0.7rem'
                  }} 
                />
                <Chip 
                  size="small" 
                  label={regionName || region} 
                  sx={{ 
                    bgcolor: 'rgba(255,255,255,0.2)', 
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '0.7rem'
                  }} 
                />
                {renderStatusChip(ceiling?.status)}
              </Box>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Tooltip title="Refresh data">
              <IconButton 
                onClick={fetchCeiling} 
                disabled={loading}
                sx={{ 
                  bgcolor: 'rgba(255,255,255,0.15)', 
                  color: '#fff',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' }
                }}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            {ceiling?.status === 'Draft' && (
              <Button
                variant="contained"
                startIcon={<PublishIcon />}
                onClick={handlePublish}
                disabled={actionLoading}
                sx={{ 
                  bgcolor: '#fff', 
                  color: BRAND_COLORS.deepGreen,
                  fontWeight: 600,
                  '&:hover': { bgcolor: '#f5f5f5' }
                }}
              >
                Publish Ceiling
              </Button>
            )}
            {ceiling?.status === 'Published' && (
              <Button
                variant="contained"
                startIcon={<GenerateIcon />}
                onClick={() => {
                  setGenerationMode('PREPARER');
                  setGenerateDialogOpen(true);
                }}
                disabled={actionLoading}
                sx={{ 
                  bgcolor: '#fff', 
                  color: BRAND_COLORS.deepGreen,
                  fontWeight: 600,
                  '&:hover': { bgcolor: '#f5f5f5' }
                }}
              >
                Generate NEP Proposals
              </Button>
            )}
          </Box>
        </Box>
      </Paper>

      {/* Budget Pool Summary - Enhanced Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mb: 3 }}>
        {/* Total Budget Pool */}
        <Paper 
          elevation={0}
          sx={{ 
            p: 2.5, 
            bgcolor: '#f0f7f0', 
            border: `2px solid ${BRAND_COLORS.lightGreen}`,
            borderRadius: 2,
            position: 'relative',
            overflow: 'hidden',
            transition: 'all 0.2s',
            '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 20px rgba(76, 175, 80, 0.15)' }
          }}
        >
          <Box sx={{ position: 'absolute', top: -20, right: -20, fontSize: '4rem', opacity: 0.08 }}>💰</Box>
          <Typography sx={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>
            Total Budget Pool
          </Typography>
          <Typography variant="h5" sx={{ color: BRAND_COLORS.deepGreen, fontWeight: 700, my: 1 }}>
            {formatCurrency(ceiling?.totalBudgetPool)}
          </Typography>
          {ceiling?.status === 'Draft' && (
            <Button 
              size="small" 
              startIcon={<EditIcon sx={{ fontSize: 14 }} />}
              onClick={() => { setNewBudgetPool(ceiling?.totalBudgetPool || 0); setBudgetPoolDialogOpen(true); }}
              sx={{ color: BRAND_COLORS.deepGreen, fontSize: '0.75rem', p: 0.5 }}
            >
              Edit Pool
            </Button>
          )}
        </Paper>

        {/* Total Allocated */}
        <Paper 
          elevation={0}
          sx={{ 
            p: 2.5, 
            bgcolor: '#fff8e1', 
            border: '2px solid #ffb74d',
            borderRadius: 2,
            position: 'relative',
            overflow: 'hidden',
            transition: 'all 0.2s',
            '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 20px rgba(255, 183, 77, 0.15)' }
          }}
        >
          <Box sx={{ position: 'absolute', top: -20, right: -20, fontSize: '4rem', opacity: 0.08 }}>📋</Box>
          <Typography sx={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>
            Total Allocated
          </Typography>
          <Typography variant="h5" sx={{ color: BRAND_COLORS.warning, fontWeight: 700, my: 1 }}>
            {formatCurrency(ceiling?.totalAllocated)}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LinearProgress 
              variant="determinate" 
              value={Math.min(parseFloat(budgetUtilization), 100)} 
              sx={{ 
                flex: 1, 
                height: 6, 
                borderRadius: 3,
                bgcolor: 'rgba(237, 108, 2, 0.2)',
                '& .MuiLinearProgress-bar': { bgcolor: BRAND_COLORS.warning, borderRadius: 3 }
              }}
            />
            <Typography sx={{ fontSize: '0.75rem', color: '#888', fontWeight: 600 }}>
              {budgetUtilization}%
            </Typography>
          </Box>
        </Paper>

        {/* Total Initial Request */}
        <Paper 
          elevation={0}
          sx={{ 
            p: 2.5, 
            bgcolor: '#e3f2fd', 
            border: '2px solid #64b5f6',
            borderRadius: 2,
            position: 'relative',
            overflow: 'hidden',
            transition: 'all 0.2s',
            '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 20px rgba(100, 181, 246, 0.15)' }
          }}
        >
          <Box sx={{ position: 'absolute', top: -20, right: -20, fontSize: '4rem', opacity: 0.08 }}>📄</Box>
          <Typography sx={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>
            Total Initial Request
          </Typography>
          <Typography variant="h5" sx={{ color: BRAND_COLORS.info, fontWeight: 700, my: 1 }}>
            {formatCurrency(totals.initial)}
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: '#888' }}>
            From finalized proposals
          </Typography>
        </Paper>

        {/* Variance */}
        <Paper 
          elevation={0}
          sx={{ 
            p: 2.5, 
            bgcolor: totals.variance < 0 ? '#ffebee' : '#e8f5e9',
            border: `2px solid ${totals.variance < 0 ? '#ef5350' : '#66bb6a'}`,
            borderRadius: 2,
            position: 'relative',
            overflow: 'hidden',
            transition: 'all 0.2s',
            '&:hover': { transform: 'translateY(-2px)', boxShadow: `0 4px 20px rgba(${totals.variance < 0 ? '239, 83, 80' : '102, 187, 106'}, 0.15)` }
          }}
        >
          <Box sx={{ position: 'absolute', top: -20, right: -20, fontSize: '4rem', opacity: 0.08 }}>
            {totals.variance < 0 ? '📉' : '📈'}
          </Box>
          <Typography sx={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>
            Variance
          </Typography>
          <Typography variant="h5" sx={{ 
            color: totals.variance < 0 ? BRAND_COLORS.error : BRAND_COLORS.success, 
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            my: 1
          }}>
            {totals.variance < 0 ? <TrendingDownIcon /> : <TrendingUpIcon />}
            {totals.variance < 0 ? '-' : '+'}{formatCurrency(Math.abs(totals.variance))}
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: '#888' }}>
            Ceiling vs Initial Request
          </Typography>
        </Paper>
      </Box>

      {/* Allocations Table */}
      <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: BRAND_COLORS.darkGreen }}>
                <TableCell sx={{ color: '#fff', fontWeight: 600, width: '20%' }}>Division/Dept</TableCell>
                <TableCell sx={{ color: '#fff', fontWeight: 600, textAlign: 'right' }}>Initial Request</TableCell>
                <TableCell sx={{ color: '#fff', fontWeight: 600, textAlign: 'right' }}>Ceiling Amount</TableCell>
                <TableCell sx={{ color: '#fff', fontWeight: 600, textAlign: 'right' }}>Variance</TableCell>
                <TableCell sx={{ color: '#fff', fontWeight: 600, textAlign: 'center' }}>Priority</TableCell>
                <TableCell sx={{ color: '#fff', fontWeight: 600, textAlign: 'center' }}>Status</TableCell>
                <TableCell sx={{ color: '#fff', fontWeight: 600, textAlign: 'center', width: '100px' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(ceiling?.allocations || []).map((allocation, index) => {
                const isEditing = editingAllocation === allocation.division;
                const variance = (allocation.ceilingAmount || 0) - (allocation.initialRequestAmount || 0);
                const variancePercent = allocation.initialRequestAmount > 0 
                  ? ((variance / allocation.initialRequestAmount) * 100).toFixed(1)
                  : 0;

                return (
                  <TableRow 
                    key={allocation.division || index}
                    sx={{ 
                      '&:hover': { bgcolor: '#f5f5f5' },
                      bgcolor: isEditing ? '#fff3e0' : 'inherit'
                    }}
                  >
                    <TableCell>
                      <Typography sx={{ fontWeight: 500 }}>{allocation.division || allocation.department || `${regionName || region} (Consolidated)`}</Typography>
                      {allocation.remarks && (
                        <Typography sx={{ fontSize: '0.75rem', color: '#888' }}>{allocation.remarks}</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ textAlign: 'right' }}>
                      <Box sx={{ 
                        bgcolor: '#f8f9fa', 
                        p: 1, 
                        borderRadius: 1, 
                        border: '1px solid #e0e0e0',
                        mb: 1
                      }}>
                        <Box display="flex" justifyContent="space-between" mb={0.5}>
                          <Typography variant="caption" sx={{ fontWeight: 600, color: '#666' }}>PS:</Typography>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{formatCurrency(allocation.initialBreakdown?.personnelServices)}</Typography>
                        </Box>
                        <Box display="flex" justifyContent="space-between" mb={0.5}>
                          <Typography variant="caption" sx={{ fontWeight: 600, color: '#666' }}>MOOE:</Typography>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{formatCurrency(allocation.initialBreakdown?.mooe)}</Typography>
                        </Box>
                        <Box display="flex" justifyContent="space-between" mb={allocation.initialIncome > 0 ? 0.5 : 0}>
                          <Typography variant="caption" sx={{ fontWeight: 600, color: '#666' }}>CO:</Typography>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{formatCurrency(allocation.initialBreakdown?.capitalOutlay)}</Typography>
                        </Box>
                        {allocation.initialIncome > 0 && (
                          <Box display="flex" justifyContent="space-between" pt={0.5} mt={0.5} sx={{ borderTop: '1px dashed #ccc' }}>
                            <Typography variant="caption" sx={{ fontWeight: 600, color: '#1976d2' }}>Income:</Typography>
                            <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600, color: '#1976d2' }}>{formatCurrency(allocation.initialIncome)}</Typography>
                          </Box>
                        )}
                      </Box>
                      <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: '#333' }}>{formatCurrency(allocation.initialRequestAmount)}</Typography>
                    </TableCell>
                    <TableCell sx={{ textAlign: 'right' }}>
                      {isEditing ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 250, ml: 'auto' }}>
                          <TextField
                            size="small"
                            label="Personnel Services (PS)"
                            value={editValues.ps}
                            onChange={(e) => setEditValues(prev => ({ ...prev, ps: parseFloat(e.target.value) || 0 }))}
                            InputProps={{ 
                              startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                              inputComponent: NumericFormatCustom 
                            }}
                            inputProps={{ style: { textAlign: 'right' } }}
                            fullWidth
                          />
                          <TextField
                            size="small"
                            label="MOOE"
                            value={editValues.mooe}
                            onChange={(e) => setEditValues(prev => ({ ...prev, mooe: parseFloat(e.target.value) || 0 }))}
                            InputProps={{ 
                              startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                              inputComponent: NumericFormatCustom 
                            }}
                            inputProps={{ style: { textAlign: 'right' } }}
                            fullWidth
                          />
                          <TextField
                            size="small"
                            label="Capital Outlay (CO)"
                            value={editValues.co}
                            onChange={(e) => setEditValues(prev => ({ ...prev, co: parseFloat(e.target.value) || 0 }))}
                            InputProps={{ 
                              startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                              inputComponent: NumericFormatCustom 
                            }}
                            inputProps={{ style: { textAlign: 'right' } }}
                            fullWidth
                          />
                          <Box sx={{ bgcolor: '#e8f5e9', p: 1, borderRadius: 1, border: '1px solid #c8e6c9', mt: 0.5 }}>
                            <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: BRAND_COLORS.deepGreen, display: 'flex', justifyContent: 'space-between' }}>
                              <span>Grand Total:</span>
                              <span>{formatCurrency((editValues.ps || 0) + (editValues.mooe || 0) + (editValues.co || 0))}</span>
                            </Typography>
                          </Box>
                        </Box>
                      ) : (
                        <>
                          <Box sx={{ 
                            bgcolor: '#f8f9fa', 
                            p: 1, 
                            borderRadius: 1, 
                            border: '1px solid #e0e0e0',
                            mb: 1
                          }}>
                            <Box display="flex" justifyContent="space-between" mb={0.5}>
                              <Typography variant="caption" sx={{ fontWeight: 600, color: '#666' }}>PS:</Typography>
                              <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{formatCurrency(allocation.ceilingBreakdown?.personnelServices)}</Typography>
                            </Box>
                            <Box display="flex" justifyContent="space-between" mb={0.5}>
                              <Typography variant="caption" sx={{ fontWeight: 600, color: '#666' }}>MOOE:</Typography>
                              <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{formatCurrency(allocation.ceilingBreakdown?.mooe)}</Typography>
                            </Box>
                            <Box display="flex" justifyContent="space-between" mb={allocation.ceilingIncome > 0 ? 0.5 : 0}>
                              <Typography variant="caption" sx={{ fontWeight: 600, color: '#666' }}>CO:</Typography>
                              <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{formatCurrency(allocation.ceilingBreakdown?.capitalOutlay)}</Typography>
                            </Box>
                            {allocation.ceilingIncome > 0 && (
                              <Box display="flex" justifyContent="space-between" pt={0.5} mt={0.5} sx={{ borderTop: '1px dashed #ccc' }}>
                                <Typography variant="caption" sx={{ fontWeight: 600, color: '#1976d2' }}>Income:</Typography>
                                <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600, color: '#1976d2' }}>{formatCurrency(allocation.ceilingIncome)}</Typography>
                              </Box>
                            )}
                          </Box>
                          <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: BRAND_COLORS.deepGreen }}>
                            {formatCurrency(allocation.ceilingAmount)}
                          </Typography>
                        </>
                      )}
                    </TableCell>
                    <TableCell sx={{ textAlign: 'right' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                        {variance < 0 ? (
                          <TrendingDownIcon sx={{ color: BRAND_COLORS.error, fontSize: 18 }} />
                        ) : variance > 0 ? (
                          <TrendingUpIcon sx={{ color: BRAND_COLORS.success, fontSize: 18 }} />
                        ) : null}
                        <Typography sx={{ 
                          color: variance < 0 ? BRAND_COLORS.error : variance > 0 ? BRAND_COLORS.success : '#666',
                          fontWeight: 500
                        }}>
                          {formatCurrency(Math.abs(variance))}
                        </Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: '#888' }}>
                          ({variancePercent}%)
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
                      {isEditing ? (
                        <Select
                          size="small"
                          value={editValues.priority}
                          onChange={(e) => setEditValues(prev => ({ ...prev, priority: e.target.value }))}
                          sx={{ minWidth: 100 }}
                        >
                          <MenuItem value="Critical">Critical</MenuItem>
                          <MenuItem value="High">High</MenuItem>
                          <MenuItem value="Medium">Medium</MenuItem>
                          <MenuItem value="Low">Low</MenuItem>
                        </Select>
                      ) : (
                        <Chip 
                          size="small" 
                          label={allocation.priority || 'Medium'}
                          color={
                            allocation.priority === 'Critical' ? 'error' :
                            allocation.priority === 'High' ? 'warning' :
                            allocation.priority === 'Low' ? 'default' : 'info'
                          }
                        />
                      )}
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
                      <Chip
                        size="small"
                        label={allocation.allocationStatus || 'Pending'}
                        color={
                          allocation.allocationStatus === 'NEP_Finalized' ? 'success' :
                          allocation.allocationStatus === 'NEP_Created' ? 'primary' :
                          allocation.allocationStatus === 'Published' ? 'info' : 'default'
                        }
                      />
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
                      {ceiling?.status === 'Draft' && (
                        isEditing ? (
                          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                            <Tooltip title="Save">
                              <IconButton size="small" onClick={handleSaveAllocation} disabled={actionLoading}>
                                <SaveIcon sx={{ color: BRAND_COLORS.success }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Cancel">
                              <IconButton size="small" onClick={() => { setEditingAllocation(null); setEditValues({}); }}>
                                <CancelIcon sx={{ color: BRAND_COLORS.error }} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        ) : (
                          <Tooltip title="Edit Ceiling">
                            <IconButton size="small" onClick={() => handleEditAllocation(allocation)}>
                              <EditIcon sx={{ color: BRAND_COLORS.deepGreen }} />
                            </IconButton>
                          </Tooltip>
                        )
                      )}
                      {ceiling?.status === 'Locked' && allocation.nepProposalId && (
                        <Tooltip title="NEP Created">
                          <LockIcon sx={{ color: '#888', fontSize: 18 }} />
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {/* Totals Row */}
              <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                <TableCell sx={{ fontWeight: 700 }}>TOTAL</TableCell>
                <TableCell sx={{ textAlign: 'right', fontWeight: 700 }}>
                  {formatCurrency(totals.initial)}
                </TableCell>
                <TableCell sx={{ textAlign: 'right', fontWeight: 700, color: BRAND_COLORS.deepGreen }}>
                  {formatCurrency(totals.ceiling)}
                </TableCell>
                <TableCell sx={{ textAlign: 'right', fontWeight: 700, color: totals.variance < 0 ? BRAND_COLORS.error : BRAND_COLORS.success }}>
                  {formatCurrency(Math.abs(totals.variance))}
                </TableCell>
                <TableCell colSpan={3}></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Budget Pool Dialog */}
      <Dialog open={budgetPoolDialogOpen} onClose={() => setBudgetPoolDialogOpen(false)}>
        <DialogTitle sx={{ bgcolor: BRAND_COLORS.deepGreen, color: '#fff' }}>
          Set Total Budget Pool
        </DialogTitle>
        <DialogContent sx={{ pt: 3, minWidth: 400 }}>
          <Typography sx={{ mb: 2, color: '#666' }}>
            Enter the total budget pool available for allocation to all divisions.
          </Typography>
          <TextField
            fullWidth
            label="Total Budget Pool"
            value={newBudgetPool}
            onChange={(e) => setNewBudgetPool(parseFloat(e.target.value) || 0)}
            InputProps={{
              startAdornment: <InputAdornment position="start">₱</InputAdornment>,
              inputComponent: NumericFormatCustom
            }}
            inputProps={{ style: { textAlign: 'right' } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBudgetPoolDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleUpdateBudgetPool}
            disabled={actionLoading}
            sx={{ bgcolor: BRAND_COLORS.deepGreen }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Generate NEP Dialog */}
      <Dialog open={generateDialogOpen} onClose={() => setGenerateDialogOpen(false)}>
        <DialogTitle sx={{ bgcolor: BRAND_COLORS.deepGreen, color: '#fff' }}>
          Generate NEP Proposals
        </DialogTitle>
        <DialogContent sx={{ pt: 3, minWidth: 450 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            This will create NEP proposals for each division based on the published ceiling amounts.
          </Alert>
          <Typography sx={{ mb: 1 }}>
            <strong>Region:</strong> {regionName || region}
          </Typography>
          <Typography sx={{ mb: 1 }}>
            <strong>Fiscal Year:</strong> {fiscalYear}
          </Typography>
          <Typography sx={{ mb: 1 }}>
            <strong>Divisions:</strong> {ceiling?.allocations?.length || 0}
          </Typography>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel id="nep-generation-mode-label">Adjustment Workflow</InputLabel>
            <Select
              labelId="nep-generation-mode-label"
              value={generationMode}
              label="Adjustment Workflow"
              onChange={(event) => setGenerationMode(event.target.value)}
            >
              <MenuItem value="PREPARER">Send to Budget Preparer</MenuItem>
              <MenuItem value="BRD">BRD Direct Adjustment</MenuItem>
            </Select>
          </FormControl>
          <Divider sx={{ my: 2 }} />
          <Typography sx={{ color: '#666', fontSize: '0.85rem' }}>
            ⚠️ After generating NEP proposals:
          </Typography>
          <ul style={{ color: '#666', fontSize: '0.85rem', margin: '8px 0' }}>
            <li>The ceiling will be <strong>locked</strong> (no more changes)</li>
            {generationMode === 'BRD' ? (
              <>
                <li>NEP proposals will go directly to the <strong>Budget Planning Analyst</strong></li>
                <li>BRD can adjust the details within the approved ceiling</li>
                <li>The review path will be <strong>Analyst → Officer → Manager</strong></li>
              </>
            ) : (
              <>
                <li>NEP proposals will be created in <strong>Draft</strong> status</li>
                <li>Assigned Budget Preparers can submit them through the workflow</li>
              </>
            )}
          </ul>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGenerateDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleGenerateNEP}
            disabled={actionLoading}
            startIcon={actionLoading ? <CircularProgress size={16} /> : <GenerateIcon />}
            sx={{ bgcolor: BRAND_COLORS.deepGreen }}
          >
            {generationMode === 'BRD' ? 'Generate for BRD Adjustment' : 'Generate NEP Proposals'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Budget Comparison View - Shows when ceiling exists */}
      {ceiling && (
        <BudgetComparisonView
          fiscalYear={fiscalYear}
          region={region}
          regionName={regionName}
        />
      )}
    </Box>
  );
};

export default CeilingManagement;
