import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  Card,
  CardContent,
  Typography,
  Switch,
  FormControlLabel,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Box,
  Chip,
  CircularProgress,
  LinearProgress,
  IconButton,
  Tooltip,
  Stack,
  Divider
} from '@mui/material';
import {
  Storage,
  Schedule,
  Backup,
  CloudDownload,
  Delete,
  CheckCircle,
  Error,
  Warning,
  PlayArrow,
  Close
} from '@mui/icons-material';
import api from '../../config/api';

const DatabaseBackupSettingsDialog = ({ open, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [backupSettings, setBackupSettings] = useState({
    autoBackupEnabled: false,
    backupSchedule: '0 2 * * *', // Daily at 2 AM
    retentionDays: 30,
    maxBackups: 10,
    compressionEnabled: true
  });
  const [recentBackups, setRecentBackups] = useState([]);
  const [activeBackups, setActiveBackups] = useState([]);
  const [manualBackupDescription, setManualBackupDescription] = useState('');

  const scheduleOptions = [
    { label: 'Daily at 2:00 AM', value: '0 2 * * *' },
    { label: 'Daily at 6:00 PM', value: '0 18 * * *' },
    { label: 'Every 12 hours', value: '0 */12 * * *' },
    { label: 'Weekly (Sunday 2:00 AM)', value: '0 2 * * 0' },
    { label: 'Weekly (Friday 6:00 PM)', value: '0 18 * * 5' },
    { label: 'Monthly (1st day 2:00 AM)', value: '0 2 1 * *' }
  ];

  useEffect(() => {
    if (open) {
      fetchBackupData();
      const interval = setInterval(fetchBackupStatus, 3000);
      return () => clearInterval(interval);
    }
  }, [open]);

  const fetchBackupData = async () => {
    try {
      setLoading(true);
      const [settingsResponse, historyResponse] = await Promise.all([
        api.get('/api/database-backup/backup/settings'),
        api.get('/api/database-backup/backup/history?limit=5')
      ]);

      // Set recent backups
      setRecentBackups(historyResponse.data.data || []);
      
      // Update settings if available
      const settings = settingsResponse.data.data;
      if (settings.scheduledBackups && settings.scheduledBackups.length > 0) {
        const firstScheduled = settings.scheduledBackups[0];
        setBackupSettings(prev => ({
          ...prev,
          autoBackupEnabled: firstScheduled.enabled,
          backupSchedule: firstScheduled.schedule || prev.backupSchedule
        }));
      }
    } catch (err) {
      console.error('Error fetching backup data:', err);
      setError('Failed to load backup settings');
    } finally {
      setLoading(false);
    }
  };

  const fetchBackupStatus = async () => {
    try {
      const response = await api.get('/api/database-backup/backup/status');
      setActiveBackups(response.data.data.activeBackups || []);
    } catch (err) {
      console.error('Failed to fetch backup status:', err);
    }
  };

  const handleCreateManualBackup = async () => {
    try {
      setLoading(true);
      await api.post('/api/database-backup/backup/create', {
        description: manualBackupDescription || `Manual backup created on ${new Date().toLocaleString()}`,
        type: 'manual'
      });
      
      setSuccess('Manual backup started successfully');
      setManualBackupDescription('');
      fetchBackupData();
    } catch (err) {
      setError('Failed to create manual backup');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateScheduleSettings = async () => {
    try {
      setLoading(true);
      
      if (backupSettings.autoBackupEnabled) {
        // Create or update scheduled backup
        await api.post('/api/database-backup/backup/schedule', {
          description: 'Automated backup schedule',
          schedule: backupSettings.backupSchedule,
          enabled: true
        });
      }
      
      setSuccess('Backup schedule updated successfully');
      fetchBackupData();
    } catch (err) {
      setError('Failed to update backup schedule');
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
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to download backup');
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'in_progress': return 'warning';
      case 'failed': return 'error';
      case 'scheduled': return 'info';
      default: return 'default';
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

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <Storage color="primary" />
            <Typography variant="h6">Database Backup Settings</Typography>
          </Box>
          <IconButton onClick={onClose}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent dividers>
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

        <Grid container spacing={3}>
          {/* Manual Backup Section */}
          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
                  <Backup />
                  Manual Backup
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Create an immediate backup of your database.
                </Typography>
                
                <TextField
                  fullWidth
                  label="Backup Description"
                  value={manualBackupDescription}
                  onChange={(e) => setManualBackupDescription(e.target.value)}
                  placeholder="Optional description for this backup"
                  sx={{ mb: 2 }}
                />
                
                <Button
                  variant="contained"
                  startIcon={loading ? <CircularProgress size={16} /> : <Backup />}
                  onClick={handleCreateManualBackup}
                  disabled={loading}
                  fullWidth
                >
                  Create Backup Now
                </Button>
              </CardContent>
            </Card>
          </Grid>

          {/* Scheduled Backup Section */}
          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
                  <Schedule />
                  Scheduled Backup
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Configure automatic backups on a schedule.
                </Typography>
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={backupSettings.autoBackupEnabled}
                      onChange={(e) => setBackupSettings(prev => ({
                        ...prev,
                        autoBackupEnabled: e.target.checked
                      }))}
                    />
                  }
                  label="Enable Automatic Backups"
                  sx={{ mb: 2 }}
                />
                
                {backupSettings.autoBackupEnabled && (
                  <>
                    <FormControl fullWidth sx={{ mb: 2 }}>
                      <InputLabel>Backup Schedule</InputLabel>
                      <Select
                        value={backupSettings.backupSchedule}
                        onChange={(e) => setBackupSettings(prev => ({
                          ...prev,
                          backupSchedule: e.target.value
                        }))}
                      >
                        {scheduleOptions.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    
                    <Button
                      variant="outlined"
                      onClick={handleUpdateScheduleSettings}
                      disabled={loading}
                      fullWidth
                    >
                      Update Schedule
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Active Backups Section */}
          {activeBackups.length > 0 && (
            <Grid item xs={12}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
                    <PlayArrow />
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
            </Grid>
          )}

          {/* Recent Backups Section */}
          <Grid item xs={12}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Recent Backups
                </Typography>
                {recentBackups.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No backups found. Create your first backup above.
                  </Typography>
                ) : (
                  <Stack spacing={2}>
                    {recentBackups.map((backup) => (
                      <Box
                        key={backup._id}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          p: 2,
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 1
                        }}
                      >
                        <Box>
                          <Typography variant="body1" fontWeight="medium">
                            {backup.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {backup.description}
                          </Typography>
                          <Box display="flex" alignItems="center" gap={1} mt={1}>
                            <Chip
                              label={backup.status}
                              color={getStatusColor(backup.status)}
                              size="small"
                            />
                            <Typography variant="caption">
                              {formatFileSize(backup.size)} • {formatDate(backup.createdAt)}
                            </Typography>
                          </Box>
                        </Box>
                        
                        <Stack direction="row" spacing={1}>
                          {backup.status === 'completed' && (
                            <Tooltip title="Download">
                              <IconButton
                                size="small"
                                onClick={() => handleDownloadBackup(backup._id)}
                              >
                                <CloudDownload />
                              </IconButton>
                            </Tooltip>
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
                      </Box>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Backup Settings Section */}
          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Retention Settings
                </Typography>
                <TextField
                  fullWidth
                  label="Retention Days"
                  type="number"
                  value={backupSettings.retentionDays}
                  onChange={(e) => setBackupSettings(prev => ({
                    ...prev,
                    retentionDays: parseInt(e.target.value)
                  }))}
                  helperText="Number of days to keep backups before automatic deletion"
                  sx={{ mb: 2 }}
                />
                <TextField
                  fullWidth
                  label="Maximum Backups"
                  type="number"
                  value={backupSettings.maxBackups}
                  onChange={(e) => setBackupSettings(prev => ({
                    ...prev,
                    maxBackups: parseInt(e.target.value)
                  }))}
                  helperText="Maximum number of backups to keep"
                />
              </CardContent>
            </Card>
          </Grid>

          {/* Storage Information */}
          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Storage Information
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Storage Location:</strong> /server/backups
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Total Backups:</strong> {recentBackups.length}
                </Typography>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  <strong>Compression:</strong> {backupSettings.compressionEnabled ? 'Enabled (gzip)' : 'Disabled'}
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={backupSettings.compressionEnabled}
                      onChange={(e) => setBackupSettings(prev => ({
                        ...prev,
                        compressionEnabled: e.target.checked
                      }))}
                    />
                  }
                  label="Enable Compression"
                />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button
          variant="contained"
          href="/database-backup"
          target="_blank"
          rel="noopener"
        >
          Open Advanced Settings
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DatabaseBackupSettingsDialog;