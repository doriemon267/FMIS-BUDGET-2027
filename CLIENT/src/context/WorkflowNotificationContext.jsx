/**
 * WorkflowNotificationContext - Simple, Clean Notification State Management
 * 
 * Features:
 * - Direct API polling (no caching)
 * - Mark as read/unread mutations
 * - Delete mutations
 * - Mute/Unmute mutations
 * - Global state for notifications across workflow
 */

import React, { createContext, useContext, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../config/api';
import { toast } from 'react-toastify';

// Create context
const WorkflowNotificationContext = createContext();

// Provider component
export const WorkflowNotificationProvider = ({ children }) => {
  const queryClient = useQueryClient();

  // ============================================================================
  // QUERIES
  // ============================================================================

  // Fetch notifications with NO caching (gcTime: 0)
  const {
    data: notifications = [],
    isLoading,
    isFetching,
    error,
    refetch
  } = useQuery({
    queryKey: ['workflowNotifications'],
    queryFn: async () => {
      try {
        const response = await api.get('/api/notifications');
        const data = response.data?.data || [];
        // console.log('[WorkflowNotificationContext] Fetched', data.length, 'notifications');
        return data;
      } catch (err) {
        console.error('[WorkflowNotificationContext] Fetch error:', err);
        throw err;
      }
    },
    // CRITICAL: These settings prevent the 15-minute caching issue
    staleTime: 0,              // Always consider data stale
    gcTime: 0,                 // Don't cache in memory (was cacheTime)
    refetchInterval: 30000,    // Poll every 30 seconds
    refetchOnWindowFocus: true, // Refresh when window regains focus
    refetchOnReconnect: true,  // Refresh when reconnecting
    retry: 1,
    retryDelay: 1000
  });

  // ============================================================================
  // MUTATIONS
  // ============================================================================

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (ids) => {
      const response = await api.post('/api/notifications/mark-read', { ids });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflowNotifications'] });
    },
    onError: (error) => {
      console.error('Error marking as read:', error);
      toast.error('Failed to mark notification as read');
    }
  });

  // Mark as unread mutation
  const markAsUnreadMutation = useMutation({
    mutationFn: async (ids) => {
      const response = await api.post('/notifications/mark-unread', { ids });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflowNotifications'] });
    },
    onError: (error) => {
      console.error('Error marking as unread:', error);
      toast.error('Failed to mark notification as unread');
    }
  });

  // Delete notification mutation
  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId) => {
      const response = await api.delete(`/notifications/${notificationId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflowNotifications'] });
      toast.success('Notification deleted');
    },
    onError: (error) => {
      console.error('Error deleting notification:', error);
      toast.error('Failed to delete notification');
    }
  });

  // Mute proposal notifications
  const muteProposalMutation = useMutation({
    mutationFn: async ({ proposalId, mute }) => {
      const response = await api.post('/api/notifications/mute', {
        proposalId,
        mute
      });
      return response.data;
    },
    onSuccess: (data, { mute }) => {
      toast.success(mute ? 'Notifications muted' : 'Notifications unmuted');
    },
    onError: (error) => {
      console.error('Error toggling mute:', error);
      toast.error('Failed to toggle mute');
    }
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const unreadIds = notifications
        .filter(n => n.status === 'UNREAD')
        .map(n => n._id);
      
      if (unreadIds.length === 0) return { success: true };
      
      const response = await api.post('/notifications/mark-read', {
        ids: unreadIds
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflowNotifications'] });
      toast.success('All notifications marked as read');
    },
    onError: (error) => {
      console.error('Error marking all as read:', error);
      toast.error('Failed to mark all as read');
    }
  });

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const unreadCount = notifications.filter(n => n.status === 'UNREAD').length;
  const totalCount = notifications.length;

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  const handleMarkAsRead = useCallback(
    (notificationId) => {
      markAsReadMutation.mutate([notificationId]);
    },
    [markAsReadMutation]
  );

  const handleMarkAsUnread = useCallback(
    (notificationId) => {
      markAsUnreadMutation.mutate([notificationId]);
    },
    [markAsUnreadMutation]
  );

  const handleDelete = useCallback(
    (notificationId) => {
      deleteNotificationMutation.mutate(notificationId);
    },
    [deleteNotificationMutation]
  );

  const handleMuteProposal = useCallback(
    (proposalId, mute = true) => {
      muteProposalMutation.mutate({ proposalId, mute });
    },
    [muteProposalMutation]
  );

  const handleMarkAllAsRead = useCallback(
    () => {
      markAllAsReadMutation.mutate();
    },
    [markAllAsReadMutation]
  );

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================

  const value = {
    // Data
    notifications,
    unreadCount,
    totalCount,
    
    // State
    isLoading,
    isFetching,
    error,
    
    // Refetch
    refetch,
    
    // Mutations
    handleMarkAsRead,
    handleMarkAsUnread,
    handleDelete,
    handleMuteProposal,
    handleMarkAllAsRead,
    
    // Raw mutations (if needed)
    markAsReadMutation,
    markAsUnreadMutation,
    deleteNotificationMutation,
    muteProposalMutation,
    markAllAsReadMutation
  };

  return (
    <WorkflowNotificationContext.Provider value={value}>
      {children}
    </WorkflowNotificationContext.Provider>
  );
};

// ============================================================================
// HOOK
// ============================================================================

export const useWorkflowNotifications = () => {
  const context = useContext(WorkflowNotificationContext);
  
  if (!context) {
    throw new Error(
      'useWorkflowNotifications must be used within WorkflowNotificationProvider'
    );
  }
  
  return context;
};

export default WorkflowNotificationContext;
