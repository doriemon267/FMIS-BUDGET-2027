import { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Typography, List, ListItem, ListItemText, IconButton, Chip, Badge, Button, Dialog, DialogTitle, DialogContent, TextField, Select, MenuItem } from '@mui/material';
import { FiX, FiTrash2, FiSettings, FiBell, FiClock, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';
import { useTheme, useMediaQuery } from '@mui/material';

export default function NotificationsCenter() {
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState('all'); // all, unread, approval, budget, deadline
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState({ sound: true, desktop: true, autoRead: false, retentionDays: 30 });
  const soundRef = useRef(null);

  // Initialize from localStorage
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('notificationSettings') || '{}');
      setNotificationSettings(prev => ({ ...prev, ...stored }));
    } catch (e) {}

    const stored = JSON.parse(localStorage.getItem('notificationsCenter') || '[]');
    setNotifications(stored);
    updateUnreadCount(stored);
  }, []);

  // Listen for new notifications from system
  useEffect(() => {
    const handler = (e) => {
      const notification = {
        id: `notif-${Date.now()}`,
        type: e?.detail?.type || 'info', // approval, budget, deadline, system
        title: e?.detail?.title || 'New Notification',
        message: e?.detail?.message || '',
        timestamp: new Date(),
        read: false,
        action: e?.detail?.action || null,
        actionUrl: e?.detail?.actionUrl || null,
        severity: e?.detail?.severity || 'info' // info, warning, critical
      };
      
      setNotifications(prev => {
        const updated = [notification, ...prev];
        localStorage.setItem('notificationsCenter', JSON.stringify(updated));
        updateUnreadCount(updated);
        
        // Play sound if enabled
        if (notificationSettings.sound) playNotificationSound();
        
        return updated;
      });
    };

    window.addEventListener('system-notification', handler);
    return () => window.removeEventListener('system-notification', handler);
  }, [notificationSettings.sound]);

  const updateUnreadCount = (notifs) => {
    const unread = notifs.filter(n => !n.read).length;
    setUnreadCount(unread);
  };

  const playNotificationSound = () => {
    try {
      if (soundRef.current) {
        soundRef.current.play();
      } else {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = 800;
        o.connect(g);
        g.connect(ctx.destination);
        o.start();
        setTimeout(() => { o.stop(); ctx.close(); }, 150);
      }
    } catch (e) {}
  };

  const markAsRead = useCallback((notificationId) => {
    setNotifications(prev => {
      const updated = prev.map(n => n.id === notificationId ? { ...n, read: true } : n);
      localStorage.setItem('notificationsCenter', JSON.stringify(updated));
      updateUnreadCount(updated);
      return updated;
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      localStorage.setItem('notificationsCenter', JSON.stringify(updated));
      updateUnreadCount(updated);
      return updated;
    });
  }, []);

  const deleteNotification = useCallback((notificationId) => {
    setNotifications(prev => {
      const updated = prev.filter(n => n.id !== notificationId);
      localStorage.setItem('notificationsCenter', JSON.stringify(updated));
      updateUnreadCount(updated);
      return updated;
    });
  }, []);

  const clearAll = useCallback(() => {
    if (window.confirm('Clear all notifications?')) {
      setNotifications([]);
      localStorage.setItem('notificationsCenter', JSON.stringify([]));
      updateUnreadCount([]);
    }
  }, []);

  const persister = useCallback((settings) => {
    setNotificationSettings(settings);
    localStorage.setItem('notificationSettings', JSON.stringify(settings));
  }, []);

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'approval') return n.type === 'approval';
    if (filter === 'budget') return n.type === 'budget';
    if (filter === 'deadline') return n.type === 'deadline';
    return true;
  });

  const severityColor = (severity) => {
    switch (severity) {
      case 'critical': return '#d32f2f';
      case 'warning': return '#f57c00';
      default: return '#1976d2';
    }
  };

  const typeLabel = (type) => {
    const labels = { approval: 'Approval', budget: 'Budget', deadline: 'Deadline', system: 'System' };
    return labels[type] || type;
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#1a1a1e', color: '#eee' }}>
      <audio ref={soundRef} src="/sounds/notification.mp3" />
      
      {/* Header */}
      <Box sx={{ p: 1.5, borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FiBell size={20} />
          <Typography variant='subtitle1'>Notifications</Typography>
          {unreadCount > 0 && <Badge badgeContent={unreadCount} color='error' sx={{ ml: 1 }} />}
        </Box>
        <IconButton size='small' onClick={() => setSettingsOpen(true)} sx={{ color: '#aaa' }}>
          <FiSettings size={16} />
        </IconButton>
      </Box>

      {/* Filter Tabs */}
      <Box sx={{ p: 1, display: 'flex', gap: 0.5, overflowX: 'auto', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        {['all', 'unread', 'approval', 'budget', 'deadline'].map(f => (
          <Chip
            key={f}
            label={f === 'all' ? `All (${notifications.length})` : (f === 'unread' ? `Unread (${unreadCount})` : typeLabel(f))}
            size='small'
            onClick={() => setFilter(f)}
            sx={{
              bgcolor: filter === f ? '#0066cc' : 'rgba(255,255,255,0.1)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '11px'
            }}
          />
        ))}
      </Box>

      {/* Notifications List */}
      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {filtered.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
            <FiBell size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
            <Typography variant='body2'>No notifications</Typography>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {filtered.map(notif => (
              <ListItem
                key={notif.id}
                sx={{
                  bgcolor: notif.read ? 'transparent' : 'rgba(0,102,204,0.1)',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  p: 1.5,
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                  transition: 'all 0.2s'
                }}
                onClick={() => !notif.read && markAsRead(notif.id)}
              >
                <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
                  <Box sx={{ color: severityColor(notif.severity), mt: 0.5 }}>
                    {notif.severity === 'critical' ? <FiAlertCircle /> : <FiCheckCircle />}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.5 }}>
                      <Typography variant='body2' sx={{ fontWeight: 600, color: '#fff' }}>{notif.title}</Typography>
                      <Chip label={typeLabel(notif.type)} size='small' sx={{ height: 18, fontSize: '10px' }} />
                    </Box>
                    <Typography variant='caption' sx={{ color: 'rgba(255,255,255,0.7)', display: 'block', mb: 0.5 }}>{notif.message}</Typography>
                    <Typography variant='caption' sx={{ color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <FiClock size={12} /> {notif.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                  </Box>
                  <IconButton size='small' onClick={(e) => { e.stopPropagation(); deleteNotification(notif.id); }} sx={{ color: '#aaa' }}>
                    <FiTrash2 size={14} />
                  </IconButton>
                </Box>
              </ListItem>
            ))}
          </List>
        )}
      </Box>

      {/* Action Buttons */}
      {notifications.length > 0 && (
        <Box sx={{ p: 1.5, borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: 1 }}>
          <Button size='small' variant='outlined' onClick={markAllAsRead} sx={{ flex: 1, fontSize: '11px' }}>Mark All Read</Button>
          <Button size='small' variant='outlined' color='error' onClick={clearAll} sx={{ flex: 1, fontSize: '11px' }}>Clear All</Button>
        </Box>
      )}

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Notification Settings</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box>
              <Typography variant='body2' sx={{ mb: 1 }}>Sound</Typography>
              <Select value={notificationSettings.sound ? 'on' : 'off'} onChange={(e) => persister({ ...notificationSettings, sound: e.target.value === 'on' })}>
                <MenuItem value='on'>On</MenuItem>
                <MenuItem value='off'>Off</MenuItem>
              </Select>
            </Box>
            <Box>
              <Typography variant='body2' sx={{ mb: 1 }}>Desktop Notifications</Typography>
              <Select value={notificationSettings.desktop ? 'on' : 'off'} onChange={(e) => persister({ ...notificationSettings, desktop: e.target.value === 'on' })}>
                <MenuItem value='on'>On</MenuItem>
                <MenuItem value='off'>Off</MenuItem>
              </Select>
            </Box>
            <Box>
              <Typography variant='body2' sx={{ mb: 1 }}>Auto-read after (days)</Typography>
              <TextField type='number' min='1' max='90' value={notificationSettings.retentionDays} onChange={(e) => persister({ ...notificationSettings, retentionDays: parseInt(e.target.value) })} fullWidth />
            </Box>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
