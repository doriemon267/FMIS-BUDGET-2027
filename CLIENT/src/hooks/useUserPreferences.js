/**
 * User Preferences Hook
 * 
 * Manages user preferences stored in localStorage with sync to backend
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../config/api';
import logger from '../utils/logger';

const STORAGE_KEY = 'user_preferences';
const DEFAULT_PREFERENCES = {
  theme: 'auto', // 'light', 'dark', 'auto'
  language: 'en',
  dateFormat: 'MM/DD/YYYY',
  timeFormat: '12h', // '12h' or '24h'
  notifications: {
    email: true,
    browser: true,
    workflow: true,
    deadline: true,
  },
  dashboard: {
    defaultView: 'overview', // 'overview', 'analytics', 'reports'
    itemsPerPage: 25,
    showCompleted: false,
    showArchived: false,
  },
  proposals: {
    defaultFilter: 'all', // 'all', 'pending', 'approved', 'rejected'
    sortBy: 'updatedAt', // 'createdAt', 'updatedAt', 'title', 'status'
    sortOrder: 'desc', // 'asc', 'desc'
    showDetails: true,
  },
  table: {
    compactMode: false,
    showRowNumbers: true,
    stickyHeader: true,
  },
  accessibility: {
    highContrast: false,
    fontSize: 'medium', // 'small', 'medium', 'large'
    reduceMotion: false,
  },
};

/**
 * Get preferences from localStorage
 */
const getStoredPreferences = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    logger.error('Failed to load preferences from localStorage:', error);
  }
  return null;
};

/**
 * Save preferences to localStorage
 */
const savePreferencesToStorage = (preferences) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch (error) {
    logger.error('Failed to save preferences to localStorage:', error);
  }
};

/**
 * Fetch preferences from backend
 */
const fetchUserPreferences = async () => {
  try {
    const response = await api.get('/user/preferences');
    return response.data?.preferences || DEFAULT_PREFERENCES;
  } catch (error) {
    logger.warn('Failed to fetch preferences from backend, using defaults:', error);
    return getStoredPreferences() || DEFAULT_PREFERENCES;
  }
};

/**
 * Save preferences to backend
 */
const saveUserPreferences = async (preferences) => {
  try {
    const response = await api.put('/user/preferences', { preferences });
    return response.data?.preferences || preferences;
  } catch (error) {
    logger.error('Failed to save preferences to backend:', error);
    throw error;
  }
};

/**
 * Custom hook for user preferences
 */
export const useUserPreferences = () => {
  const queryClient = useQueryClient();
  
  // Load preferences from backend or localStorage
  const { data: preferences = DEFAULT_PREFERENCES, isLoading } = useQuery({
    queryKey: ['userPreferences'],
    queryFn: fetchUserPreferences,
    staleTime: 5 * 60 * 1000, // 5 minutes
    initialData: getStoredPreferences() || DEFAULT_PREFERENCES,
  });

  // Save preferences mutation
  const saveMutation = useMutation({
    mutationFn: saveUserPreferences,
    onSuccess: (savedPreferences) => {
      // Update query cache
      queryClient.setQueryData(['userPreferences'], savedPreferences);
      // Also save to localStorage as backup
      savePreferencesToStorage(savedPreferences);
    },
    onError: (error) => {
      logger.error('Failed to save preferences:', error);
    },
  });

  // Update a specific preference
  const updatePreference = useCallback((path, value) => {
    const currentPrefs = queryClient.getQueryData(['userPreferences']) || preferences;
    
    // Deep merge for nested paths (e.g., 'notifications.email' or 'dashboard.itemsPerPage')
    const keys = path.split('.');
    const newPrefs = { ...currentPrefs };
    let current = newPrefs;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      current[key] = { ...current[key] };
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
    
    // Update cache immediately for instant UI update
    queryClient.setQueryData(['userPreferences'], newPrefs);
    // Save to localStorage immediately
    savePreferencesToStorage(newPrefs);
    // Save to backend
    saveMutation.mutate(newPrefs);
  }, [preferences, queryClient, saveMutation]);

  // Update multiple preferences at once
  const updatePreferences = useCallback((updates) => {
    const currentPrefs = queryClient.getQueryData(['userPreferences']) || preferences;
    const newPrefs = { ...currentPrefs };
    
    // Deep merge updates
    Object.keys(updates).forEach((path) => {
      const keys = path.split('.');
      let current = newPrefs;
      
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!current[key] || typeof current[key] !== 'object') {
          current[key] = {};
        }
        current[key] = { ...current[key] };
        current = current[key];
      }
      
      current[keys[keys.length - 1]] = updates[path];
    });
    
    // Update cache immediately
    queryClient.setQueryData(['userPreferences'], newPrefs);
    // Save to localStorage immediately
    savePreferencesToStorage(newPrefs);
    // Save to backend
    saveMutation.mutate(newPrefs);
  }, [preferences, queryClient, saveMutation]);

  // Reset to defaults
  const resetPreferences = useCallback(() => {
    queryClient.setQueryData(['userPreferences'], DEFAULT_PREFERENCES);
    savePreferencesToStorage(DEFAULT_PREFERENCES);
    saveMutation.mutate(DEFAULT_PREFERENCES);
  }, [queryClient, saveMutation]);

  // Get a specific preference value
  const getPreference = useCallback((path, defaultValue = null) => {
    const keys = path.split('.');
    let current = preferences;
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return defaultValue;
      }
    }
    
    return current;
  }, [preferences]);

  return {
    preferences,
    isLoading,
    updatePreference,
    updatePreferences,
    resetPreferences,
    getPreference,
    isSaving: saveMutation.isPending,
    saveError: saveMutation.error,
  };
};

export default useUserPreferences;
