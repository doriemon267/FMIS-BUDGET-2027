/**
 * Dashboard Analytics Component
 * Shows trends, charts, and data visualization
 */

import {
  Box,
  Paper,
  Typography,
  Grid,
  Chip,
  Stack,
  Divider,
  alpha,
  useTheme
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PieChartIcon from '@mui/icons-material/PieChart';
import AccountTreeIcon from '@mui/icons-material/AccountTree';

const DashboardAnalytics = ({ data = {} }) => {
  const theme = useTheme();
  const { trends = [], statusDistribution = [], budgetTypeDistribution = [] } = data;

  const COLORS = {
    primary: '#60a561',
    success: '#6a994e',
    warning: '#f48c06',
    info: '#0077b6',
    error: '#d00000'
  };

  const statusColors = [COLORS.warning, COLORS.success, COLORS.error, COLORS.info, COLORS.primary];

  return (
    <Grid container spacing={4}>
      {/* Trends Summary */}
      <Grid item xs={12} md={trends.length > 0 ? 8 : 12}>
        <Paper elevation={0} sx={{ p: 3, border: `1px solid ${alpha(theme.palette.divider, 0.1)}`, borderRadius: 4, height: '100%' }}>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
            <TrendingUpIcon sx={{ color: COLORS.primary }} />
            <Typography variant="h6" fontWeight="800">Proposal Trends Summary</Typography>
          </Stack>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {trends.length > 0 ? trends.map((trend, index) => (
              <Paper 
                key={index} 
                elevation={0}
                sx={{ 
                  p: 2.5, 
                  bgcolor: alpha(COLORS.primary, 0.03), 
                  borderRadius: 3,
                  border: `1px solid ${alpha(COLORS.primary, 0.08)}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 2
                }}
              >
                <Box>
                  <Typography variant="caption" fontWeight="800" color="text.secondary" sx={{ textTransform: 'uppercase' }}>Fiscal Year</Typography>
                  <Typography variant="h6" fontWeight="900" color="primary">{trend.date}</Typography>
                </Box>
                
                <Stack direction="row" spacing={3} sx={{ flexGrow: 1, justifyContent: 'flex-end' }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="caption" fontWeight="700" color="text.secondary">Total</Typography>
                    <Typography variant="body1" fontWeight="900">{trend.total}</Typography>
                  </Box>
                  <Divider orientation="vertical" flexItem />
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="caption" fontWeight="700" color="success.main">Approved</Typography>
                    <Typography variant="body1" fontWeight="900">{trend.approved}</Typography>
                  </Box>
                  <Divider orientation="vertical" flexItem />
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="caption" fontWeight="700" color="warning.main">Pending</Typography>
                    <Typography variant="body1" fontWeight="900">{trend.pending}</Typography>
                  </Box>
                </Stack>
              </Paper>
            )) : (
              <Box sx={{ py: 4, textAlign: 'center', opacity: 0.5 }}>
                <Typography variant="body2">No trend data available for the current period.</Typography>
              </Box>
            )}
          </Box>
        </Paper>
      </Grid>

      {/* Status Distribution */}
      <Grid item xs={12} md={4}>
        <Paper elevation={0} sx={{ p: 3, border: `1px solid ${alpha(theme.palette.divider, 0.1)}`, borderRadius: 4, height: '100%' }}>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
            <PieChartIcon sx={{ color: COLORS.primary }} />
            <Typography variant="h6" fontWeight="800">Status Metrics</Typography>
          </Stack>
          
          <Stack spacing={2}>
            {statusDistribution.length > 0 ? statusDistribution.map((item, index) => (
              <Box key={index}>
                <Box sx={{ mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" fontWeight="700">{item.name}</Typography>
                  <Chip 
                    label={item.value} 
                    size="small" 
                    sx={{ 
                      fontWeight: 900,
                      bgcolor: alpha(statusColors[index % statusColors.length], 0.1), 
                      color: statusColors[index % statusColors.length],
                      border: `1px solid ${alpha(statusColors[index % statusColors.length], 0.2)}`
                    }} 
                  />
                </Box>
                <Divider sx={{ opacity: 0.5 }} />
              </Box>
            )) : (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                No status data to display.
              </Typography>
            )}
          </Stack>
        </Paper>
      </Grid>

      {/* Budget Type Distribution */}
      {budgetTypeDistribution.length > 0 && (
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ p: 3, border: `1px solid ${alpha(theme.palette.divider, 0.1)}`, borderRadius: 4 }}>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
              <AccountTreeIcon sx={{ color: COLORS.primary }} />
              <Typography variant="h6" fontWeight="800">Budget Classification</Typography>
            </Stack>
            
            <Grid container spacing={2}>
              {budgetTypeDistribution.map((item, index) => (
                <Grid item xs={12} sm={6} md={3} key={index}>
                  <Box 
                    sx={{ 
                      p: 2, 
                      bgcolor: alpha(theme.palette.background.default, 0.5), 
                      borderRadius: 3, 
                      border: `1px solid ${alpha(theme.palette.divider, 0.05)}`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <Typography variant="body2" fontWeight="700" color="text.secondary">{item.name}</Typography>
                    <Typography variant="h6" fontWeight="900" color="primary.main">{item.value}</Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>
      )}
    </Grid>
  );
};

export default DashboardAnalytics;
