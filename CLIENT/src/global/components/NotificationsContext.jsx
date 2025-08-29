import React, { createContext, useState, useEffect, useContext } from 'react';
import { Alert, Snackbar, Stack } from '@mui/material';
import api from '../../config/api'; // Fixed import path
import { useQuery } from '@tanstack/react-query';

export const NotificationsContext = createContext();

export const NotificationsProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [alerts, setAlerts] = useState([]);
  
  // Fetch active settings for due date
  const { data: activeSettings } = useQuery({
    queryKey: ["activeSettings"],
    queryFn: async () => {
      const res = await api.get("/settings/active");
      return res.data;
    },
  });

  // Check for due date proximity
  useEffect(() => {
    if (!activeSettings?.dueDate) return;
    
    const checkDueDate = () => {
      const now = new Date();
      const dueDate = new Date(activeSettings.dueDate);
      const oneDayBefore = new Date(dueDate.getTime() - 24 * 60 * 60 * 1000);
      
      // If we're within one day of the due date
      if (now >= oneDayBefore && now <= dueDate) {
        const formattedDate = dueDate.toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        
        // Add due date alert if not already present
        const dueDateAlert = {
          id: 'due-date-warning',
          message: `Submission deadline is approaching: ${formattedDate}`,
          severity: 'warning',
          autoHideDuration: null // Don't auto-hide this important alert
        };
        
        setAlerts(prev => {
          if (!prev.some(alert => alert.id === 'due-date-warning')) {
            return [...prev, dueDateAlert];
          }
          return prev;
        });
      }
    };
    
    checkDueDate();
    const interval = setInterval(checkDueDate, 60 * 60 * 1000); // Check hourly
    
    return () => clearInterval(interval);
  }, [activeSettings]);

  const addNotification = (notification) => {
    setNotifications(prev => [...prev, notification]);
  };

  const removeNotification = (index) => {
    setNotifications(prev => prev.filter((_, i) => i !== index));
  };

  const addAlert = (alert) => {
    const id = Date.now().toString();
    setAlerts(prev => [...prev, { ...alert, id }]);
    return id;
  };

  const removeAlert = (id) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id));
  };

  return (
    <NotificationsContext.Provider 
      value={{ 
        notifications, 
        addNotification, 
        removeNotification,
        addAlert,
        removeAlert
      }}
    >
      {children}
      <AlertsDisplay alerts={alerts} removeAlert={removeAlert} />
    </NotificationsContext.Provider>
  );
};

// Component to display alerts
const AlertsDisplay = ({ alerts, removeAlert }) => {
  return (
    <Stack spacing={2} sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 2000 }}>
      {alerts.map((alert) => (
        <Snackbar
          key={alert.id}
          open={alert.open}
          autoHideDuration={6000}
          onClose={() => handleCloseAlert(alert.id)}
          disableWindowBlurListener
        >
          <Alert 
            onClose={() => handleCloseAlert(alert.id)} 
            severity={alert.type} 
            sx={{ width: '100%' }}
          >
            {alert.message}
          </Alert>
        </Snackbar>
      ))}
    </Stack>
  );
};

// Custom hook to use notifications
export const useNotifications = () => useContext(NotificationsContext);
