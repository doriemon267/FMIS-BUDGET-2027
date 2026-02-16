/**
 * React hook for auto-saving form data
 */

import { useEffect, useRef, useCallback } from 'react';
import { useDebouncedCallback } from './useDebounce';
import logger from '../utils/logger';

/**
 * Hook for auto-saving data
 * @param {Function} saveFunction - Function to call for saving
 * @param {any} data - Data to save
 * @param {Object} options - Options
 * @param {number} options.delay - Debounce delay in ms (default: 2000)
 * @param {Function} options.shouldSave - Function to determine if save should occur
 * @param {Function} options.onSaveSuccess - Callback on successful save
 * @param {Function} options.onSaveError - Callback on save error
 * @param {boolean} options.enabled - Enable/disable auto-save (default: true)
 */
export const useAutoSave = (
  saveFunction,
  data,
  options = {}
) => {
  const {
    delay = 2000,
    shouldSave = () => true,
    onSaveSuccess,
    onSaveError,
    enabled = true,
  } = options;

  const isInitialMount = useRef(true);
  const lastSavedData = useRef(null);

  const performSave = useCallback(async () => {
    if (!enabled || !shouldSave(data)) {
      return;
    }

    // Skip if data hasn't changed
    if (JSON.stringify(data) === JSON.stringify(lastSavedData.current)) {
      return;
    }

    try {
      logger.debug('Auto-saving data...', data);
      await saveFunction(data);
      lastSavedData.current = JSON.parse(JSON.stringify(data));
      
      if (onSaveSuccess) {
        onSaveSuccess(data);
      }
      
      logger.debug('Auto-save successful');
    } catch (error) {
      logger.error('Auto-save failed', error);
      if (onSaveError) {
        onSaveError(error);
      }
    }
  }, [saveFunction, data, enabled, shouldSave, onSaveSuccess, onSaveError]);

  const debouncedSave = useDebouncedCallback(performSave, delay);

  useEffect(() => {
    // Skip on initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      lastSavedData.current = JSON.parse(JSON.stringify(data));
      return;
    }

    debouncedSave();
  }, [data, debouncedSave]);

  // Manual save function
  const manualSave = useCallback(async () => {
    await performSave();
  }, [performSave]);

  return {
    manualSave,
  };
};

export default useAutoSave;
