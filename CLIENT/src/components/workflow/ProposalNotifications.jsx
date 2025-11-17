import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Badge,
  IconButton,
  Menu,
  MenuItem,
  Box,
  Typography,
  Divider,
  Chip,
  Paper,
  CircularProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Close as CloseIcon,
  CheckCircle as CheckIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../../config/api';
import { toast } from 'react-toastify';

const ProposalNotifications = ({ showPersistentList = false }) => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [showPersistent, setShowPersistent] = useState(showPersistentList);
  const pollIntervalRef = useRef(null);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const response = await api.get('/api/notifications', {
        headers: {
          'X-Debug-Notif': 'false'
        }
      });
      
      if (response.data.success) {
        const newNotifications = response.data.data || [];
        
        // Check for new notifications to trigger Windows notification
        const oldCount = notifications.length;
        if (newNotifications.length > oldCount) {
          const newNotifs = newNotifications.slice(0, newNotifications.length - oldCount);
          newNotifs.forEach(notif => {
            showWindowsNotification(notif);
          });
        }
        
        setNotifications(newNotifications);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }, [notifications.length]);

  // Show Windows notification
  const showWindowsNotification = useCallback((notification) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notif = new Notification('Proposal Workflow', {
        body: notification.message || notification.title,
        icon: '/logo.png',
        tag: notification._id,
        requireInteraction: false
      });

      notif.onclick = () => {
        window.focus();
        navigate('/new-proposal-workflow');
        markAsRead([notification._id]);
      };

      notif.onclose = () => {
        markAsRead([notification._id]);
      };
    }
  }, [navigate]);

  // Request notification permission on component mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Poll for notifications
  useEffect(() => {
    fetchNotifications();
    
    pollIntervalRef.current = setInterval(() => {
      fetchNotifications();
    }, 5000); // Poll every 5 seconds

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [fetchNotifications]);

  // Mark notifications as read
  const markAsRead = useCallback(async (ids) => {
    try {
      await api.post('/api/notifications/mark-read', { ids });
      
      setNotifications(prev =>
        prev.filter(notif => !ids.includes(notif._id))
      );
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  }, []);

  // Handle notification click
  const handleNotificationClick = (notification) => {
    navigate('/new-proposal-workflow');
    setAnchorEl(null);
    setShowPersistent(false);
  };

  // Format timestamp
  const formatTime = (date) => {
    const now = new Date();
    const notifDate = new Date(date);
    const diffMs = now - notifDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return notifDate.toLocaleDateString();
  };

  // Get notification type color
  const getNotificationColor = (type) => {
    if (type?.includes('return')) return '#ef5350';
    if (type?.includes('approve') || type?.includes('forward')) return '#42a5f5';
    if (type?.includes('submit')) return '#66bb6a';
    return '#999';
  };

  const getNotificationIcon = (type) => {
    if (type?.includes('return')) return '🔄';
    if (type?.includes('approve') || type?.includes('forward')) return '✅';
    if (type?.includes('submit')) return '📤';
    return 'ℹ️';
  };

  const unreadCount = notifications.length;

  return (
    <>
      {/* Bell Icon Button */}
      <Tooltip title="Proposals Notifications" arrow>
        <IconButton
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{
            position: 'relative',
            color: 'white',
            transition: 'all 0.3s ease',
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.2)'
            }
          }}
        >
          <Badge badgeContent={unreadCount} color="error">
            <NotificationsIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      {/* Dropdown Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        PaperProps={{
          sx: {
            mt: 1,
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            borderRadius: '8px',
            maxWidth: 450,
            maxHeight: 500
          }
        }}
      >
        {loading ? (
          <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress size={24} />
          </Box>
        ) : notifications.length === 0 ? (
          <MenuItem disabled>
            <Typography variant="body2" color="textSecondary">
              No notifications
            </Typography>
          </MenuItem>
        ) : (
          <>
            <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Proposals Notifications ({unreadCount})
              </Typography>
            </Box>
            {notifications.slice(0, 5).map((notification, index) => (
              <MenuItem
                key={notification._id}
                onClick={() => handleNotificationClick(notification)}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  py: 1.5,
                  px: 2,
                  borderBottom: index < Math.min(5, notifications.length - 1) ? '1px solid #f0f0f0' : 'none',
                  '&:hover': {
                    bgcolor: '#f5f5f5'
                  }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, width: '100%' }}>
                  <Box
                    sx={{
                      fontSize: '1.2rem',
                      mt: 0.5
                    }}
                  >
                    {getNotificationIcon(notification.type)}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography
                      variant="subtitle2"
                      sx={{
                        fontWeight: 600,
                        color: '#333',
                        mb: 0.25
                      }}
                    >
                      {notification.title}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        color: '#666',
                        lineHeight: 1.4,
                        mb: 0.5
                      }}
                    >
                      {notification.message}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: '#999',
                        fontSize: '0.75rem'
                      }}
                    >
                      {formatTime(notification.createdAt)}
                    </Typography>
                  </Box>
                </Box>
              </MenuItem>
            ))}
            {unreadCount > 5 && (
              <MenuItem
                onClick={() => {
                  setAnchorEl(null);
                  setShowPersistent(true);
                }}
                sx={{
                  justifyContent: 'center',
                  py: 1,
                  color: '#375e38',
                  fontWeight: 600
                }}
              >
                View all notifications
              </MenuItem>
            )}
          </>
        )}
      </Menu>

      {/* Persistent Notification List Dialog */}
      <Dialog
        open={showPersistent}
        onClose={() => setShowPersistent(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
          }
        }}
      >
        <DialogTitle sx={{ 
          bgcolor: '#375e38', 
          color: 'white',
          fontWeight: 600,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Proposal Notifications
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.9 }}>
              {unreadCount} unread
            </Typography>
          </Box>
          <IconButton
            onClick={() => setShowPersistent(false)}
            sx={{ color: 'white' }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {notifications.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="textSecondary">
                No notifications yet
              </Typography>
            </Box>
          ) : (
            <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
              {notifications.map((notification, index) => (
                <Box
                  key={notification._id}
                  onClick={() => handleNotificationClick(notification)}
                  sx={{
                    p: 2,
                    borderBottom: index < notifications.length - 1 ? '1px solid #e0e0e0' : 'none',
                    display: 'flex',
                    gap: 1.5,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    bgcolor: 'white',
                    '&:hover': {
                      bgcolor: '#f9f9f9'
                    }
                  }}
                >
                  <Box
                    sx={{
                      fontSize: '1.5rem',
                      mt: 0.25,
                      minWidth: 24
                    }}
                  >
                    {getNotificationIcon(notification.type)}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography
                      variant="subtitle2"
                      sx={{
                        fontWeight: 600,
                        color: '#333',
                        mb: 0.25
                      }}
                    >
                      {notification.title}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        color: '#666',
                        lineHeight: 1.5,
                        mb: 0.5
                      }}
                    >
                      {notification.message}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: '#999',
                        fontSize: '0.75rem'
                      }}
                    >
                      {formatTime(notification.createdAt)}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, bgcolor: '#f5f5f5' }}>
          <Button
            onClick={() => {
              if (notifications.length > 0) {
                markAsRead(notifications.map(n => n._id));
              }
            }}
            variant="contained"
            sx={{
              bgcolor: '#375e38',
              '&:hover': { bgcolor: '#2d4a2e' }
            }}
            disabled={notifications.length === 0}
          >
            Mark all as read
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ProposalNotifications;
