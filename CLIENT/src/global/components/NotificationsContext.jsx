import React, { createContext, useState, useEffect, useContext } from 'react';
import CustomSnackbar from './CustomSnackbar';
import api from '../../config/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export const NotificationsContext = createContext();

export const NotificationsProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]); // legacy local notifications (strings)
  const [alerts, setAlerts] = useState([]);
  const queryClient = useQueryClient();

  // Server notifications: unread list for current user
  const {
    data: serverNotifications = [],
    isFetching: fetchingServerNotifications,
  } = useQuery({
    queryKey: ['serverNotifications'],
    queryFn: async () => {
      const res = await api.get('/api/notifications');
      return res.data?.data || [];
    },
    refetchInterval: 60000, // poll every 60s
    refetchOnWindowFocus: true,
  });

  // Mark notifications as read (bulk or single)
  const { mutateAsync: markNotificationsAsRead } = useMutation({
    mutationFn: async (ids) => {
      // Accept single id or array
      const payload = { ids: Array.isArray(ids) ? ids : [ids] };
      await api.post('/notifications/mark-read', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serverNotifications'] });
    },
  });

  // Delete notifications (single or bulk)
  const { mutateAsync: deleteNotifications } = useMutation({
    mutationFn: async (idsOrId) => {
      // Accept single id or array
      if (!idsOrId) return;
      if (Array.isArray(idsOrId)) {
        const payload = { ids: idsOrId };
        await api.post('/notifications/delete', payload);
      } else {
        await api.delete(`/notifications/${idsOrId}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serverNotifications'] });
    }
  });

  const { mutateAsync: muteProposal } = useMutation({
    mutationFn: async ({ proposalId, mute = true }) => {
      await api.post('/notifications/mute', { proposalId, mute });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serverNotifications'] });
    }
  });

  const muteNotification = async ({ proposalId, mute = true }) => {
    try {
      await muteProposal({ proposalId, mute });
      // local UI update - refetch notifications
      queryClient.invalidateQueries({ queryKey: ['serverNotifications'] });
    } catch (error) {
      console.error('Failed to mute proposal notifications:', error);
      throw error;
    }
  };

  const { mutateAsync: markAllNotificationsAsRead } = useMutation({
    mutationFn: async (options = {}) => {
      // options may contain entity or proposalId as scope
      const res = await api.post('/notifications/mark-all-read', options);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serverNotifications'] });
    }
  });

  // Legacy: add/remove local toast-like notifications (kept for compatibility)
  const addNotification = (notification) => setNotifications((prev) => [...prev, notification]);
  const removeNotification = (index) => setNotifications((prev) => prev.filter((_, i) => i !== index));

  // Due date alerts sourced from settings
  const { data: activeSettings } = useQuery({
    queryKey: ['activeSettings'],
    queryFn: async () => {
      const res = await api.get('/settings/active');
      return res.data;
    },
  });

  useEffect(() => {
    if (!activeSettings?.dueDate) return;
    const checkDueDate = () => {
      const now = new Date();
      const dueDate = new Date(activeSettings.dueDate);
      const oneDayBefore = new Date(dueDate.getTime() - 24 * 60 * 60 * 1000);
      if (now >= oneDayBefore && now <= dueDate) {
        const formattedDate = dueDate.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        const dueDateAlert = {
          id: 'due-date-warning',
          message: `Submission deadline is approaching: ${formattedDate}`,
          severity: 'warning',
          autoHideDuration: null,
        };
        setAlerts((prev) => {
          if (!prev.some((a) => a.id === 'due-date-warning')) return [...prev, dueDateAlert];
          return prev;
        });
      }
    };
    checkDueDate();
    const interval = setInterval(checkDueDate, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [activeSettings]);

  const addAlert = (alert) => {
    const id = Date.now().toString();
    setAlerts((prev) => [...prev, { ...alert, id }]);
    return id;
  };

  const removeAlert = (id) => setAlerts((prev) => prev.filter((a) => a.id !== id));

  return (
    <NotificationsContext.Provider
      value={{
        // Legacy local notifications (strings)
        notifications,
        addNotification,
        removeNotification,
        // Server notifications
        serverNotifications,
        fetchingServerNotifications,
    markNotificationsAsRead,
  deleteNotifications,
  muteProposal,
  muteNotification,
      markAllNotificationsAsRead,
        // Alerts (snackbars)
        addAlert,
        removeAlert,
      }}
    >
      {children}
      <AlertsDisplay alerts={alerts} removeAlert={removeAlert} />
    </NotificationsContext.Provider>
  );
};

// Component to display alerts
const AlertsDisplay = ({ alerts, removeAlert }) => {
  const handleCloseAlert = (alertId) => removeAlert(alertId);
  return (
    <>
      {alerts.map((alert) => (
        <CustomSnackbar
          key={alert.id}
          open
          message={alert.message}
          severity={alert.severity || alert.type || 'info'}
          autoHideDuration={alert.autoHideDuration ?? 6000}
          onClose={() => handleCloseAlert(alert.id)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        />
      ))}
    </>
  );
};

// Custom hook to use notifications
export const useNotifications = () => useContext(NotificationsContext);