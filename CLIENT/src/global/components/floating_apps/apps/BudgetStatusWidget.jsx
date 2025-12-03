import { useState, useEffect } from 'react';
import { Box, Typography, LinearProgress, Card, Grid, CircularProgress, Tooltip, IconButton } from '@mui/material';
import { FiRefreshCw, FiTrendingUp, FiAlertTriangle } from 'react-icons/fi';
import { useTheme, useMediaQuery } from '@mui/material';
import { api } from '../../../services/api';

export default function BudgetStatusWidget() {
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [budgetData, setBudgetData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBudgetData = async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      setRefreshing(true);
      setError(null);

      // Fetch aggregated budget data
      const response = await api.get('/api/budgets/dashboard-summary');
      
      if (response?.data) {
        setBudgetData({
          totalAllocated: response.data.totalAllocated || 0,
          totalSpent: response.data.totalSpent || 0,
          pendingApprovals: response.data.pendingApprovals || 0,
          overdueProposals: response.data.overdueProposals || 0,
          regionPerformance: response.data.regionPerformance || [],
          submissionRate: response.data.submissionRate || 0,
          timestamp: new Date()
        });
      }
    } catch (e) {
      console.error('[BudgetStatusWidget] Failed to fetch data:', e);
      setError('Failed to load budget data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBudgetData();
    // Refresh every 5 minutes
    const interval = setInterval(() => fetchBudgetData(false), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const getUtilizationPercentage = () => {
    if (!budgetData || budgetData.totalAllocated === 0) return 0;
    return Math.round((budgetData.totalSpent / budgetData.totalAllocated) * 100);
  };

  const getStatusColor = (percentage) => {
    if (percentage >= 100) return '#d32f2f';
    if (percentage >= 80) return '#f57c00';
    if (percentage >= 50) return '#fbc02d';
    return '#43a047';
  };

  const getStatusLabel = (percentage) => {
    if (percentage >= 100) return 'Over Budget';
    if (percentage >= 80) return 'Critical';
    if (percentage >= 50) return 'Caution';
    return 'On Track';
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(value);
  };

  const utilizationPercentage = getUtilizationPercentage();
  const statusColor = getStatusColor(utilizationPercentage);
  const statusLabel = getStatusLabel(utilizationPercentage);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', bgcolor: '#1a1a1e', color: '#eee' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#1a1a1e', color: '#eee', overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{ p: 1.5, borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FiTrendingUp size={20} />
          <Typography variant='subtitle1'>Budget Overview</Typography>
        </Box>
        <IconButton 
          size='small' 
          onClick={() => fetchBudgetData(true)}
          disabled={refreshing}
          sx={{ color: refreshing ? '#666' : '#aaa' }}
        >
          <FiRefreshCw size={16} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
        </IconButton>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
        {error ? (
          <Box sx={{ p: 2, bgcolor: 'rgba(211,47,47,0.1)', borderRadius: 1, color: '#ff6b6b' }}>
            <Typography variant='body2'>{error}</Typography>
          </Box>
        ) : budgetData ? (
          <Grid container spacing={2}>
            {/* Main Utilization Card */}
            <Grid item xs={12}>
              <Card sx={{ bgcolor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant='body2' sx={{ color: 'rgba(255,255,255,0.7)', mb: 0.5 }}>Budget Utilization</Typography>
                    <Typography variant='h6' sx={{ fontWeight: 700 }}>{utilizationPercentage}%</Typography>
                  </Box>
                  <Box sx={{ position: 'relative', width: 80, height: 80 }}>
                    <CircularProgress 
                      variant='determinate' 
                      value={Math.min(utilizationPercentage, 100)} 
                      size={80}
                      sx={{ color: statusColor }}
                    />
                    <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography variant='caption' sx={{ fontWeight: 600, color: statusColor }}>{statusLabel}</Typography>
                    </Box>
                  </Box>
                </Box>
                <LinearProgress 
                  variant='determinate' 
                  value={Math.min(utilizationPercentage, 100)}
                  sx={{ bgcolor: 'rgba(255,255,255,0.1)', height: 6, borderRadius: 3, '& .MuiLinearProgress-bar': { bgcolor: statusColor } }}
                />
                <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <Typography variant='caption'>Spent: {formatCurrency(budgetData.totalSpent)}</Typography>
                  <Typography variant='caption'>Total: {formatCurrency(budgetData.totalAllocated)}</Typography>
                </Box>
              </Card>
            </Grid>

            {/* Key Metrics */}
            <Grid item xs={12} sm={6}>
              <Card sx={{ bgcolor: 'rgba(0,102,204,0.1)', border: '1px solid rgba(0,102,204,0.3)', p: 1.5 }}>
                <Typography variant='caption' sx={{ color: 'rgba(255,255,255,0.7)' }}>Pending Approvals</Typography>
                <Typography variant='h5' sx={{ fontWeight: 700, color: '#0066cc' }}>{budgetData.pendingApprovals}</Typography>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Card sx={{ bgcolor: 'rgba(211,47,47,0.1)', border: '1px solid rgba(211,47,47,0.3)', p: 1.5 }}>
                <Typography variant='caption' sx={{ color: 'rgba(255,255,255,0.7)' }}>Overdue Proposals</Typography>
                <Typography variant='h5' sx={{ fontWeight: 700, color: '#ff6b6b' }}>{budgetData.overdueProposals}</Typography>
              </Card>
            </Grid>

            {/* Submission Rate */}
            <Grid item xs={12}>
              <Card sx={{ bgcolor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', p: 1.5 }}>
                <Typography variant='caption' sx={{ color: 'rgba(255,255,255,0.7)', display: 'block', mb: 0.5 }}>Submission Compliance</Typography>
                <LinearProgress 
                  variant='determinate' 
                  value={budgetData.submissionRate}
                  sx={{ bgcolor: 'rgba(255,255,255,0.1)', height: 6, borderRadius: 3, '& .MuiLinearProgress-bar': { bgcolor: '#43a047' } }}
                />
                <Typography variant='caption' sx={{ mt: 0.5, display: 'block' }}>{budgetData.submissionRate}% Submitted</Typography>
              </Card>
            </Grid>

            {/* Region Performance */}
            {budgetData.regionPerformance && budgetData.regionPerformance.length > 0 && (
              <Grid item xs={12}>
                <Card sx={{ bgcolor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', p: 1.5 }}>
                  <Typography variant='caption' sx={{ color: 'rgba(255,255,255,0.7)', display: 'block', mb: 1 }}>Region Performance</Typography>
                  {budgetData.regionPerformance.map((region, idx) => (
                    <Box key={idx} sx={{ mb: 1, pb: 1, borderBottom: idx < budgetData.regionPerformance.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant='caption' sx={{ fontWeight: 500 }}>{region.name}</Typography>
                        <Typography variant='caption'>{region.utilization}%</Typography>
                      </Box>
                      <LinearProgress 
                        variant='determinate' 
                        value={region.utilization}
                        sx={{ bgcolor: 'rgba(255,255,255,0.1)', height: 4, borderRadius: 2, '& .MuiLinearProgress-bar': { bgcolor: getStatusColor(region.utilization) } }}
                      />
                    </Box>
                  ))}
                </Card>
              </Grid>
            )}

            {/* Last Updated */}
            <Grid item xs={12}>
              <Typography variant='caption' sx={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', display: 'block' }}>
                Last updated: {budgetData.timestamp.toLocaleTimeString()}
              </Typography>
            </Grid>
          </Grid>
        ) : null}
      </Box>
    </Box>
  );
}
