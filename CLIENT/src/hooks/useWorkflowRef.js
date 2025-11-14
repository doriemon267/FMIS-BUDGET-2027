import { useCallback, useState, useEffect } from 'react';

// Simple React hook to persist and retrieve active workflowRef / proposalId
// Storage precedence: sessionStorage -> localStorage
// Provides: workflowRef, setWorkflowRef(id), clearWorkflowRef(), headerConfig()
export function useWorkflowRef(storageKey = 'activeWorkflowRef') {
  const readInitial = () => {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem(storageKey) || localStorage.getItem(storageKey) || null;
  };
  const [workflowRef, setWorkflowRefState] = useState(readInitial);

  useEffect(() => {
    if (workflowRef) {
      try { sessionStorage.setItem(storageKey, workflowRef); } catch (_) {}
      try { localStorage.setItem(storageKey, workflowRef); } catch (_) {}
    }
  }, [workflowRef, storageKey]);

  const setWorkflowRef = useCallback((id) => {
    if (!id) return;
    setWorkflowRefState(String(id));
  }, []);

  const clearWorkflowRef = useCallback(() => {
    setWorkflowRefState(null);
    try { sessionStorage.removeItem(storageKey); } catch (_) {}
    try { localStorage.removeItem(storageKey); } catch (_) {}
  }, [storageKey]);

  // Returns headers object for fetch/axios calls
  const headerConfig = useCallback(() => {
    return workflowRef ? { 'X-Workflow-Ref': workflowRef } : {};
  }, [workflowRef]);

  return { workflowRef, setWorkflowRef, clearWorkflowRef, headerConfig };
}

// Helper (non-hook) to fetch stored ref outside React tree (e.g. vanilla scripts)
export function getStoredWorkflowRef(storageKey = 'activeWorkflowRef') {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(storageKey) || localStorage.getItem(storageKey) || null;
}