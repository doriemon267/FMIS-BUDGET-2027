import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Chip,
  Tooltip,
  IconButton,
  Stack,
  useTheme,
  alpha,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider
} from '@mui/material';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,
} from '@mui/lab';
import {
  CheckCircle,
  Error,
  Schedule,
  PlayArrow,
  CloudDownload,
  Delete,
  Visibility,
  ZoomIn,
  FilterList,
  TrendingUp,
  Storage,
  Speed
} from '@mui/icons-material';

// Helper functions moved outside component to avoid hoisting issues
const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

const formatDate = (date) => {
  return new Date(date).toLocaleString();
};

const formatDuration = (startDate, endDate) => {
  if (!endDate) return 'In Progress';
  const duration = (new Date(endDate) - new Date(startDate)) / 1000;
  if (duration < 60) return `${Math.round(duration)}s`;
  if (duration < 3600) return `${Math.floor(duration / 60)}m ${Math.round(duration % 60)}s`;
  return `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`;
};

const BackupTimelineChart = ({ backups = [], onSelectBackup, onDownload, onDelete }) => {
  const theme = useTheme();
  const [timeRange, setTimeRange] = useState(7); // days
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedBackup, setSelectedBackup] = useState(null);

  // Filter and process backup data
  const filteredBackups = useMemo(() => {
    const now = new Date();
    const rangeStart = new Date(now.getTime() - (timeRange * 24 * 60 * 60 * 1000));

    return backups
      .filter(backup => new Date(backup.createdAt) >= rangeStart)
      .filter(backup => statusFilter === 'all' || backup.status === statusFilter)
      .filter(backup => typeFilter === 'all' || backup.type === typeFilter)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [backups, timeRange, statusFilter, typeFilter]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = filteredBackups.length;
    const completed = filteredBackups.filter(b => b.status === 'completed').length;
    const failed = filteredBackups.filter(b => b.status === 'failed').length;
    const inProgress = filteredBackups.filter(b => b.status === 'in_progress').length;
    
    const totalSize = filteredBackups
      .filter(b => b.size)
      .reduce((sum, b) => sum + b.size, 0);

    const averageSize = total > 0 ? totalSize / total : 0;
    
    const successRate = total > 0 ? (completed / total) * 100 : 0;

    return {
      total,
      completed,
      failed,
      inProgress,
      totalSize: formatBytes(totalSize),
      averageSize: formatBytes(averageSize),
      successRate: successRate.toFixed(1) + '%'
    };
  }, [filteredBackups]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'failed': return 'error';
      case 'in_progress': return 'warning';
      case 'scheduled': return 'info';
      default: return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle />;
      case 'failed': return <Error />;
      case 'in_progress': return <PlayArrow />;
      case 'scheduled': return <Schedule />;
      default: return <Schedule />;
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'manual': return theme.palette.primary.main;
      case 'scheduled': return theme.palette.secondary.main;
      case 'pre_restore': return theme.palette.warning.main;
      default: return theme.palette.grey[500];
    }
  };

  const handleBackupClick = (backup) => {
    setSelectedBackup(backup);
    if (onSelectBackup) {
      onSelectBackup(backup);
    }
  };

  const StatCard = ({ title, value, icon, color = 'primary' }) => (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="h6" color={`${color}.main`} fontWeight="bold">
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

  return (
    <Box>
      {/* Controls */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Time Range</InputLabel>
              <Select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                label="Time Range"
              >
                <MenuItem value={1}>Last 24 Hours</MenuItem>
                <MenuItem value={7}>Last 7 Days</MenuItem>
                <MenuItem value={30}>Last 30 Days</MenuItem>
                <MenuItem value={90}>Last 3 Months</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                label="Status"
              >
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="failed">Failed</MenuItem>
                <MenuItem value="in_progress">In Progress</MenuItem>
                <MenuItem value="scheduled">Scheduled</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Type</InputLabel>
              <Select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                label="Type"
              >
                <MenuItem value="all">All Types</MenuItem>
                <MenuItem value="manual">Manual</MenuItem>
                <MenuItem value="scheduled">Scheduled</MenuItem>
                <MenuItem value="pre_restore">Pre-restore</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Typography variant="body2" color="text.secondary">
              Showing {filteredBackups.length} backups
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Statistics */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} md={3}>
          <StatCard
            title="Total Backups"
            value={stats.total}
            icon={<Storage />}
            color="primary"
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard
            title="Success Rate"
            value={stats.successRate}
            icon={<TrendingUp />}
            color="success"
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard
            title="Total Size"
            value={stats.totalSize}
            icon={<Storage />}
            color="info"
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard
            title="Average Size"
            value={stats.averageSize}
            icon={<Speed />}
            color="secondary"
          />
        </Grid>
      </Grid>

      {/* Timeline */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
            <Timeline />
            Backup Timeline
          </Typography>
          
          {filteredBackups.length === 0 ? (
            <Box textAlign="center" py={4}>
              <Typography variant="body1" color="text.secondary">
                No backups found for the selected criteria
              </Typography>
            </Box>
          ) : (
            <Timeline position="alternate">
              {filteredBackups.map((backup, index) => (
                <TimelineItem key={backup._id}>
                  <TimelineOppositeContent
                    sx={{ m: 'auto 0' }}
                    align={index % 2 === 0 ? 'right' : 'left'}
                    variant="body2"
                    color="text.secondary"
                  >
                    {formatDate(backup.createdAt)}
                  </TimelineOppositeContent>
                  
                  <TimelineSeparator>
                    <TimelineDot 
                      color={getStatusColor(backup.status)}
                      sx={{ 
                        border: `3px solid ${getTypeColor(backup.type)}`,
                        cursor: 'pointer'
                      }}
                      onClick={() => handleBackupClick(backup)}
                    >
                      {getStatusIcon(backup.status)}
                    </TimelineDot>
                    {index < filteredBackups.length - 1 && <TimelineConnector />}
                  </TimelineSeparator>
                  
                  <TimelineContent sx={{ py: '12px', px: 2 }}>
                    <Card 
                      variant="outlined" 
                      sx={{ 
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        '&:hover': {
                          boxShadow: 2,
                          backgroundColor: alpha(theme.palette.primary.main, 0.05)
                        },
                        border: selectedBackup?._id === backup._id ? 
                          `2px solid ${theme.palette.primary.main}` : undefined
                      }}
                      onClick={() => handleBackupClick(backup)}
                    >
                      <CardContent sx={{ pb: '16px !important' }}>
                        <Box display="flex" justifyContent="space-between" alignItems="start" mb={1}>
                          <Typography variant="h6" component="h3">
                            {backup.name}
                          </Typography>
                          <Stack direction="row" spacing={0.5}>
                            <Chip
                              label={backup.type}
                              size="small"
                              sx={{ backgroundColor: getTypeColor(backup.type), color: 'white' }}
                            />
                            <Chip
                              label={backup.status}
                              size="small"
                              color={getStatusColor(backup.status)}
                            />
                          </Stack>
                        </Box>
                        
                        <Typography variant="body2" color="text.secondary" mb={1}>
                          {backup.description}
                        </Typography>
                        
                        <Stack direction="row" spacing={1} flexWrap="wrap" mb={1}>
                          {backup.size && (
                            <Chip label={`Size: ${formatBytes(backup.size)}`} size="small" variant="outlined" />
                          )}
                          <Chip 
                            label={`Duration: ${formatDuration(backup.createdAt, backup.updatedAt)}`} 
                            size="small" 
                            variant="outlined" 
                          />
                          {backup.schedule && (
                            <Chip label={`Schedule: ${backup.schedule}`} size="small" variant="outlined" />
                          )}
                        </Stack>
                        
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Tooltip title="View Details">
                            <IconButton size="small" onClick={(e) => {
                              e.stopPropagation();
                              handleBackupClick(backup);
                            }}>
                              <Visibility />
                            </IconButton>
                          </Tooltip>
                          
                          {backup.status === 'completed' && (
                            <Tooltip title="Download">
                              <IconButton 
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onDownload) onDownload(backup);
                                }}
                              >
                                <CloudDownload />
                              </IconButton>
                            </Tooltip>
                          )}
                          
                          <Tooltip title="Delete">
                            <IconButton 
                              size="small" 
                              color="error"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onDelete) onDelete(backup);
                              }}
                            >
                              <Delete />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </CardContent>
                    </Card>
                  </TimelineContent>
                </TimelineItem>
              ))}
            </Timeline>
          )}
        </CardContent>
      </Card>

      {/* Selected Backup Details */}
      {selectedBackup && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Backup Details: {selectedBackup.name}
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <List dense>
                  <ListItem>
                    <ListItemText
                      primary="Status"
                      secondary={
                        <Chip 
                          label={selectedBackup.status} 
                          color={getStatusColor(selectedBackup.status)} 
                          size="small" 
                        />
                      }
                    />
                  </ListItem>
                  
                  <ListItem>
                    <ListItemText
                      primary="Type"
                      secondary={selectedBackup.type}
                    />
                  </ListItem>
                  
                  <ListItem>
                    <ListItemText
                      primary="Created"
                      secondary={formatDate(selectedBackup.createdAt)}
                    />
                  </ListItem>
                  
                  {selectedBackup.size && (
                    <ListItem>
                      <ListItemText
                        primary="File Size"
                        secondary={formatBytes(selectedBackup.size)}
                      />
                    </ListItem>
                  )}
                </List>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <List dense>
                  <ListItem>
                    <ListItemText
                      primary="Description"
                      secondary={selectedBackup.description || 'No description'}
                    />
                  </ListItem>
                  
                  <ListItem>
                    <ListItemText
                      primary="Duration"
                      secondary={formatDuration(selectedBackup.createdAt, selectedBackup.updatedAt)}
                    />
                  </ListItem>
                  
                  {selectedBackup.filePath && (
                    <ListItem>
                      <ListItemText
                        primary="File Path"
                        secondary={selectedBackup.filePath}
                      />
                    </ListItem>
                  )}
                  
                  {selectedBackup.error && (
                    <ListItem>
                      <ListItemText
                        primary="Error"
                        secondary={selectedBackup.error}
                        secondaryTypographyProps={{ color: 'error' }}
                      />
                    </ListItem>
                  )}
                </List>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default BackupTimelineChart;