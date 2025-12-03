import { useState, useEffect } from 'react';
import { Box, Typography, Card, Grid, CircularProgress, IconButton } from '@mui/material';
import { FiTrendingUp, FiTrendingDown, FiRefreshCw } from 'react-icons/fi';
import { useTheme, useMediaQuery } from '@mui/material';
import { api } from '../../../services/api';

export default function PerformanceMetrics() {
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));

  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMetrics = async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      setRefreshing(true);
      const response = await api.get('/api/performance-metrics');
      if (response?.data) {
        setMetrics(response.data);
      }
    } catch (e) {
      console.error('[PerformanceMetrics] Failed to fetch metrics:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(() => fetchMetrics(false), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const MetricCard = ({ label, value, unit, trend, trendValue, color }) => {
    const trendColor = trend === 'up' ? '#43a047' : trend === 'down' ? '#d32f2f' : '#f57c00';
    return (
      <Card sx={{ bgcolor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', p: 1.5 }}>
        <Typography variant='caption' sx={{ color: 'rgba(255,255,255,0.7)' }}>{label}</Typography>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, mt: 0.75 }}>
          <Typography variant='h6' sx={{ fontWeight: 700, color: color || '#0066cc' }}>
            {value}
          </Typography>
          <Typography variant='caption' sx={{ mb: 0.5, color: 'rgba(255,255,255,0.5)' }}>
            {unit}
          </Typography>
        </Box>
        {trend && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.75, fontSize: '12px', color: trendColor }}>
            {trend === 'up' ? <FiTrendingUp size={12} /> : <FiTrendingDown size={12} />}
            <Typography variant='caption' sx={{ color: trendColor }}>
              {trendValue}% {trend === 'up' ? 'increase' : 'decrease'}
            </Typography>
          </Box>
        )}
      </Card>
    );
  };

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
          <Typography variant='subtitle1'>Performance KPIs</Typography>
        </Box>
        <IconButton 
          size='small' 
          onClick={() => fetchMetrics(true)}
          disabled={refreshing}
          sx={{ color: refreshing ? '#666' : '#aaa' }}
        >
          <FiRefreshCw size={16} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
        </IconButton>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
        {metrics ? (
          <Grid container spacing={1.5}>
            {/* Budget Utilization */}
            <Grid item xs={12} sm={6}>
              <MetricCard
                label='Avg Budget Utilization'
                value={metrics.avgBudgetUtilization || 0}
                unit='%'
                trend={metrics.budgetUtilizationTrend}
                trendValue={Math.abs(metrics.budgetUtilizationChange || 0)}
                color='#0066cc'
              />
            </Grid>

            {/* Approval Time */}
            <Grid item xs={12} sm={6}>
              <MetricCard
                label='Avg Approval Time'
                value={metrics.avgApprovalTime || 0}
                unit='days'
                trend={metrics.approvalTimeTrend}
                trendValue={Math.abs(metrics.approvalTimeChange || 0)}
                color='#f57c00'
              />
            </Grid>

            {/* Submission Rate */}
            <Grid item xs={12} sm={6}>
              <MetricCard
                label='Submission Compliance'
                value={metrics.submissionRate || 0}
                unit='%'
                trend={metrics.submissionTrend}
                trendValue={Math.abs(metrics.submissionChange || 0)}
                color='#43a047'
              />
            </Grid>

            {/* Budget Accuracy */}
            <Grid item xs={12} sm={6}>
              <MetricCard
                label='Budget Accuracy'
                value={metrics.budgetAccuracy || 0}
                unit='%'
                trend={metrics.accuracyTrend}
                trendValue={Math.abs(metrics.accuracyChange || 0)}
                color='#9c27b0'
              />
            </Grid>

            {/* Pending Approvals */}
            <Grid item xs={12} sm={6}>
              <MetricCard
                label='Pending Approvals'
                value={metrics.pendingApprovalsCount || 0}
                unit='items'
                color='#0066cc'
              />
            </Grid>

            {/* Overdue Items */}
            <Grid item xs={12} sm={6}>
              <MetricCard
                label='Overdue Items'
                value={metrics.overdueItemsCount || 0}
                unit='items'
                color={metrics.overdueItemsCount > 0 ? '#d32f2f' : '#43a047'}
              />
            </Grid>

            {/* Year-to-Date Spending */}
            <Grid item xs={12}>
              <Card sx={{ bgcolor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', p: 1.5 }}>
                <Typography variant='caption' sx={{ color: 'rgba(255,255,255,0.7)' }}>Year-to-Date Spending</Typography>
                <Box sx={{ mt: 0.75 }}>
                  <Typography variant='h6' sx={{ fontWeight: 700, color: '#0066cc' }}>
                    ${(metrics.ytdSpending || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </Typography>
                  <Typography variant='caption' sx={{ color: 'rgba(255,255,255,0.5)', display: 'block' }}>
                    of ${(metrics.ytdBudget || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} allocated
                  </Typography>
                </Box>
              </Card>
            </Grid>

            {/* Top Performing Region */}
            {metrics.topRegion && (
              <Grid item xs={12}>
                <Card sx={{ bgcolor: 'rgba(67,160,71,0.1)', border: '1px solid rgba(67,160,71,0.3)', p: 1.5 }}>
                  <Typography variant='caption' sx={{ color: 'rgba(255,255,255,0.7)' }}>Top Performing Region</Typography>
                  <Box sx={{ mt: 0.75 }}>
                    <Typography variant='body2' sx={{ fontWeight: 600, color: '#43a047' }}>
                      {metrics.topRegion.name}
                    </Typography>
                    <Typography variant='caption' sx={{ color: 'rgba(255,255,255,0.5)' }}>
                      {metrics.topRegion.metric}
                    </Typography>
                  </Box>
                </Card>
              </Grid>
            )}

            {/* Last Updated */}
            <Grid item xs={12}>
              <Typography variant='caption' sx={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', display: 'block' }}>
                Last updated: {metrics.timestamp ? new Date(metrics.timestamp).toLocaleTimeString() : 'N/A'}
              </Typography>
            </Grid>
          </Grid>
        ) : (
          <Box sx={{ p: 2, textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
            <Typography variant='body2'>No metrics available</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
