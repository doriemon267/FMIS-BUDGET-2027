/**
 * Dashboard Analytics Component
 * Shows trends, charts, and data visualization using @mui/x-charts
 */

import {
  Box,
  Paper,
  Typography,
  Grid,
  Stack,
  alpha,
  useTheme
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PieChartIcon from '@mui/icons-material/PieChart';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import InboxIcon from '@mui/icons-material/Inbox';

import { BarChart } from '@mui/x-charts/BarChart';
import { PieChart, pieArcLabelClasses } from '@mui/x-charts/PieChart';

const DashboardAnalytics = ({ data = {} }) => {
  const theme = useTheme();
  const { trends = [], statusDistribution = [], budgetTypeDistribution = [] } = data;

  const COLORS = {
    primary: '#60a561',
    success: '#6a994e',
    warning: '#f48c06',
    info: '#0077b6',
    error: '#d00000',
    legacy: '#8d99ae',
    newWork: '#2b2d42',
  };

  const statusColors = [COLORS.warning, COLORS.success, COLORS.error, COLORS.info, COLORS.primary];

  // Helper for empty states
  const hasTrends = trends.some(t => t.total > 0);
  const hasStatus = statusDistribution.some(s => s.value > 0);

  return (
    <Grid container spacing={4}>
      {/* Trends Summary (Bar Chart) */}
      <Grid item xs={12} md={7}>
        <Paper elevation={0} sx={{ p: 3, border: `1px solid ${alpha(theme.palette.divider, 0.1)}`, borderRadius: 4, height: '100%', minHeight: 380 }}>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 4 }}>
            <TrendingUpIcon sx={{ color: COLORS.primary }} />
            <Typography variant="h6" fontWeight="800">Proposal Trends Summary</Typography>
          </Stack>
          
          <Box sx={{ width: '100%', height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {hasTrends ? (
              <BarChart
                dataset={trends}
                xAxis={[{ scaleType: 'band', dataKey: 'date' }]}
                series={[
                  { dataKey: 'total', label: 'Total', color: alpha(COLORS.info, 0.7) },
                  { dataKey: 'approved', label: 'Approved', color: COLORS.success },
                  { dataKey: 'pending', label: 'Pending', color: COLORS.warning },
                ]}
                slotProps={{
                  legend: {
                    direction: 'row',
                    position: { vertical: 'bottom', horizontal: 'middle' },
                    padding: 0,
                  }
                }}
                margin={{ top: 20, bottom: 60, left: 40, right: 20 }}
                height={300}
                borderRadius={6}
              />
            ) : (
              <Box sx={{ textAlign: 'center', opacity: 0.5 }}>
                <InboxIcon sx={{ fontSize: 48, mb: 1, color: 'text.disabled' }} />
                <Typography variant="body2">No trend data available for the current period.</Typography>
              </Box>
            )}
          </Box>
        </Paper>
      </Grid>

      {/* Status Distribution (Donut Chart) */}
      <Grid item xs={12} md={5}>
        <Paper elevation={0} sx={{ p: 3, border: `1px solid ${alpha(theme.palette.divider, 0.1)}`, borderRadius: 4, height: '100%', minHeight: 380 }}>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 4 }}>
            <PieChartIcon sx={{ color: COLORS.primary }} />
            <Typography variant="h6" fontWeight="800">Status Metrics</Typography>
          </Stack>
          
          <Box sx={{ width: '100%', height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {hasStatus ? (
              <PieChart
                series={[
                  {
                    data: statusDistribution.map((item, idx) => ({
                      id: idx,
                      value: item.value,
                      label: item.name,
                      color: statusColors[idx % statusColors.length]
                    })).filter(item => item.value > 0),
                    innerRadius: 65,
                    outerRadius: 110,
                    paddingAngle: 4,
                    cornerRadius: 6,
                    highlightScope: { faded: 'global', highlighted: 'item' },
                    faded: { innerRadius: 30, additionalRadius: -30, color: 'gray' },
                    arcLabel: (item) => `${item.value}`,
                    arcLabelMinAngle: 20,
                  },
                ]}
                sx={{
                  [`& .${pieArcLabelClasses.root}`]: {
                    fill: 'white',
                    fontWeight: 'bold',
                    fontSize: 14,
                  },
                }}
                slotProps={{
                  legend: {
                    direction: 'column',
                    position: { vertical: 'middle', horizontal: 'right' },
                    padding: 0,
                    labelStyle: {
                      fontSize: 12,
                      fontWeight: 600,
                      fill: theme.palette.text.primary,
                    }
                  }
                }}
                margin={{ right: 140, top: 20, bottom: 20, left: 20 }}
                height={300}
              />
            ) : (
              <Box sx={{ textAlign: 'center', opacity: 0.5 }}>
                <InboxIcon sx={{ fontSize: 48, mb: 1, color: 'text.disabled' }} />
                <Typography variant="body2">No status data to display.</Typography>
              </Box>
            )}
          </Box>
        </Paper>
      </Grid>

      {/* Budget Type Distribution (Horizontal Bar Chart) */}
      {budgetTypeDistribution.length > 0 && (
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ p: 3, border: `1px solid ${alpha(theme.palette.divider, 0.1)}`, borderRadius: 4 }}>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
              <AccountTreeIcon sx={{ color: COLORS.primary }} />
              <Typography variant="h6" fontWeight="800">Budget Classification Workflow</Typography>
            </Stack>
            
            <Box sx={{ width: '100%', height: 250 }}>
              <BarChart
                dataset={budgetTypeDistribution}
                yAxis={[{ scaleType: 'band', dataKey: 'name', categoryGapRatio: 0.5 }]}
                series={[
                  { 
                    dataKey: 'value', 
                    label: 'Proposals Count',
                    color: COLORS.primary,
                  }
                ]}
                layout="horizontal"
                margin={{ left: 120, top: 20, bottom: 40, right: 20 }}
                height={250}
                borderRadius={4}
                slotProps={{
                  legend: { hidden: true }
                }}
              />
            </Box>
          </Paper>
        </Grid>
      )}
    </Grid>
  );
};

export default DashboardAnalytics;

