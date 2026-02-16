/**
 * React hook for keyboard shortcuts
 */

import { useEffect } from 'react';

/**
 * Hook to register keyboard shortcuts
 * @param {Object} shortcuts - Object mapping key combinations to callbacks
 * @param {Array} dependencies - Dependencies array (optional)
 * 
 * @example
 * useKeyboardShortcuts({
 *   'ctrl+s': (e) => {
 *     e.preventDefault();
 *     handleSave();
 *   },
 *   'ctrl+k': (e) => {
 *     e.preventDefault();
 *     openSearch();
 *   },
 * });
 */
export const useKeyboardShortcuts = (shortcuts, dependencies = []) => {
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Build key string (e.g., 'ctrl+s', 'alt+shift+k')
      const keyParts = [];
      
      if (event.ctrlKey || event.metaKey) keyParts.push('ctrl');
      if (event.altKey) keyParts.push('alt');
      if (event.shiftKey) keyParts.push('shift');
      
      const key = event.key.toLowerCase();
      if (key !== 'control' && key !== 'alt' && key !== 'shift' && key !== 'meta') {
        keyParts.push(key);
      }
      
      const keyString = keyParts.join('+');
      
      // Check if this shortcut is registered
      if (shortcuts[keyString]) {
        event.preventDefault();
        shortcuts[keyString](event);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [shortcuts, ...dependencies]);
};

export default useKeyboardShortcuts;
