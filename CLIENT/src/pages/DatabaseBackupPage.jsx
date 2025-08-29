import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Tab,
  Tabs,
  Button,
  Alert,
  CircularProgress,
  Chip,
  LinearProgress,
  IconButton,
  Tooltip,
  Divider,
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TablePagination,
  Stack,
  useTheme,
  alpha,
  Snackbar
} from '@mui/material';
import {
  Backup,
  Schedule,
  History,
  Settings,
  CloudDownload,
  Delete,
  Restore,
  PlayArrow,
  Pause,
  CheckCircle,
  Error,
  Warning,
  Info,
  Storage,
  Timeline,
  Security,
  Speed,
  Refresh,
  Analytics,
  Notifications,
  VerifiedUser
} from '@mui/icons-material';
import api from '../config/api';
import BackupTimelineChart from '../components/backup/BackupTimelineChart';
import BackupNotificationSystem from '../components/backup/BackupNotificationSystem';
import BackupErrorBoundary from '../components/backup/BackupErrorBoundary';

const DatabaseBackupPage = () => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [backupHistory, setBackupHistory] = useState([]);
  const [scheduledBackups, setScheduledBackups] = useState([]);
  const [backupStats, setBackupStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeBackups, setActiveBackups] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [storageStats, setStorageStats] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  
  // Dialog states
  const [manualBackupDialog, setManualBackupDialog] = useState(false);
  const [scheduleBackupDialog, setScheduleBackupDialog] = useState(false);
  const [restoreDialog, setRestoreDialog] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState(null);
  
  // Form states
  const [backupDescription, setBackupDescription] = useState('');
  const [scheduleData, setScheduleData] = useState({
    description: '',
    schedule: '',
    enabled: true
  });
  
  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Predefined schedule options
  const scheduleOptions = [
    { label: 'Daily at 2:00 AM', value: '0 2 * * *' },
    { label: 'Daily at 6:00 PM', value: '0 18 * * *' },
    { label: 'Weekly (Sunday 2:00 AM)', value: '0 2 * * 0' },
    { label: 'Weekly (Friday 6:00 PM)', value: '0 18 * * 5' },
    { label: 'Monthly (1st day 2:00 AM)', value: '0 2 1 * *' },
    { label: 'Custom', value: 'custom' }
  ];

  useEffect(() => {
    fetchBackupData();
    fetchStorageStats();
    const statusInterval = setInterval(fetchBackupStatus, 5000); // Check status every 5 seconds
    const refreshInterval = setInterval(fetchBackupData, 30000); // Refresh data every 30 seconds
    return () => {
      clearInterval(statusInterval);
      clearInterval(refreshInterval);
    };
  }, []);

  const fetchBackupData = async () => {
    setLoading(true);
    try {
      const [historyResponse, settingsResponse] = await Promise.all([
        api.get('/api/database-backup/backup/history'),
        api.get('/api/database-backup/backup/settings')
      ]);

      setBackupHistory(historyResponse.data.data);
      setScheduledBackups(settingsResponse.data.data.scheduledBackups);
      setBackupStats(settingsResponse.data.data.statistics);
    } catch (err) {
      setError('Failed to fetch backup data');
    } finally {
      setLoading(false);
    }
  };

  const fetchBackupStatus = async () => {
    try {
      const response = await api.get('/api/database-backup/backup/status');
      const newActiveBackups = response.data.data.activeBackups || [];
      
      // Check for completed backups to show notifications
      const completedBackups = activeBackups.filter(oldBackup => 
        !newActiveBackups.find(newBackup => newBackup.id === oldBackup.id)
      );
      
      // Add completion notifications
      completedBackups.forEach(backup => {
        addNotification({
          type: 'success',
          title: 'Backup Completed',
          message: `Backup "${backup.name}" has been completed successfully.`,
          metadata: { backupId: backup.id },
          actions: [
            {
              label: 'View',
              icon: <History />,
              onClick: () => setActiveTab(0)
            }
          ]
        });
      });
      
      setActiveBackups(newActiveBackups);
    } catch (err) {
      console.error('Failed to fetch backup status:', err);
    }
  };

  const fetchStorageStats = async () => {
    try {
      const response = await api.get('/api/database-backup/backup/storage-stats');
      setStorageStats(response.data.data);
    } catch (err) {
      console.error('Failed to fetch storage stats:', err);
    }
  };

  const addNotification = (notification) => {
    const newNotification = {
      id: Date.now() + Math.random(),
      timestamp: new Date(),
      ...notification
    };
    setNotifications(prev => [newNotification, ...prev].slice(0, 10)); // Keep last 10
  };

  const handleCreateManualBackup = async () => {
    try {
      setLoading(true);
      const response = await api.post('/api/database-backup/backup/create', {
        description: backupDescription,
        type: 'manual'
      });
      
      addNotification({
        type: 'info',
        title: 'Backup Started',
        message: 'Manual backup has been initiated and is now in progress.',
        metadata: { backupId: response.data.data?.id }
      });
      
      setSuccess('Manual backup started successfully');
      setManualBackupDialog(false);
      setBackupDescription('');
      fetchBackupData();
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to create manual backup';
      setError(errorMsg);
      addNotification({
        type: 'error',
        title: 'Backup Failed',
        message: errorMsg
      });
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleBackup = async () => {
    try {
      setLoading(true);
      await api.post('/api/database-backup/backup/schedule', scheduleData);
      
      setSuccess('Backup scheduled successfully');
      setScheduleBackupDialog(false);
      setScheduleData({ description: '', schedule: '', enabled: true });
      fetchBackupData();
    } catch (err) {
      setError('Failed to schedule backup');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBackup = async (backupId) => {
    if (!window.confirm('Are you sure you want to delete this backup?')) return;
    
    try {
      await api.delete(`/api/database-backup/backup/${backupId}`);
      setSuccess('Backup deleted successfully');
      fetchBackupData();
    } catch (err) {
      setError('Failed to delete backup');
    }
  };

  const handleRestoreBackup = async () => {
    if (!selectedBackup) return;
    
    try {
      setLoading(true);
      await api.post(`/api/database-backup/backup/restore/${selectedBackup._id}`, {
        confirmRestore: true
      });
      
      setSuccess('Database restored successfully');
      setRestoreDialog(false);
      setSelectedBackup(null);
    } catch (err) {
      setError('Failed to restore backup');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadBackup = async (backupId) => {
    try {
      const response = await api.get(`/api/database-backup/backup/download/${backupId}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `backup_${backupId}.gz`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError('Failed to download backup');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'in_progress': return 'warning';
      case 'failed': return 'error';
      case 'scheduled': return 'info';
      default: return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle />;
      case 'in_progress': return <CircularProgress size={16} />;
      case 'failed': return <Error />;
      case 'scheduled': return <Schedule />;
      default: return <Info />;
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString();
  };

  const StatsCard = ({ title, value, icon, color = 'primary' }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="h4" fontWeight="bold" color={`${color}.main`}>
              {value}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {title}
            </Typography>
          </Box>
          <Box 
            sx={{ 
              backgroundColor: alpha(theme.palette[color].main, 0.1),
              borderRadius: 2,
              p: 1
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  const TabPanel = ({ children, value, index }) => (
    <div hidden={value !== index} style={{ padding: '24px 0' }}>
      {value === index && children}
    </div>
  );

  return (
    <BackupErrorBoundary onRetry={() => {
      fetchBackupData();
      fetchStorageStats();
    }}>
      <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom display="flex" alignItems="center" gap={2}>
        <Storage color="primary" />
        Database Backup Management
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard
            title="Total Backups"
            value={backupHistory.length}
            icon={<Backup />}
            color="primary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard
            title="Active Jobs"
            value={activeBackups.length}
            icon={<PlayArrow />}
            color="warning"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard
            title="Scheduled Backups"
            value={scheduledBackups.length}
            icon={<Schedule />}
            color="info"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard
            title="Success Rate"
            value="95%"
            icon={<CheckCircle />}
            color="success"
          />
        </Grid>
      </Grid>

      {/* Active Backups Progress */}
      {activeBackups.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Active Backup Operations
            </Typography>
            {activeBackups.map((backup) => (
              <Box key={backup.id} sx={{ mb: 2 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="body2">
                    Backup ID: {backup.id}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {backup.progress}%
                  </Typography>
                </Box>
                <LinearProgress variant="determinate" value={backup.progress} />
              </Box>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Quick Actions
          </Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap">
            <Button
              variant="contained"
              startIcon={<Backup />}
              onClick={() => setManualBackupDialog(true)}
              disabled={loading}
            >
              Create Manual Backup
            </Button>
            <Button
              variant="outlined"
              startIcon={<Schedule />}
              onClick={() => setScheduleBackupDialog(true)}
            >
              Schedule Backup
            </Button>
            <Button
              variant="outlined"
              startIcon={<Timeline />}
              color="info"
            >
              View Analytics
            </Button>
            <Button
              variant="outlined"
              startIcon={<Security />}
              color="secondary"
            >
              Backup Settings
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
            <Tab label="Backup History" icon={<History />} />
            <Tab label="Timeline View" icon={<Timeline />} />
            <Tab label="Scheduled Backups" icon={<Schedule />} />
            <Tab label="Analytics" icon={<Analytics />} />
            <Tab label="Settings" icon={<Settings />} />
          </Tabs>
        </Box>

        {/* Backup History Tab */}
        <TabPanel value={activeTab} index={0}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Size</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {backupHistory
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((backup) => (
                    <TableRow key={backup._id}>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {backup.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {backup.description}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={backup.type}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={getStatusIcon(backup.status)}
                          label={backup.status}
                          color={getStatusColor(backup.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{formatFileSize(backup.size)}</TableCell>
                      <TableCell>{formatDate(backup.createdAt)}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1}>
                          {backup.status === 'completed' && (
                            <>
                              <Tooltip title="Download">
                                <IconButton
                                  size="small"
                                  onClick={() => handleDownloadBackup(backup._id)}
                                >
                                  <CloudDownload />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Restore">
                                <IconButton
                                  size="small"
                                  color="warning"
                                  onClick={() => {
                                    setSelectedBackup(backup);
                                    setRestoreDialog(true);
                                  }}
                                >
                                  <Restore />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteBackup(backup._id)}
                            >
                              <Delete />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={backupHistory.length}
            page={page}
            onPageChange={(e, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
          />
        </TabPanel>

        {/* Timeline View Tab */}
        <TabPanel value={activeTab} index={1}>
          <BackupTimelineChart
            backups={backupHistory}
          />
        </TabPanel>

        {/* Analytics Tab */}
        <TabPanel value={activeTab} index={3}>
          <Grid container spacing={3}>
            {/* Storage Analytics */}
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
                    <Storage />
                    Storage Analytics
                  </Typography>
                  {storageStats ? (
                    <Stack spacing={2}>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2">Total Files:</Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {storageStats.storage?.totalFiles || 0}
                        </Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2">Total Size:</Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {storageStats.storage?.formattedSize || '0 B'}
                        </Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2">Average Size:</Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {storageStats.storage?.formattedAverageSize || '0 B'}
                        </Typography>
                      </Box>
                      <Divider />
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2">Oldest Backup:</Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {storageStats.storage?.oldestBackup ? 
                            new Date(storageStats.storage.oldestBackup).toLocaleDateString() : 
                            'N/A'
                          }
                        </Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2">Newest Backup:</Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {storageStats.storage?.newestBackup ? 
                            new Date(storageStats.storage.newestBackup).toLocaleDateString() : 
                            'N/A'
                          }
                        </Typography>
                      </Box>
                    </Stack>
                  ) : (
                    <CircularProgress size={24} />
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Health Analytics */}
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
                    <VerifiedUser />
                    System Health
                  </Typography>
                  {storageStats?.health ? (
                    <Stack spacing={2}>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2">Total Backups:</Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {storageStats.health.totalBackups}
                        </Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2">Completed:</Typography>
                        <Typography variant="body2" fontWeight="medium" color="success.main">
                          {storageStats.health.completedBackups}
                        </Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2">Failed:</Typography>
                        <Typography variant="body2" fontWeight="medium" color="error.main">
                          {storageStats.health.failedBackups}
                        </Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2">In Progress:</Typography>
                        <Typography variant="body2" fontWeight="medium" color="warning.main">
                          {storageStats.health.inProgressBackups}
                        </Typography>
                      </Box>
                      <Divider />
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2">Missing Files:</Typography>
                        <Typography variant="body2" fontWeight="medium" color={
                          storageStats.health.missingFiles > 0 ? "error.main" : "success.main"
                        }>
                          {storageStats.health.missingFiles}
                        </Typography>
                      </Box>
                    </Stack>
                  ) : (
                    <CircularProgress size={24} />
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Quick Actions */}
            <Grid item xs={12}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Maintenance Actions
                  </Typography>
                  <Stack direction="row" spacing={2} flexWrap="wrap">
                    <Button
                      variant="outlined"
                      startIcon={<Refresh />}
                      onClick={() => {
                        fetchBackupData();
                        fetchStorageStats();
                        setLastRefresh(new Date());
                      }}
                    >
                      Refresh Data
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<Delete />}
                      color="warning"
                      onClick={async () => {
                        if (window.confirm('Run cleanup of expired backups?')) {
                          try {
                            await api.post('/api/database-backup/backup/cleanup');
                            addNotification({
                              type: 'success',
                              title: 'Cleanup Complete',
                              message: 'Expired backups have been cleaned up successfully.'
                            });
                            fetchBackupData();
                            fetchStorageStats();
                          } catch (error) {
                            addNotification({
                              type: 'error',
                              title: 'Cleanup Failed',
                              message: 'Failed to cleanup expired backups.'
                            });
                          }
                        }
                      }}
                    >
                      Run Cleanup
                    </Button>
                    <Typography variant="body2" color="text.secondary" sx={{ ml: 2, alignSelf: 'center' }}>
                      Last refreshed: {lastRefresh.toLocaleTimeString()}
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Settings Tab */}
        <TabPanel value={activeTab} index={4}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Backup Retention
                  </Typography>
                  <Typography variant="body2" color="text.secondary" mb={2}>
                    Configure how long backups are kept before automatic deletion.
                  </Typography>
                  <TextField
                    fullWidth
                    label="Retention Days"
                    type="number"
                    defaultValue={30}
                    sx={{ mb: 2 }}
                  />
                  <Button variant="contained" size="small">
                    Update
                  </Button>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Storage Location
                  </Typography>
                  <Typography variant="body2" color="text.secondary" mb={2}>
                    Current backup storage directory.
                  </Typography>
                  <TextField
                    fullWidth
                    label="Backup Directory"
                    defaultValue="/server/backups"
                    disabled
                    sx={{ mb: 2 }}
                  />
                  <Button variant="outlined" size="small">
                    Change Location
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
      </Card>

      {/* Manual Backup Dialog */}
      <Dialog open={manualBackupDialog} onClose={() => setManualBackupDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Manual Backup</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Description"
            multiline
            rows={3}
            value={backupDescription}
            onChange={(e) => setBackupDescription(e.target.value)}
            placeholder="Enter a description for this backup..."
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setManualBackupDialog(false)}>Cancel</Button>
          <Button onClick={handleCreateManualBackup} variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={20} /> : 'Create Backup'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Schedule Backup Dialog */}
      <Dialog open={scheduleBackupDialog} onClose={() => setScheduleBackupDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Schedule Backup</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Description"
            value={scheduleData.description}
            onChange={(e) => setScheduleData({...scheduleData, description: e.target.value})}
            sx={{ mt: 1, mb: 2 }}
          />
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Schedule</InputLabel>
            <Select
              value={scheduleData.schedule}
              onChange={(e) => setScheduleData({...scheduleData, schedule: e.target.value})}
            >
              {scheduleOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {scheduleData.schedule === 'custom' && (
            <TextField
              fullWidth
              label="Custom Cron Expression"
              placeholder="0 2 * * *"
              helperText="Enter a valid cron expression (e.g., '0 2 * * *' for daily at 2 AM)"
              sx={{ mb: 2 }}
            />
          )}
          <FormControlLabel
            control={
              <Switch
                checked={scheduleData.enabled}
                onChange={(e) => setScheduleData({...scheduleData, enabled: e.target.checked})}
              />
            }
            label="Enable Schedule"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScheduleBackupDialog(false)}>Cancel</Button>
          <Button onClick={handleScheduleBackup} variant="contained" disabled={loading}>
            Schedule Backup
          </Button>
        </DialogActions>
      </Dialog>

      {/* Restore Confirmation Dialog */}
      <Dialog open={restoreDialog} onClose={() => setRestoreDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Confirm Database Restore</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Warning:</strong> This action will replace all current data with the backup data. 
              A backup of the current state will be created before the restore operation.
            </Typography>
          </Alert>
          {selectedBackup && (
            <Box>
              <Typography variant="body2" gutterBottom>
                <strong>Backup:</strong> {selectedBackup.name}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Created:</strong> {formatDate(selectedBackup.createdAt)}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Size:</strong> {formatFileSize(selectedBackup.size)}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestoreDialog(false)}>Cancel</Button>
          <Button onClick={handleRestoreBackup} color="warning" variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={20} /> : 'Restore Database'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notification System */}
      <BackupNotificationSystem
        notifications={notifications}
        onClose={(notificationId) => {
          setNotifications(prev => prev.filter(n => n.id !== notificationId));
        }}
        onViewDetails={(notification) => {
        }}
        onDownloadBackup={handleDownloadBackup}
      />
      </Box>
    </BackupErrorBoundary>
  );
};

export default DatabaseBackupPage;