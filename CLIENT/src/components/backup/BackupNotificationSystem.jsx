import React, { useState, useEffect, useContext } from 'react';
import {
  Alert,
  Box,
  Typography,
  LinearProgress,
  IconButton,
  Card,
  CardContent,
  Stack,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  
} from '@mui/material';
import {
  CheckCircle,
  Error,
  Warning,
  Info,
  Close,
  Backup,
  CloudDownload,
  Schedule,
  Timeline,
  Visibility,
  NotificationsActive
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

// Helper functions moved outside component
const formatDuration = (seconds) => {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
};

const getNotificationIcon = (type) => {
  switch (type) {
    case 'success': return <CheckCircle />;
    case 'error': return <Error />;
    case 'warning': return <Warning />;
    case 'info': return <Info />;
    case 'progress': return <Backup />;
    default: return <Info />;
  }
};

const getNotificationColor = (type) => {
  switch (type) {
    case 'success': return 'success';
    case 'error': return 'error';
    case 'warning': return 'warning';
    case 'info': return 'info';
    case 'progress': return 'info';
    default: return 'info';
  }
};

const BackupNotificationSystem = ({ 
  notifications = [], 
  onClose, 
  onViewDetails,
  onDownloadBackup,
  // enableSound removed
}) => {
  const theme = useTheme();
  const [activeNotifications, setActiveNotifications] = useState([]);
  const [detailsDialog, setDetailsDialog] = useState({ open: false, notification: null });
  // const [soundEnabled, setSoundEnabled] = useState(enableSound); // sound logic removed

  useEffect(() => {
    setActiveNotifications(notifications.filter(n => !n.dismissed));
  }, [notifications]);

  const handleClose = (notificationId, reason) => {
    if (reason === 'clickaway') return;
    
    setActiveNotifications(prev => 
      prev.filter(n => n.id !== notificationId)
    );
    
    if (onClose) {
      onClose(notificationId);
    }
  };

  const handleViewDetails = (notification) => {
    setDetailsDialog({ open: true, notification });
    if (onViewDetails) {
      onViewDetails(notification);
    }
  };

  // playNotificationSound removed

  const ProgressNotification = ({ notification }) => (
    <Card sx={{ mb: 1, minWidth: 400 }}>
      <CardContent sx={{ pb: 1 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
          <Box display="flex" alignItems="center" gap={1}>
            <Backup color="primary" />
            <Typography variant="subtitle1" fontWeight="medium">
              {notification.title}
            </Typography>
          </Box>
          <IconButton 
            size="small" 
            onClick={() => handleClose(notification.id)}
          >
            <Close />
          </IconButton>
        </Box>
        
        <Typography variant="body2" color="text.secondary" mb={1}>
          {notification.message}
        </Typography>
        
        <Box mb={1}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
            <Typography variant="caption">
              {notification.currentStep || 'Processing...'}
            </Typography>
            <Typography variant="caption">
              {notification.progress?.toFixed(1) || 0}%
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={notification.progress || 0}
            sx={{ height: 6, borderRadius: 3 }}
          />
        </Box>
        
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          {notification.estimatedTimeRemaining && (
            <Chip 
              label={`ETA: ${notification.estimatedTimeRemaining}`} 
              size="small" 
              variant="outlined"
              icon={<Schedule />}
            />
          )}
          {notification.speed && (
            <Chip 
              label={notification.speed} 
              size="small" 
              variant="outlined"
              icon={<Timeline />}
            />
          )}
          {notification.fileSize && (
            <Chip 
              label={notification.fileSize} 
              size="small" 
              variant="outlined"
            />
          )}
        </Stack>
      </CardContent>
    </Card>
  );

  const StandardNotification = ({ notification, onClose }) => {
    const [isVisible, setIsVisible] = useState(true);

    const handleClose = (reason) => {
      if (reason === 'clickaway') return;
      setIsVisible(false);
      setTimeout(() => onClose(notification.id, reason), 300);
    };

    useEffect(() => {
      if (notification.autoHide !== false) {
        const timer = setTimeout(() => {
          handleClose('timeout');
        }, 6000);
        return () => clearTimeout(timer);
      }
    }, [notification.autoHide]);

    if (!isVisible) return null;

    return (
      <Box
        key={notification.id}
        sx={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: 1400,
          minWidth: 300,
          maxWidth: 500,
          mb: 1
        }}
      >
        <Alert
          severity={getNotificationColor(notification.type)}
          onClose={() => handleClose('close')}
          variant="filled"
          sx={{ 
            minWidth: 300,
            boxShadow: 3,
            borderRadius: 1
          }}
          action={
            notification.actions && (
              <Stack direction="row" spacing={1}>
                {notification.actions.map((action, index) => (
                  <Button
                    key={action.label || index}
                    color="inherit"
                    size="small"
                    onClick={() => action.onClick(notification)}
                    startIcon={action.icon}
                  >
                    {action.label}
                  </Button>
                ))}
              </Stack>
            )
          }
        >
          <Box>
            <Typography variant="subtitle2" fontWeight="medium">
              {notification.title}
            </Typography>
            <Typography variant="body2">
              {notification.message}
            </Typography>
            {notification.metadata && (
              <Box mt={1}>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {notification.metadata.backupId && (
                    <Chip 
                      label={`ID: ${notification.metadata.backupId.substring(0, 8)}`} 
                      size="small" 
                      variant="outlined"
                    />
                  )}
                  {notification.metadata.duration && (
                    <Chip 
                      label={formatDuration(notification.metadata.duration)} 
                      size="small" 
                      variant="outlined"
                    />
                  )}
                  {notification.metadata.fileSize && (
                    <Chip 
                      label={notification.metadata.fileSize} 
                      size="small" 
                      variant="outlined"
                    />
                  )}
                </Stack>
              </Box>
            )}
          </Box>
        </Alert>
      </Box>
    );
  };

  const NotificationDetailsDialog = ({ notification, open, onClose }) => {
    if (!notification) return null;

    return (
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            {getNotificationIcon(notification.type)}
            <Typography variant="h6">{notification.title}</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography variant="body1">
              {notification.message}
            </Typography>
            
            {notification.metadata && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Details:
                </Typography>
                <List dense>
                  {Object.entries(notification.metadata).map(([key, value]) => (
                    <ListItem key={key}>
                      <ListItemText
                        primary={key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        secondary={typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
            
            {notification.logs && notification.logs.length > 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Activity Log:
                </Typography>
                <List dense sx={{ maxHeight: 200, overflow: 'auto' }}>
                  {notification.logs.map((log, index) => (
                    <ListItem key={log.timestamp || index}>
                      <ListItemIcon>
                        <Timeline fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={log.message}
                        secondary={`${new Date(log.timestamp).toLocaleTimeString()} - ${log.progress?.toFixed(1)}%`}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          {notification.actions && notification.actions.map((action, index) => (
            <Button
              key={action.label || index}
              onClick={() => action.onClick(notification)}
              startIcon={action.icon}
              variant={index === 0 ? 'contained' : 'outlined'}
            >
              {action.label}
            </Button>
          ))}
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  };

  // Play sound for new notifications
  useEffect(() => {
    const newNotifications = activeNotifications.filter(n => !n.soundPlayed);
    newNotifications.forEach(notification => {
      playNotificationSound(notification.type);
      notification.soundPlayed = true;
    });
  }, [activeNotifications, soundEnabled]);

  return (
    <>
      {/* Progress Notifications (Fixed position) */}
      <Box
        sx={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: theme.zIndex.snackbar + 1,
          maxWidth: 450
        }}
      >
        {activeNotifications
          .filter(n => n.type === 'progress')
          .map(notification => (
            <ProgressNotification 
              key={notification.id} 
              notification={notification} 
            />
          ))}
      </Box>

      {/* Standard Notifications */}
      {activeNotifications
        .filter(n => n.type !== 'progress')
        .map(notification => (
          <StandardNotification
            key={notification.id}
            notification={notification}
            onClose={handleClose}
          />
        ))}

      {/* Details Dialog */}
      <NotificationDetailsDialog
        notification={detailsDialog.notification}
        open={detailsDialog.open}
        onClose={() => setDetailsDialog({ open: false, notification: null })}
      />

      {/* Sound Toggle (Optional) */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          zIndex: theme.zIndex.fab
        }}
      >
        <IconButton
          onClick={() => setSoundEnabled(!soundEnabled)}
          color={soundEnabled ? 'primary' : 'default'}
          sx={{
            backgroundColor: 'background.paper',
            boxShadow: 2,
            '&:hover': {
              backgroundColor: 'background.paper',
              boxShadow: 4
            }
          }}
        >
          <NotificationsActive />
        </IconButton>
      </Box>
    </>
  );
};

export default BackupNotificationSystem;