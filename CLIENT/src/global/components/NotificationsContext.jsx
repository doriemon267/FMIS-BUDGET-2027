import React, { createContext, useState, useEffect, useContext } from 'react';
import CustomSnackbar from './CustomSnackbar';
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
  const handleCloseAlert = (alertId) => {
    removeAlert(alertId);
  };

  return (
    <>
      {alerts.map((alert) => (
        <CustomSnackbar
          key={alert.id}
          open={alert.open}
          message={alert.message}
          severity={alert.type}
          autoHideDuration={6000}
          onClose={() => handleCloseAlert(alert.id)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        />
      ))}
    </>
  );
};

// Custom hook to use notifications
export const useNotifications = () => useContext(NotificationsContext);
