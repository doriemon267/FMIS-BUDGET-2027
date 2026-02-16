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
} from '@mui/material';
// Charts - using simple visualization (recharts can be added if needed)
// For now, showing data in table format
// import {
//   LineChart,
//   Line,
//   BarChart,
//   Bar,
//   PieChart,
//   Pie,
//   Cell,
//   XAxis,
//   YAxis,
//   CartesianGrid,
//   Tooltip,
//   Legend,
//   ResponsiveContainer,
// } from 'recharts';

const DashboardAnalytics = ({ data = {} }) => {
  const { trends = [], statusDistribution = [], budgetTypeDistribution = [] } = data;

  const COLORS = ['#264524', '#375e38', '#2e7d32', '#4caf50', '#81c784'];

  return (
    <Grid container spacing={3}>
      {/* Trends Table */}
      {trends.length > 0 && (
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Proposal Trends Over Time
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Chart visualization can be added with recharts library. Showing data summary:
              </Typography>
              <Box sx={{ mt: 2 }}>
                {trends.map((trend, index) => (
                  <Box key={index} sx={{ mb: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Typography variant="body2">
                      {trend.date}: Total: {trend.total}, Approved: {trend.approved}, Pending: {trend.pending}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </Paper>
        </Grid>
      )}

      {/* Status Distribution */}
      {statusDistribution.length > 0 && (
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Status Distribution
            </Typography>
            <Box sx={{ mt: 2 }}>
              {statusDistribution.map((item, index) => (
                <Box key={index} sx={{ mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">{item.name}</Typography>
                  <Chip label={item.value} size="small" sx={{ bgcolor: COLORS[index % COLORS.length], color: 'white' }} />
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>
      )}

      {/* Budget Type Distribution */}
      {budgetTypeDistribution.length > 0 && (
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Budget Type Distribution
            </Typography>
            <Box sx={{ mt: 2 }}>
              {budgetTypeDistribution.map((item, index) => (
                <Box key={index} sx={{ mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="body2" fontWeight="medium">{item.name}</Typography>
                  <Typography variant="body2" fontWeight="bold">{item.value}</Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>
      )}
    </Grid>
  );
};

export default DashboardAnalytics;
