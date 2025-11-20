/**
 * WorkflowNotifications - Clean, Simple Notification System for New Proposal Workflow
 * 
 * Features:
 * - Real-time polling for new notifications
 * - Clean message display (no ObjectID issues)
 * - Mark as read/unread
 * - Delete notifications
 * - Mute/Unmute by proposal
 * - Toast notifications on new messages
 * - Persistent dialog for all notifications
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Badge,
  IconButton,
  Menu,
  MenuItem,
  Box,
  Typography,
  CircularProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Chip,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  NotificationsNone as NotificationsNoneIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  VolumeOff as MuteIcon,
  VolumeUp as UnmuteIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../config/api';
import { useUser } from '../../context/UserContext';

const WorkflowNotifications = () => {
  const navigate = useNavigate();
  const { currentUser } = useUser();

  // State
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [mutedProposals, setMutedProposals] = useState(new Set());
  const pollIntervalRef = useRef(null);

  // Fetch notifications from API
  const fetchNotifications = useCallback(async () => {
    try {
      const response = await api.get('/api/notifications');
      if (response.data?.success) {
        const newNotifs = response.data.data || [];
        setNotifications(newNotifs);
        
        // Log for debugging
        console.log('[WorkflowNotifications] Fetched', newNotifs.length, 'notifications');
      }
    } catch (error) {
      console.error('[WorkflowNotifications] Error fetching:', error);
    }
  }, []);

  // Initialize polling on mount
  useEffect(() => {
    fetchNotifications();
    
    // Poll every 30 seconds for new notifications
    pollIntervalRef.current = setInterval(() => {
      fetchNotifications();
    }, 30000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [fetchNotifications]);

  // Mark as read
  const handleMarkAsRead = useCallback(async (notificationId) => {
    try {
      await api.post('/api/notifications/mark-read', {
        ids: [notificationId]
      });
      setNotifications(prev =>
        prev.map(n =>
          n._id === notificationId
            ? { ...n, status: 'READ' }
            : n
        )
      );
    } catch (error) {
      console.error('Error marking as read:', error);
      toast.error('Failed to mark notification as read');
    }
  }, []);

  // Delete notification
  const handleDelete = useCallback(async (notificationId) => {
    try {
      await api.delete(`/notifications/${notificationId}`);
      setNotifications(prev => prev.filter(n => n._id !== notificationId));
      toast.success('Notification deleted');
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Failed to delete notification');
    }
  }, []);

  // Mute proposal notifications
  const handleMuteProposal = useCallback(async (proposalId, isMuting) => {
    try {
      await api.post('/api/notifications/mute', {
        proposalId,
        mute: isMuting
      });
      
      if (isMuting) {
        setMutedProposals(prev => new Set([...prev, proposalId]));
      } else {
        setMutedProposals(prev => {
          const next = new Set(prev);
          next.delete(proposalId);
          return next;
        });
      }
      
      toast.success(isMuting ? 'Notifications muted' : 'Notifications unmuted');
    } catch (error) {
      console.error('Error toggling mute:', error);
      toast.error('Failed to toggle mute');
    }
  }, []);

  // Navigate to proposal
  const handleNotificationClick = (notification) => {
    // Always go to /new-proposal-workflow (no params, no dialog)
    navigate('/new-proposal-workflow');
    handleMarkAsRead(notification._id);
    setAnchorEl(null);
    setDialogOpen(false);
  };

  // Extract clean message from notification
  const getNotificationMessage = (notification) => {
    // Prefer full message if it's not an ObjectID
    if (notification.message) {
      const msgStr = String(notification.message).trim();
      // Check it's not an ObjectID (24 hex chars) and is reasonably long
      if (msgStr.length > 10 && !/^[a-f0-9]{24}$/i.test(msgStr)) {
        return msgStr;
      }
    }

    // Fallback to proposal title
    if (notification.metadata?.proposalTitle) {
      return `Proposal: "${notification.metadata.proposalTitle}"`;
    }

    // Fallback to title
    if (notification.title) {
      return notification.title;
    }

    return 'Workflow Notification';
  };

  // Filter notifications based on search
  const filteredNotifications = notifications.filter(n => {
    if (!searchFilter) return true;
    const msg = getNotificationMessage(n).toLowerCase();
    const title = (n.title || '').toLowerCase();
    return msg.includes(searchFilter.toLowerCase()) || title.includes(searchFilter.toLowerCase());
  });

  // Count unread
  const unreadCount = notifications.filter(n => n.status === 'UNREAD').length;

  // Get icon based on notification type
  const getNotificationIcon = (type) => {
    if (!type) return '📋';
    if (type.includes('RETURNED')) return '↩️';
    if (type.includes('SUBMITTED') || type.includes('FORWARD')) return '📤';
    if (type.includes('APPROVE') || type.includes('FINALIZED')) return '✅';
    return '📋';
  };

  // Format timestamp
  const formatTime = (date) => {
    if (!date) return '';
    const now = new Date();
    const notifDate = new Date(date);
    const diffMs = now - notifDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return notifDate.toLocaleDateString();
  };

  return (
    <>
      {/* Bell Icon Button */}
      <Tooltip title={`${unreadCount} unread notifications`}>
        <IconButton
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{ position: 'relative' }}
        >
          <Badge badgeContent={unreadCount} color="error">
            {unreadCount > 0 ? (
              <NotificationsIcon sx={{ color: '#ff6b6b' }} />
            ) : (
              <NotificationsNoneIcon />
            )}
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
              No notifications yet
            </Typography>
          </MenuItem>
        ) : (
          <>
            <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                Notifications ({unreadCount} unread)
              </Typography>
              <Button
                onClick={() => setDialogOpen(true)}
                size="small"
                variant="text"
                sx={{ textTransform: 'none' }}
              >
                View all ({notifications.length})
              </Button>
            </Box>

            {/* Display first 5 notifications */}
            {notifications.slice(0, 5).map((notification, index) => (
              <MenuItem
                key={notification._id}
                onClick={() => {
                  // Mark as read and redirect
                  if (notification.status === 'UNREAD') handleMarkAsRead(notification._id);
                  handleNotificationClick(notification);
                }}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  py: 1.5,
                  px: 2,
                  borderBottom: index < Math.min(5, notifications.length - 1) ? '1px solid #f0f0f0' : 'none',
                  '&:hover': { bgcolor: '#f5f5f5' },
                  bgcolor: notification.status === 'UNREAD' ? '#f0f7ff' : 'transparent'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, width: '100%' }}>
                  <Typography sx={{ fontSize: '1.2rem', mt: 0.5 }}>
                    {getNotificationIcon(notification.type)}
                  </Typography>

                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#333', mb: 0.25 }}>
                      {notification.title}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        color: '#666',
                        lineHeight: 1.4,
                        mb: 0.5,
                        wordBreak: 'break-word',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}
                    >
                      {getNotificationMessage(notification)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#999', fontSize: '0.75rem' }}>
                      {formatTime(notification.createdAt)}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {/* Show blue dot only if unread, otherwise show a gray dot for read */}
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: notification.status === 'UNREAD' ? '#2196f3' : '#ccc',
                        mt: 1
                      }}
                    />
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(notification._id);
                        }}
                      >
                        <CloseIcon sx={{ fontSize: '1rem' }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              </MenuItem>
            ))}
          </>
        )}
      </Menu>

      {/* Full List Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
          }
        }}
      >
        <DialogTitle
          sx={{
            bgcolor: 'linear-gradient(135deg, #2d5016 0%, #375e38 100%)',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '1.25rem',
            p: 3
          }}
        >
          All Notifications
        </DialogTitle>

        <DialogContent sx={{ p: 0 }}>
          {/* Search bar */}
          <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search notifications..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                )
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '&:hover fieldset': { borderColor: '#4a7c2c' },
                  '&.Mui-focused fieldset': { borderColor: '#4a7c2c' }
                }
              }}
            />
          </Box>

          {/* Notifications list */}
          {loading ? (
            <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress />
            </Box>
          ) : filteredNotifications.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="textSecondary">
                {searchFilter ? 'No notifications match your search' : 'No notifications'}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ maxHeight: 'calc(100vh - 300px)', overflow: 'auto' }}>
              {filteredNotifications.map((notification, index) => (
                <Box
                  key={notification._id}
                  sx={{
                    p: 2,
                    borderBottom: '1px solid #f0f0f0',
                    bgcolor: notification.status === 'UNREAD' ? '#f0f7ff' : 'transparent',
                    '&:hover': { bgcolor: '#fafafa' },
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                    <Typography sx={{ fontSize: '1.5rem', minWidth: 30 }}>
                      {getNotificationIcon(notification.type)}
                    </Typography>

                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#333' }}>
                          {notification.title}
                        </Typography>
                        {notification.status === 'UNREAD' && (
                          <Chip
                            label="Unread"
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.65rem',
                              bgcolor: '#2196f3',
                              color: 'white'
                            }}
                          />
                        )}
                      </Box>

                      <Typography
                        variant="body2"
                        sx={{
                          color: '#555',
                          lineHeight: 1.5,
                          mb: 0.75
                        }}
                      >
                        {getNotificationMessage(notification)}
                      </Typography>

                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Typography variant="caption" sx={{ color: '#999' }}>
                          {formatTime(notification.createdAt)}
                        </Typography>
                        {notification.metadata?.proposalId && (
                          <Typography variant="caption" sx={{ color: '#2196f3', fontWeight: 500 }}>
                            Proposal ID: {notification.metadata.proposalId}
                          </Typography>
                        )}
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      {notification.status === 'UNREAD' && (
                        <Tooltip title="Mark as read">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkAsRead(notification._id);
                            }}
                          >
                            <Box
                              sx={{
                                width: 10,
                                height: 10,
                                borderRadius: '50%',
                                bgcolor: '#2196f3'
                              }}
                            />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(notification._id);
                          }}
                        >
                          <DeleteIcon sx={{ fontSize: '1rem' }} />
                        </IconButton>
                      </Tooltip>
                      {notification.metadata?.proposalId && (
                        <Tooltip title={mutedProposals.has(notification.metadata.proposalId) ? 'Unmute' : 'Mute'}>
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMuteProposal(
                                notification.metadata.proposalId,
                                !mutedProposals.has(notification.metadata.proposalId)
                              );
                            }}
                          >
                            {mutedProposals.has(notification.metadata.proposalId) ? (
                              <MuteIcon sx={{ fontSize: '1rem' }} />
                            ) : (
                              <UnmuteIcon sx={{ fontSize: '1rem' }} />
                            )}
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, borderTop: '1px solid #e0e0e0' }}>
          <Button onClick={() => setDialogOpen(false)}>Close</Button>
          <Button
            variant="contained"
            onClick={() => {
              // Mark all as read
              notifications
                .filter(n => n.status === 'UNREAD')
                .forEach(n => handleMarkAsRead(n._id));
            }}
            disabled={unreadCount === 0}
            sx={{
              bgcolor: '#375e38',
              '&:hover': { bgcolor: '#2d4a2e' }
            }}
          >
            Mark All Read
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default WorkflowNotifications;
