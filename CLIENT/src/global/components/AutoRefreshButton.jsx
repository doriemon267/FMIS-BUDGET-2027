import React, { useState, useEffect } from 'react';
import { Button, Tooltip, CircularProgress } from '@mui/material';
import { FaSync } from 'react-icons/fa';

const AutoRefreshButton = ({ onRefresh, interval = 30000 }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  };
  
  const toggleAutoRefresh = () => {
    setAutoRefresh(prev => !prev);
  };
  
  useEffect(() => {
    let timer;
    if (autoRefresh) {
      timer = setInterval(handleRefresh, interval);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [autoRefresh, interval]);
  
  return (
    <Tooltip title={autoRefresh ? "Auto refresh enabled" : "Enable auto refresh"}>
      <Button
        variant="outlined"
        color={autoRefresh ? "success" : "primary"}
        onClick={toggleAutoRefresh}
        startIcon={isRefreshing ? <CircularProgress size={16} /> : <FaSync />}
        size="small"
        sx={{ 
          borderColor: '#2e7d32',
          color: '#2e7d32',
          '&:hover': {
            borderColor: '#1b5e20',
            backgroundColor: 'rgba(46, 125, 50, 0.04)'
          }
        }}
      >
        {autoRefresh ? "Auto Refresh" : "Auto Refresh"}
      </Button>
    </Tooltip>
  );
};

export default AutoRefreshButton;