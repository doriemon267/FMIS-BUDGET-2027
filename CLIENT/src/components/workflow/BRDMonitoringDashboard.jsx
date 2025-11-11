import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Stack,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tab,
  Tabs,
  Tooltip,
  IconButton
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Visibility as VisibilityIcon,
  MoreVert as MoreVertIcon,
  TrendingUp as TrendingUpIcon,
  Timeline as TimelineIcon
} from '@mui/icons-material';
import api from '../../config/api';
import { toast } from 'react-toastify';

const BRDMonitoringDashboard = () => {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [tabValue, setTabValue] = useState(0);
  
  const [filters, setFilters] = useState({
    region: 'ALL',
    status: 'ALL',
    searchTerm: '',
    fiscalYear: 'ALL'
  });

  const [statistics, setStatistics] = useState({
    totalProposals: 0,
    byStatus: [],
    byRegion: [],
    byRole: []
  });

  const [selectedProposal, setSelectedProposal] = useState(null);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [proposalHistory, setProposalHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const statusColors = {
    'Draft': { bg: '#f0f4f8', text: '#1a365d', icon: '📝' },
    'Forwarded to Reviewer': { bg: '#e6f2ff', text: '#003d8f', icon: '📤' },
    'Forwarded to Approver': { bg: '#e8d5ff', text: '#44337a', icon: '📮' },
    'Forwarded to Analyst': { bg: '#fef3c7', text: '#92400e', icon: '🔍' },
    'Forwarded to Officer': { bg: '#dbeafe', text: '#0c4a6e', icon: '📬' },
    'Forwarded to Manager': { bg: '#ddd6fe', text: '#4c1d95', icon: '🚀' },
    'Finalized': { bg: '#dcfce7', text: '#15803d', icon: '✅' },
    'Returned': { bg: '#fee2e2', text: '#7f1d1d', icon: '↩️' }
  };

  const fetchProposals = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.region !== 'ALL') params.append('region', filters.region);
      if (filters.status !== 'ALL') params.append('status', filters.status);
      if (filters.searchTerm) params.append('search', filters.searchTerm);
      if (filters.fiscalYear !== 'ALL') params.append('fiscalYear', filters.fiscalYear);

      const response = await api.get(`/api/workflow/brd-dashboard?${params.toString()}`);
      const data = response.data;

      setProposals(data.proposals || []);
      setStatistics({
        totalProposals: data.statistics?.totalProposals || 0,
        byStatus: data.statistics?.byStatus || [],
        byRegion: data.statistics?.byRegion || [],
        byRole: data.statistics?.byRole || []
      });
    } catch (error) {
      console.error('Failed to fetch proposals:', error);
      toast.error('Failed to load proposals');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  const fetchProposalHistory = async (proposalId) => {
    setHistoryLoading(true);
    try {
      const response = await api.get(`/api/workflow/history/${proposalId}`);
      setProposalHistory(response.data.history || []);
      setHistoryDialogOpen(true);
    } catch (error) {
      console.error('Failed to fetch history:', error);
      toast.error('Failed to load proposal history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleOpenHistory = (proposal) => {
    setSelectedProposal(proposal);
    fetchProposalHistory(proposal._id);
  };

  const handleCloseHistory = () => {
    setHistoryDialogOpen(false);
    setSelectedProposal(null);
    setProposalHistory([]);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
    setPage(0);
  };

  const getStatusColor = (status) => {
    return statusColors[status] || { bg: '#f3f4f6', text: '#374151', icon: '❓' };
  };

  const StatisticCard = ({ title, value, icon, color = 'primary' }) => (
    <Card sx={{ bgcolor: 'background.paper', boxShadow: 1 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography color="textSecondary" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 'bold', color }}>
              {value}
            </Typography>
          </Box>
          <Box sx={{ fontSize: '2rem', opacity: 0.3 }}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ p: 3, bgcolor: '#f8f9fa', minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
          📊 BRD Monitoring Dashboard
        </Typography>
        <Typography color="textSecondary">
          Real-time visibility of all budget proposals across the organization
        </Typography>
      </Box>

      {/* Statistics Overview */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatisticCard
            title="Total Proposals"
            value={statistics.totalProposals}
            icon="📋"
            color="#1976d2"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatisticCard
            title="In Progress"
            value={
              statistics.byStatus
                .filter(s => !['Finalized', 'Returned'].includes(s._id))
                .reduce((sum, s) => sum + s.count, 0)
            }
            icon="⏳"
            color="#f57c00"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatisticCard
            title="Finalized"
            value={
              statistics.byStatus
                .find(s => s._id === 'Finalized')?.count || 0
            }
            icon="✅"
            color="#388e3c"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatisticCard
            title="Returned"
            value={
              statistics.byStatus
                .find(s => s._id === 'Returned')?.count || 0
            }
            icon="↩️"
            color="#d32f2f"
          />
        </Grid>
      </Grid>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab label="📋 Proposals" />
          <Tab label="📊 Statistics" />
          <Tab label="📈 Trends" />
        </Tabs>
      </Paper>

      {/* Proposals Tab */}
      {tabValue === 0 && (
        <Paper sx={{ p: 2 }}>
          {/* Filters */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search proposals..."
                value={filters.searchTerm}
                onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.active' }} />
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Region</InputLabel>
                <Select
                  value={filters.region}
                  label="Region"
                  onChange={(e) => handleFilterChange('region', e.target.value)}
                >
                  <MenuItem value="ALL">All Regions</MenuItem>
                  {Array.from(new Set(statistics.byRegion?.map(r => r._id) || []))
                    .sort()
                    .map(region => (
                      <MenuItem key={region} value={region}>
                        {region}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status}
                  label="Status"
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                >
                  <MenuItem value="ALL">All Statuses</MenuItem>
                  {Array.from(new Set(statistics.byStatus?.map(s => s._id) || []))
                    .sort()
                    .map(status => (
                      <MenuItem key={status} value={status}>
                        {status}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Tooltip title="Refresh data">
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={() => fetchProposals()}
                  disabled={loading}
                >
                  Refresh
                </Button>
              </Tooltip>
            </Grid>
          </Grid>

          {/* Proposals Table */}
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : proposals.length === 0 ? (
            <Alert severity="info">No proposals found matching your filters</Alert>
          ) : (
            <>
              <TableContainer>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Proposal ID</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Title</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Region</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Current Role</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Last Updated</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {proposals
                      .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                      .map(proposal => {
                        const statusColor = getStatusColor(proposal.status);
                        return (
                          <TableRow key={proposal._id} hover>
                            <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                              {proposal._id?.slice(-8).toUpperCase()}
                            </TableCell>
                            <TableCell sx={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              <Tooltip title={proposal.title}>
                                <span>{proposal.title}</span>
                              </Tooltip>
                            </TableCell>
                            <TableCell>{proposal.region || 'Central Office'}</TableCell>
                            <TableCell>
                              <Chip
                                icon={<span>{statusColor.icon}</span>}
                                label={proposal.status}
                                size="small"
                                sx={{
                                  bgcolor: statusColor.bg,
                                  color: statusColor.text,
                                  fontWeight: 600
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                {proposal.currentAssigneeRole || 'N/A'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              {new Date(proposal.lastActionDate).toLocaleDateString()}
                            </TableCell>
                            <TableCell align="center">
                              <Tooltip title="View History">
                                <IconButton
                                  size="small"
                                  onClick={() => handleOpenHistory(proposal)}
                                >
                                  <VisibilityIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                rowsPerPageOptions={[5, 10, 25, 50]}
                component="div"
                count={proposals.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
              />
            </>
          )}
        </Paper>
      )}

      {/* Statistics Tab */}
      {tabValue === 1 && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                📊 Status Distribution
              </Typography>
              <Stack spacing={1}>
                {statistics.byStatus.map(stat => (
                  <Box key={stat._id} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ minWidth: '100px' }}>{stat._id}</Box>
                    <Box
                      sx={{
                        flex: 1,
                        height: '24px',
                        bgcolor: '#e0e0e0',
                        borderRadius: 1,
                        overflow: 'hidden'
                      }}
                    >
                      <Box
                        sx={{
                          height: '100%',
                          width: `${(stat.count / statistics.totalProposals) * 100}%`,
                          bgcolor: getStatusColor(stat._id).bg,
                          transition: 'width 0.3s'
                        }}
                      />
                    </Box>
                    <Typography sx={{ minWidth: '50px', textAlign: 'right', fontWeight: 'bold' }}>
                      {stat.count}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                🗺️ Regional Distribution
              </Typography>
              <Stack spacing={1}>
                {statistics.byRegion.map(stat => (
                  <Box key={stat._id} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ minWidth: '100px' }}>{stat._id}</Box>
                    <Box
                      sx={{
                        flex: 1,
                        height: '24px',
                        bgcolor: '#e0e0e0',
                        borderRadius: 1,
                        overflow: 'hidden'
                      }}
                    >
                      <Box
                        sx={{
                          height: '100%',
                          width: `${(stat.count / statistics.totalProposals) * 100}%`,
                          bgcolor: '#2196f3',
                          transition: 'width 0.3s'
                        }}
                      />
                    </Box>
                    <Typography sx={{ minWidth: '50px', textAlign: 'right', fontWeight: 'bold' }}>
                      {stat.count}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* History Dialog */}
      <Dialog
        open={historyDialogOpen}
        onClose={handleCloseHistory}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Workflow History - {selectedProposal?.title}
        </DialogTitle>
        <DialogContent>
          {historyLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : proposalHistory.length === 0 ? (
            <Alert severity="info">No history available</Alert>
          ) : (
            <Stack spacing={2} sx={{ mt: 2 }}>
              {proposalHistory.map((item, index) => (
                <Card key={index} sx={{ bgcolor: '#f5f5f5' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                        {item.action}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {new Date(item.timestamp).toLocaleString()}
                      </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>By:</strong> {item.userName || item.userId}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Status Change:</strong> {item.previousStatus} → {item.newStatus}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Comment:</strong> {item.comment}
                    </Typography>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseHistory}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BRDMonitoringDashboard;
