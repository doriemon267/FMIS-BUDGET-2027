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
  Tooltip
} from '@mui/material';
import Chip from '@mui/material/Chip';
import {
  Notifications as NotificationsIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import { useNavigate } from 'react-router-dom';
import api from '../../config/api';
import { useNotifications } from '../../global/components/NotificationsContext';
import { useUser } from '../../context/UserContext';
import { toast } from 'react-toastify';

const ProposalNotifications = ({ showPersistentList = false }) => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [showPersistent, setShowPersistent] = useState(showPersistentList);
  const { markAllNotificationsAsRead, deleteNotifications, markNotificationsAsRead, muteNotification } = useNotifications();
  const { currentUser, setCurrentUser } = useUser();
  const [mutedProposals, setMutedProposals] = useState(new Set());
  const pollIntervalRef = useRef(null);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
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
    finally {
      setLoading(false);
    }
  }, [notifications.length, showWindowsNotification]);

  const buildNotificationLink = useCallback((notification) => {
    // Use the relatedLink if provided, otherwise default to the workflow page
    let link = notification.relatedLink || '/new-proposal-workflow';

    // Normalize query string and params
    const [pathPart, queryPart] = link.split('?');
    const params = new URLSearchParams(queryPart || '');

    // older code sometimes uses `view` instead of `tab` for the frontend - normalize
    if (params.has('view') && !params.has('tab')) {
      params.set('tab', params.get('view'));
      params.delete('view');
    }

    // If the link targets the legacy AllProposals path, normalize to the new page and default tab
    if (pathPart.toLowerCase().includes('/allproposals')) {
      // Use the new workflow route and set the default tab to `all-proposals` unless specified
      const newPath = '/new-proposal-workflow';
      if (!params.has('tab')) params.set('tab', 'all-proposals');
      link = `${newPath}?${params.toString()}`;
    } else {
      // Otherwise reconstruct the normalized link
      link = params.toString() ? `${pathPart}?${params.toString()}` : pathPart;
    }

    // Append proposalId from metadata if available and not present in the link
    if (notification.metadata?.proposalId && !params.has('proposalId')) {
      const sep = link.includes('?') ? '&' : '?';
      link = `${link}${sep}proposalId=${notification.metadata.proposalId}`;
    }

    return link;
  }, []);

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
        const link = buildNotificationLink(notification);
        navigate(link);
        markAsRead([notification._id]);
      };

      notif.onclose = () => {
        markAsRead([notification._id]);
      };
    }
  }, [navigate, buildNotificationLink, markAsRead]);

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

  // Keep local muted proposals in sync with currentUser preferences if available
  useEffect(() => {
    try {
      const initialMuted = new Set((currentUser?.notificationPreferences?.mutedProposals || []).map(String));
      setMutedProposals(initialMuted);
    } catch (e) {
      setMutedProposals(new Set());
    }
  }, [currentUser]);

  // Mark notifications as read
  const markAsRead = useCallback(async (ids) => {
    if (!Array.isArray(ids) || ids.length === 0) return;
    try {
      const response = await api.post('/api/notifications/mark-read', { ids });
      console.debug('markAsRead response:', response?.data);
        if (response.data && response.data.success) {
        const updatedIds = response.data.updatedIds || [];
        const modifiedCount = response.data.modifiedCount || 0;

        if (updatedIds.length > 0) {
          // Only remove the notifications confirmed updated on the server
          setNotifications(prev => prev.filter(notif => !updatedIds.includes(notif._id)));
        } else if (modifiedCount > 0) {
          // Server updated some documents but didn't return IDs; fall back to filtering by provided ids
          setNotifications(prev => prev.filter(notif => !ids.includes(notif._id)));
        }

        // Re-sync with server to ensure we're not showing old notifications
        await fetchNotifications();
        if (modifiedCount === 0) {
          toast.info('No notifications were updated (they may belong to a different role/user)', { autoClose: 2500 });
        }
        // Optional: show a subtle toast to indicate success
        try {
          toast.dismiss();
          // small non-intrusive success toast - uses default durations
          toast.success('Marked notification(s) as read', { autoClose: 1500 });
        } catch (_e) {
          console.debug('Toast error (ignored):', _e?.message || _e);
        }
      } else {
        // If server didn't return success, re-sync to be safe
        await fetchNotifications();
      }
    } catch (error) {
      console.error('Error marking notifications as read:', error);
      // Ensure UI is in sync after an error
      try { await fetchNotifications(); } catch (_e) { console.debug('Failed to re-sync notifications: ', _e?.message || _e); }
      toast.error('Failed to mark notification as read.');
    }
  }, [fetchNotifications]);

  // Mark all unread notifications for the current user/roles
  const markAllAsRead = useCallback(async () => {
    try {
      setLoading(true);
      let responseData;
      if (typeof markAllNotificationsAsRead === 'function') {
        responseData = await markAllNotificationsAsRead();
      } else {
        const r = await api.post('/api/notifications/mark-all-read');
        responseData = r?.data;
      }
  console.debug('markAllAsRead response:', responseData);
      const success = responseData && responseData.success;
      if (success) {
        const updatedIds = responseData.updatedIds || [];
        const modifiedCount = responseData.modifiedCount || 0;
        if (updatedIds.length > 0) {
          setNotifications(prev => prev.filter(notif => !updatedIds.includes(notif._id)));
        } else if (modifiedCount > 0) {
          // If server updated but didn't return IDs, clear local list
          setNotifications([]);
        }
        await fetchNotifications();
        toast.success('Marked all notifications as read', { autoClose: 1500 });
      } else {
        // No updates, re-sync
        await fetchNotifications();
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      try { await fetchNotifications(); } catch (_e) { console.debug('Failed to re-sync notifications: ', _e?.message || _e); }
      toast.error('Failed to mark all notifications as read.');
    } finally {
      setLoading(false);
    }
  }, [fetchNotifications, markAllNotificationsAsRead]);

  // Handle notification click
  const handleNotificationClick = (notification) => {
    const link = buildNotificationLink(notification);
    navigate(link);
    // Mark this notification as read immediately
    markAsRead([notification._id]);
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

  // Notification color logic is defined for future use if color badges are added

  const getNotificationIcon = (type) => {
    if (type?.includes('return')) return '🔄';
    if (type?.includes('approve') || type?.includes('forward')) return '✅';
    if (type?.includes('submit')) return '📤';
    return 'ℹ️';
  };

  // Beware: the API sometimes returns read + unread in debug mode; compute unread explicitly
  const unreadCount = notifications.filter(n => n?.status === undefined || String(n.status).toUpperCase() === 'UNREAD').length;

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
                    {notification.metadata?.proposalId && mutedProposals.has(String(notification.metadata.proposalId)) && (
                      <Box sx={{ mt: 0.5, mb: 0.5 }}>
                        <Tooltip title="Muted — You won't receive new notifications for this proposal" placement="top">
                          <Chip label="Muted" size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: '#f5f5f5', color: '#777' }} />
                        </Tooltip>
                      </Box>
                    )}
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
                  <Box sx={{ ml: 1, display: 'flex', alignItems: 'center' }}>
                    {notification.metadata?.proposalId && (
                      (() => {
                        const pid = String(notification.metadata.proposalId);
                        const isMuted = mutedProposals.has(pid);
                        return (
                          <IconButton
                            size="small"
                            title={isMuted ? 'Unmute notifications for this proposal' : 'Mute notifications for this proposal'}
                            onClick={async (e) => { 
                              e.stopPropagation();
                              try {
                                await muteNotification({ proposalId: pid, mute: !isMuted });
                                // Update local UI set
                                setMutedProposals(prev => {
                                  const next = new Set(prev);
                                  if (!isMuted) next.add(pid); else next.delete(pid);
                                  return next;
                                });
                                // Refresh global user so other components reflect mute preference
                                try { await setCurrentUser(); } catch (_e) { /* noop */ }
                                toast.success(isMuted ? 'Notifications unmuted for this proposal' : 'Notifications muted for this proposal');
                              } catch (err) {
                                console.error('Failed to toggle mute:', err);
                                toast.error('Failed to toggle mute');
                              }
                            }}
                            sx={{ color: isMuted ? '#c62828' : '#777' }}
                          >
                            {isMuted ? <NotificationsOffIcon sx={{ fontSize: '1rem' }} /> : <NotificationsActiveIcon sx={{ fontSize: '1rem' }} />}
                          </IconButton>
                        );
                      })()
                    )}
                    <IconButton
                      size="small"
                      onClick={(e) => { e.stopPropagation(); markNotificationsAsRead([notification._id]); }}
                      aria-label="dismiss"
                    >
                      <CloseIcon sx={{ fontSize: '1rem' }} />
                    </IconButton>
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
                    {notification.metadata?.proposalId && mutedProposals.has(String(notification.metadata.proposalId)) && (
                      <Box sx={{ mt: 0.75 }}>
                        <Tooltip title="Muted — You won't receive new notifications for this proposal" placement="top">
                          <Chip label="Muted" size="small" sx={{ height: 20, fontSize: '0.6rem', bgcolor: '#f5f5f5', color: '#777' }} />
                        </Tooltip>
                      </Box>
                    )}
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
                    <Box sx={{ ml: 1, display: 'flex', alignItems: 'center' }}>
                      {notification.metadata?.proposalId && (
                        (() => {
                          const pid = String(notification.metadata.proposalId);
                          const isMuted = mutedProposals.has(pid);
                          return (
                            <IconButton
                              size="small"
                              title={isMuted ? 'Unmute notifications for this proposal' : 'Mute notifications for this proposal'}
                              onClick={async (e) => { 
                                e.stopPropagation();
                                try {
                                  await muteNotification({ proposalId: pid, mute: !isMuted });
                                  setMutedProposals(prev => {
                                    const next = new Set(prev);
                                    if (!isMuted) next.add(pid); else next.delete(pid);
                                    return next;
                                  });
                                  try { await setCurrentUser(); } catch (_e) { /* noop */ }
                                  toast.success(isMuted ? 'Notifications unmuted for this proposal' : 'Notifications muted for this proposal');
                                } catch (err) {
                                  console.error('Failed to toggle mute:', err);
                                  toast.error('Failed to toggle mute');
                                }
                              }}
                            >
                              {isMuted ? <NotificationsOffIcon sx={{ fontSize: '0.95rem' }} /> : <NotificationsActiveIcon sx={{ fontSize: '0.95rem' }} />}
                            </IconButton>
                          );
                        })()
                      )}
                      <IconButton
                        size="small"
                        onClick={(e) => { e.stopPropagation(); markNotificationsAsRead([notification._id]); }}
                        aria-label="dismiss"
                      >
                        <CloseIcon sx={{ fontSize: '0.95rem' }} />
                      </IconButton>
                    </Box>
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, bgcolor: '#f5f5f5' }}>
          <Button
            onClick={() => {
              // Mark all unread notifications for the current user/roles
              markAllAsRead();
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
